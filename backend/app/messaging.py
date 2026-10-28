"""SMS through Africa's Talking (https://africastalking.com).

Credentials come from the environment or from backend/.env (git-ignored):

    AT_USERNAME=sandbox          # "sandbox" for the free test environment
    AT_API_KEY=...               # from the Africa's Talking dashboard
    AT_PHONE=+2507XXXXXXXX       # the phone the demo sends to (the simulator's number)
    AT_DAILY_LIMIT=20            # live mode only: most SMS a day (default 20)
    AT_SENDER_ID=RDIMaize        # optional: an approved alphanumeric sender name

Which gateway sends depends on the settings: the sandbox delivers to Africa's
Talking's phone simulator; a live username delivers to the real phone and costs
credit, so the live gateway only sends single-SMS messages and stops at the daily
limit (the API is reachable from the internet through the tunnel, and it must not
be possible to drain the account). Messages go to AT_PHONE unless the USSD menu
names the caller's own number (a farmer's sign-up confirmation); the dashboard's
SMS button can only reach AT_PHONE.
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from .env import ENV_FILE, read_env_file
from .policies import mask_phone
from .reports import ReportStore

KEYS = ("AT_USERNAME", "AT_API_KEY", "AT_PHONE", "AT_DAILY_LIMIT", "AT_SENDER_ID", "AT_POLICY")


class SmsError(RuntimeError):
    """A message that was not sent, with the reason in plain words."""


@dataclass(frozen=True)
class SmsSettings:
    username: str = ""
    api_key: str = ""
    phone: str = ""
    daily_limit: int = 20
    sender_id: str = ""
    demo_policy: str = "RDI-RWA-1233"  # the policy the demo phone holds on USSD

    @classmethod
    def load(cls, env_file: Path = ENV_FILE) -> "SmsSettings":
        """Environment variables win over backend/.env (see env.py)."""
        file = read_env_file(env_file)
        v = {k: os.environ.get(k) or file.get(k, "") for k in KEYS}
        try:
            limit = int(v["AT_DAILY_LIMIT"] or 20)
        except ValueError:
            limit = 20
        return cls(v["AT_USERNAME"], v["AT_API_KEY"], v["AT_PHONE"], limit, v["AT_SENDER_ID"],
                   v["AT_POLICY"] or "RDI-RWA-1233")

    @property
    def configured(self) -> bool:
        return bool(self.username and self.api_key and self.phone)

    @property
    def sandbox(self) -> bool:
        return self.username == "sandbox"

    @property
    def masked_phone(self) -> str:
        return mask_phone(self.phone)


GSM_BASIC = set("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡"
                "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà")
GSM_EXTENDED = set("^{}\\[~]|€")


def sms_parts(text: str) -> int:
    """How many SMS a message is billed as (same rule as frontend/lib/sms.ts): 160 plain
    GSM characters per SMS (153 per part when longer); one character outside that
    alphabet switches the whole message to UCS-2 at 70 (67 per part)."""
    if all(c in GSM_BASIC or c in GSM_EXTENDED for c in text):
        length = sum(2 if c in GSM_EXTENDED else 1 for c in text)
        return 1 if length <= 160 else -(-length // 153)
    return 1 if len(text) <= 70 else -(-len(text) // 67)


# The HTTP call, injectable so tests and other transports can replace it:
# (url, form fields, headers) -> parsed JSON reply.
Transport = Callable[[str, dict[str, str], dict[str, str]], dict]


def http_post(url: str, fields: dict[str, str], headers: dict[str, str]) -> dict:
    req = urllib.request.Request(url, data=urllib.parse.urlencode(fields).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as e:
        raise SmsError(f"Africa's Talking refused the message ({e.code}): {e.read().decode(errors='replace')[:200]}") from e
    except urllib.error.URLError as e:
        raise SmsError(f"Could not reach Africa's Talking: {e.reason}") from e


class SmsGateway(ABC):
    """Anything that can send a message. Callers only use send(), so the sandbox,
    live and unconfigured cases are interchangeable."""

    live: bool = False

    def __init__(self, settings: SmsSettings):
        self.settings = settings

    @abstractmethod
    def send(self, message: str, to: str = "") -> dict:
        """Send one message to `to` (the demo phone by default); raises SmsError if it was not sent."""


class UnconfiguredGateway(SmsGateway):
    """Stands in when backend/.env has no credentials, so callers need no special case."""

    def send(self, message: str, to: str = "") -> dict:
        raise SmsError("SMS is not set up: add AT_USERNAME, AT_API_KEY and AT_PHONE to backend/.env")


class AfricasTalkingGateway(SmsGateway):
    """The shared Africa's Talking request; subclasses set the host and the checks."""

    host = "api.africastalking.com"

    def __init__(self, settings: SmsSettings, store: ReportStore, transport: Transport = http_post):
        super().__init__(settings)
        self.store = store
        self.transport = transport

    def check(self, parts: int) -> None:
        """Refuse a message before anything is sent. Nothing to check by default."""

    def fields(self, message: str, to: str) -> dict[str, str]:
        return {"username": self.settings.username, "to": to or self.settings.phone, "message": message}

    def send(self, message: str, to: str = "") -> dict:
        parts = sms_parts(message)
        self.check(parts)
        reply = self.transport(
            f"https://{self.host}/version1/messaging",
            self.fields(message, to),
            {"apiKey": self.settings.api_key, "Accept": "application/json",
             "Content-Type": "application/x-www-form-urlencoded"},
        )
        recipients = reply.get("SMSMessageData", {}).get("Recipients", [])
        if not recipients:
            raise SmsError(reply.get("SMSMessageData", {}).get("Message", "No recipient in the response"))
        r = recipients[0]
        if r.get("status") != "Success":
            raise SmsError(f"Not sent: {r.get('status')}")
        self.store.log_sms(parts, self.live)
        return {"status": r.get("status"), "cost": r.get("cost"), "messageId": r.get("messageId"), "parts": parts}


class SandboxGateway(AfricasTalkingGateway):
    """Free test environment: messages go to the phone simulator, nothing is charged."""

    host = "api.sandbox.africastalking.com"


class LiveGateway(AfricasTalkingGateway):
    """Real phones and real credit: single-SMS messages only, a daily cap, and the
    approved sender name when there is one."""

    live = True

    def check(self, parts: int) -> None:
        if parts > 1:
            raise SmsError(f"Not sent: this message would be billed as {parts} SMS; live mode sends single-SMS messages only")
        if self.store.live_sms_today() + parts > self.settings.daily_limit:
            raise SmsError(f"Not sent: the daily limit of {self.settings.daily_limit} live SMS is reached (AT_DAILY_LIMIT in backend/.env)")

    def fields(self, message: str, to: str) -> dict[str, str]:
        fields = super().fields(message, to)
        if self.settings.sender_id:
            fields["from"] = self.settings.sender_id
        return fields


def gateway_for(settings: SmsSettings, store: ReportStore, transport: Transport = http_post) -> SmsGateway:
    """The gateway the settings call for."""
    if not settings.configured:
        return UnconfiguredGateway(settings)
    cls = SandboxGateway if settings.sandbox else LiveGateway
    return cls(settings, store, transport)
