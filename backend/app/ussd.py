"""The USSD menu that Africa's Talking calls on every key press.

Africa's Talking sends the whole session's input so far as `text`, with answers
joined by "*" ("" on the first screen, "1" after choosing 1, "1*0" after going
back). The reply starts with "CON " to wait for another answer or "END " to
close the session. Each screen stays under 160 characters.

The farmer is identified by the phone number they dial from: the demo phone
(AT_PHONE in backend/.env) holds the demo policy AT_POLICY (RDI-RWA-1233 by
default). Other numbers have no policy. The Kinyarwanda text is a draft for a
native speaker to check.
"""

from dataclasses import dataclass

from .data import Dataset
from .messaging import SmsError, SmsGateway
from .policies import CoverQuote, DemoPolicy, PolicyBook
from .reports import ReportStore

CAUSE_KEYS = {"1": "drought", "2": "pests", "3": "flood", "4": "other"}

T = {
    "en": {
        "menu": "RDI Maize Insurance\n{district} {policy}\n1. My cover\n2. This season\n3. My payouts\n4. Report a crop loss\n5. Ikinyarwanda\n0. Exit",
        "cover": "Cover: Season A {season}\nMaize {area} m2 in {district}\nInsured value {cover}\nPremium {premium}/season\nPays if index below {trigger}%",
        "season": "Season A {season}, day {day} of {days}\nRain so far: {rain}% of normal\nIndex {index} ({state})\nFinal result after 31 Dec",
        "no_season": "No season in progress.",
        "payouts": "Your payouts:\n{lines}",
        "paid": "{season}: {amount} ({share})",
        "none": "{season}: none",
        "sms_option": "\n1. Send me this by SMS\n0. Back",
        "cause": "What damaged your crop?\n1. Drought\n2. Pests or disease\n3. Flood or hail\n4. Other\n0. Back",
        "causes": {"drought": "drought", "pests": "pests or disease", "flood": "flood or hail", "other": "other"},
        "thanks": "Thank you. Report received ({cause}).\n{n} report(s) for {district}, Season A {season}.",
        "already": "You have already reported this season.\n{n} report(s) on file for {district}.",
        "sent": "Sent. Check your SMS messages.",
        "not_sent": "Sorry, the SMS could not be sent. Please try later.",
        "exit": "Thank you for using RDI Maize Insurance.",
        "no_policy": "No RDI policy is registered to this number.",
        "states": {"watch": "watch", "trigger": "past trigger", "normal": "normal"},
    },
    "rw": {
        "menu": "RDI Ubwishingizi bw'ibigori\n{district} {policy}\n1. Ubwishingizi bwanjye\n2. Iki gihembwe\n3. Ingurane nahawe\n4. Menyesha igihombo\n5. English\n0. Sohoka",
        "cover": "Igihembwe A {season}\nIbigori {area} m2 i {district}\nAgaciro kishingiwe {cover}\nUmusanzu {premium}\nYishyurwa igipimo kiri munsi ya {trigger}%",
        "season": "Igihembwe A {season}, umunsi {day}/{days}\nImvura: {rain}% y'isanzwe\nIgipimo {index} ({state})\nIbisubizo nyuma ya 31 Ukuboza",
        "no_season": "Nta gihembwe kiri gukurikiranwa.",
        "payouts": "Ingurane wahawe:\n{lines}",
        "paid": "{season}: {amount} ({share})",
        "none": "{season}: nta ngurane",
        "sms_option": "\n1. Mbyoherereze kuri SMS\n0. Subira inyuma",
        "cause": "Ni iki cyangije imyaka?\n1. Izuba\n2. Udukoko cyangwa indwara\n3. Imyuzure cyangwa urubura\n4. Ibindi\n0. Subira inyuma",
        "causes": {"drought": "izuba", "pests": "udukoko", "flood": "imyuzure", "other": "ibindi"},
        "thanks": "Murakoze. Igihombo cyakiriwe ({cause}).\nRaporo {n} muri {district}, Igihembwe A {season}.",
        "already": "Mwamaze kumenyesha muri iki gihembwe.\nRaporo {n} zirahari muri {district}.",
        "sent": "Byoherejwe. Reba ubutumwa bwawe.",
        "not_sent": "Ihangane, SMS ntiyoherejwe. Ongera ugerageze nyuma.",
        "exit": "Murakoze gukoresha RDI.",
        "no_policy": "Nta bwishingizi bwa RDI bubaruye kuri iyi nimero.",
        "states": {"watch": "kurikirana", "trigger": "kirenze urugero", "normal": "bisanzwe"},
    },
}


def rwf(v: float) -> str:
    return f"RWF {round(v):,}"


def signed(v: float) -> str:
    return f"{'+' if v > 0 else ''}{v:.1f}%"


def same_number(a: str, b: str) -> bool:
    """Compare phone numbers by their last nine digits (+250788... and 0788... match)."""
    digits = lambda s: "".join(c for c in s if c.isdigit())[-9:]  # noqa: E731
    return bool(a and b) and digits(a) == digits(b)


@dataclass(frozen=True)
class Session:
    """Where a USSD session is, replayed from Africa's Talking's `text`: the language and
    the path of choices. On the main menu "5" switches language; elsewhere "0" goes back
    a screen and anything else goes forward."""

    lang: str
    path: tuple[str, ...]

    @classmethod
    def replay(cls, text: str) -> "Session":
        lang, path = "en", []
        for answer in text.split("*") if text else []:
            if not path and answer == "5":
                lang = "rw" if lang == "en" else "en"
            elif answer == "0" and path:
                path.pop()
            else:
                path.append(answer)
        return cls(lang, tuple(path))


class UssdMenu:
    """The farmer's menu: one method per screen. It reads the index from the dataset,
    stores loss reports in the store and sends SMS copies through the gateway, so each
    of those can be replaced (in tests, or by another provider)."""

    def __init__(self, ds: Dataset, store: ReportStore, gateway: SmsGateway, policies: PolicyBook):
        self.ds = ds
        self.store = store
        self.gateway = gateway
        self.policies = policies

    def respond(self, text: str, policy: DemoPolicy | None) -> str:
        session = Session.replay(text)
        t = T[session.lang]
        if policy is None:
            return "END " + t["no_policy"]
        path = session.path
        if not path:
            return "CON " + t["menu"].format(district=policy.district, policy=policy.id)
        screens = {"1": self.cover, "2": self.this_season, "3": self.payouts, "4": self.report_loss}
        if path[0] == "0":
            return "END " + t["exit"]
        if path[0] not in screens:
            return "CON " + t["menu"].format(district=policy.district, policy=policy.id)
        return screens[path[0]](t, policy, path[1:])

    def _with_sms(self, t: dict, body: str, rest: tuple[str, ...]) -> str:
        """A screen that offers to send itself by SMS; answering 1 sends it."""
        if rest and rest[0] == "1":
            try:
                self.gateway.send(body.replace("\n", ". "))
                return "END " + t["sent"]
            except SmsError:
                return "END " + t["not_sent"]
        return "CON " + body + t["sms_option"]

    def cover(self, t: dict, policy: DemoPolicy, rest: tuple[str, ...]) -> str:
        quote = CoverQuote.for_policy(self.ds, policy)
        current = self.ds.current_season
        season = current["season"] if current else max(s for (_, s) in self.ds.seasons) + 1
        body = t["cover"].format(season=season, area=f"{policy.area_m2:,}", district=policy.district,
                                 cover=rwf(quote.cover), premium=rwf(quote.premium), trigger=f"{self.ds.model.trigger:.0f}")
        return self._with_sms(t, body, rest)

    def this_season(self, t: dict, policy: DemoPolicy, rest: tuple[str, ...]) -> str:
        current = self.ds.current_season
        if not current:
            return "END " + t["no_season"]
        d = next(x for x in current["districts"] if x["district"] == policy.district)
        rain = round(100 * d["rainMm"] / d["rainNormalMm"]) if d["rainNormalMm"] else 100
        state = "trigger" if d["payout"] > 0 else "watch" if d["rainZ"] <= -0.5 or d["ndviZ"] <= -0.5 else "normal"
        body = t["season"].format(season=current["season"], day=current["daysElapsed"], days=current["windowDays"],
                                  rain=rain, index=signed(d["index"]), state=t["states"][state])
        return self._with_sms(t, body, rest)

    def payouts(self, t: dict, policy: DemoPolicy, rest: tuple[str, ...]) -> str:
        cover = CoverQuote.for_policy(self.ds, policy).cover
        seasons = sorted((s for (d, s) in self.ds.calibration if d == policy.district), reverse=True)[:3]
        lines = []
        for s in seasons:
            share = self.ds.calibration[(policy.district, s)].payout
            lines.append(t["paid"].format(season=s, amount=rwf(share * cover), share=f"{share:.0%}")
                         if share > 0 else t["none"].format(season=s))
        return self._with_sms(t, t["payouts"].format(lines="\n".join(lines)), rest)

    def report_loss(self, t: dict, policy: DemoPolicy, rest: tuple[str, ...]) -> str:
        current = self.ds.current_season
        if not current:
            return "END " + t["no_season"]
        cause = CAUSE_KEYS.get(rest[0]) if rest else None
        if cause is None:
            return "CON " + t["cause"]
        season = current["season"]
        created = self.store.add(policy.id, policy.district, season, cause)
        n = self.store.count(policy.district, season)
        if created:
            return "END " + t["thanks"].format(cause=t["causes"][cause], n=n, district=policy.district, season=season)
        return "END " + t["already"].format(n=n, district=policy.district)
