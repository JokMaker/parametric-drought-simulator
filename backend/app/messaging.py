"""SMS through Africa's Talking (https://africastalking.com).

Credentials come from the environment or from backend/.env (git-ignored):

    AT_USERNAME=sandbox          # "sandbox" for the free test environment
    AT_API_KEY=...               # from the Africa's Talking dashboard
    AT_PHONE=+2507XXXXXXXX       # the phone the demo sends to (the simulator's number)

With the sandbox username, messages go to Africa's Talking's online phone
simulator, not to real phones.
"""

import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


def _env_file() -> dict[str, str]:
    """Values in backend/.env. Read on every call, so a new key works without a restart."""
    if not ENV_FILE.exists():
        return {}
    values = {}
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def settings() -> dict[str, str]:
    """Environment variables win over backend/.env."""
    file = _env_file()
    return {k: os.environ.get(k) or file.get(k, "") for k in ("AT_USERNAME", "AT_API_KEY", "AT_PHONE")}


def configured() -> bool:
    s = settings()
    return bool(s["AT_USERNAME"] and s["AT_API_KEY"] and s["AT_PHONE"])


def sandbox() -> bool:
    return settings()["AT_USERNAME"] == "sandbox"


def masked_phone() -> str:
    phone = settings()["AT_PHONE"]
    return f"{phone[:4]}••••{phone[-3:]}" if len(phone) > 7 else ""


class SmsError(RuntimeError):
    pass


def send_sms(message: str) -> dict:
    """Send one SMS to AT_PHONE; returns Africa's Talking's recipient status."""
    s = settings()
    if not configured():
        raise SmsError("SMS is not set up: add AT_USERNAME, AT_API_KEY and AT_PHONE to backend/.env")
    host = "api.sandbox.africastalking.com" if sandbox() else "api.africastalking.com"
    body = urllib.parse.urlencode({"username": s["AT_USERNAME"], "to": s["AT_PHONE"], "message": message}).encode()
    req = urllib.request.Request(
        f"https://{host}/version1/messaging",
        data=body,
        headers={"apiKey": s["AT_API_KEY"], "Accept": "application/json",
                 "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read())
    except urllib.error.HTTPError as e:
        raise SmsError(f"Africa's Talking refused the message ({e.code}): {e.read().decode(errors='replace')[:200]}") from e
    except urllib.error.URLError as e:
        raise SmsError(f"Could not reach Africa's Talking: {e.reason}") from e
    recipients = data.get("SMSMessageData", {}).get("Recipients", [])
    if not recipients:
        raise SmsError(data.get("SMSMessageData", {}).get("Message", "No recipient in the response"))
    r = recipients[0]
    if r.get("status") != "Success":
        raise SmsError(f"Not sent: {r.get('status')}")
    return {"status": r.get("status"), "cost": r.get("cost"), "messageId": r.get("messageId")}
