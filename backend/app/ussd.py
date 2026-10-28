"""The USSD menu that Africa's Talking calls on every key press.

Africa's Talking sends the whole session's input so far as `text`, with answers
joined by "*" ("" on the first screen, "1" after choosing 1, "1*0" after going
back). The reply starts with "CON " to wait for another answer or "END " to
close the session. Each screen stays under 160 characters.

The farmer is identified by the phone number they dial from (Africa's Talking
sends it with every key press): the demo phone (AT_PHONE in backend/.env) holds
the demo policy AT_POLICY (RDI-RWA-1233 by default); any other number either has
a policy it signed up for, or gets the sign-up menu. The menu opens in
Kinyarwanda, with 5 for English; the Kinyarwanda text is a draft for a native
speaker to check.
"""

from dataclasses import dataclass

from .data import Dataset
from .messaging import SmsError, SmsGateway
from .policies import DISTRICT_CODES, MAX_AREA_M2, MIN_AREA_M2, CoverQuote, Policy, PolicyBook, phone_key
from .reports import ReportStore

CAUSE_KEYS = {"1": "drought", "2": "pests", "3": "flood", "4": "other"}
DISTRICTS = list(DISTRICT_CODES)
DISTRICT_LINES = "\n".join(f"{i}. {d}" for i, d in enumerate(DISTRICTS, 1))

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
        "join": "RDI Maize Insurance\nNo policy on this number yet.\n1. Buy cover\n5. Ikinyarwanda\n0. Exit",
        "districts": "Choose your district:\n" + DISTRICT_LINES + "\n0. Back",
        "area": "{district}\nEnter your maize field size in m2 ({min} to {max}):",
        "invalid": "Invalid answer.\n",
        "confirm": "{district}, {area} m2\nInsured value {cover}\nPremium {premium}/season\n1. Confirm\n0. Back",
        "joined": "Done. Your policy number is {policy}. We sent it to you by SMS.",
        "joined_no_sms": "Done. Your policy number is {policy}.",
        "joined_sms": "RDI Maize Insurance: your policy is {policy}. {district}, {area} m2, Season A {season}. Premium {premium}. Dial again to see your cover.",
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
        "join": "RDI Ubwishingizi bw'ibigori\nNta bwishingizi kuri iyi nimero.\n1. Gura ubwishingizi\n5. English\n0. Sohoka",
        "districts": "Hitamo akarere kawe:\n" + DISTRICT_LINES + "\n0. Subira inyuma",
        "area": "{district}\nAndika ubuso bw'umurima w'ibigori muri m2 ({min} kugeza {max}):",
        "invalid": "Igisubizo ntikemewe.\n",
        "confirm": "{district}, {area} m2\nAgaciro kishingiwe {cover}\nUmusanzu {premium}/igihembwe\n1. Emeza\n0. Subira inyuma",
        "joined": "Byakozwe. Nimero y'ubwishingizi bwawe ni {policy}. Twayikoherereje kuri SMS.",
        "joined_no_sms": "Byakozwe. Nimero y'ubwishingizi bwawe ni {policy}.",
        "joined_sms": "RDI Ubwishingizi: nimero yawe ni {policy}. {district}, {area} m2, Igihembwe A {season}. Umusanzu {premium}. Ongera ukande kode urebe ubwishingizi.",
    },
}


def rwf(v: float) -> str:
    return f"RWF {round(v):,}"


def signed(v: float) -> str:
    return f"{'+' if v > 0 else ''}{v:.1f}%"


def same_number(a: str, b: str) -> bool:
    """Compare phone numbers by their last nine digits (+250788... and 0788... match)."""
    return bool(a and b) and phone_key(a) == phone_key(b)


@dataclass(frozen=True)
class Session:
    """Where a USSD session is, replayed from Africa's Talking's `text`: the language and
    the path of choices. Sessions start in Kinyarwanda; on the main menu "5" switches
    language, elsewhere "0" goes back a screen and anything else goes forward."""

    lang: str
    path: tuple[str, ...]

    @classmethod
    def replay(cls, text: str) -> "Session":
        lang, path = "rw", []
        for answer in text.split("*") if text else []:
            if not path and answer == "5":
                lang = "en" if lang == "rw" else "rw"
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

    def respond(self, text: str, policy: Policy | None, phone: str = "") -> str:
        """The next screen. A caller without a policy gets the sign-up menu (or, when
        there is no number to sign up, as in the dashboard preview, a closing message)."""
        session = Session.replay(text)
        t = T[session.lang]
        path = session.path
        if policy is None:
            return self.sign_up(t, phone, path) if phone else "END " + t["no_policy"]
        if not path:
            return "CON " + t["menu"].format(district=policy.district, policy=policy.id)
        screens = {"1": self.cover, "2": self.this_season, "3": self.payouts, "4": self.report_loss}
        if path[0] == "0":
            return "END " + t["exit"]
        if path[0] not in screens:
            return "CON " + t["menu"].format(district=policy.district, policy=policy.id)
        return screens[path[0]](t, policy, path[1:], phone)

    def _season(self) -> int:
        """The season a policy covers: the one in progress, or else the next."""
        current = self.ds.current_season
        return current["season"] if current else max(s for (_, s) in self.ds.seasons) + 1

    def sign_up(self, t: dict, phone: str, path: tuple[str, ...]) -> str:
        """Buy cover: district, field size, confirm. A wrong answer repeats the question,
        so the answers are read in order and an invalid one is skipped."""
        if not path:
            return "CON " + t["join"]
        if path[0] == "0":
            return "END " + t["exit"]
        if path[0] != "1":
            return "CON " + t["join"]
        district, area, invalid = None, None, False
        for answer in path[1:]:
            if district is None:
                ok = answer.isdigit() and 1 <= int(answer) <= len(DISTRICTS)
                district = DISTRICTS[int(answer) - 1] if ok else None
            elif area is None:
                size = answer.replace(",", "").replace(" ", "")  # "1,250" as the screen writes it
                ok = size.isdigit() and MIN_AREA_M2 <= int(size) <= MAX_AREA_M2
                area = int(size) if ok else None
            else:
                ok = answer == "1"
                if ok:
                    return self._register(t, phone, district, area)
            invalid = not ok
        prefix = t["invalid"] if invalid else ""
        if district is None:
            return "CON " + prefix + t["districts"]
        if area is None:
            return "CON " + prefix + t["area"].format(district=district, min=MIN_AREA_M2, max=f"{MAX_AREA_M2:,}")
        quote = CoverQuote.for_policy(self.ds, Policy("", district, area))
        return "CON " + prefix + t["confirm"].format(district=district, area=f"{area:,}",
                                                     cover=rwf(quote.cover), premium=rwf(quote.premium))

    def _register(self, t: dict, phone: str, district: str, area: int) -> str:
        season = self._season()
        premium = CoverQuote.for_policy(self.ds, Policy("", district, area)).premium
        policy, _ = self.store.register(phone, district, area, season, premium)
        sms = t["joined_sms"].format(policy=policy.id, district=district, area=f"{area:,}",
                                     season=season, premium=rwf(premium))
        try:
            self.gateway.send(sms, to=phone)
            return "END " + t["joined"].format(policy=policy.id)
        except SmsError:
            return "END " + t["joined_no_sms"].format(policy=policy.id)

    def _with_sms(self, t: dict, body: str, rest: tuple[str, ...], phone: str) -> str:
        """A screen that offers to send itself by SMS; answering 1 sends it to the caller
        (to the demo phone when there is no caller, as in the dashboard preview)."""
        if rest and rest[0] == "1":
            try:
                self.gateway.send(body.replace("\n", ". "), to=phone)
                return "END " + t["sent"]
            except SmsError:
                return "END " + t["not_sent"]
        return "CON " + body + t["sms_option"]

    def cover(self, t: dict, policy: Policy, rest: tuple[str, ...], phone: str = "") -> str:
        quote = CoverQuote.for_policy(self.ds, policy)
        body = t["cover"].format(season=self._season(), area=f"{policy.area_m2:,}", district=policy.district,
                                 cover=rwf(quote.cover), premium=rwf(quote.premium), trigger=f"{self.ds.model.trigger:.0f}")
        return self._with_sms(t, body, rest, phone)

    def this_season(self, t: dict, policy: Policy, rest: tuple[str, ...], phone: str = "") -> str:
        current = self.ds.current_season
        if not current:
            return "END " + t["no_season"]
        d = next(x for x in current["districts"] if x["district"] == policy.district)
        rain = round(100 * d["rainMm"] / d["rainNormalMm"]) if d["rainNormalMm"] else 100
        state = "trigger" if d["payout"] > 0 else "watch" if d["rainZ"] <= -0.5 or d["ndviZ"] <= -0.5 else "normal"
        body = t["season"].format(season=current["season"], day=current["daysElapsed"], days=current["windowDays"],
                                  rain=rain, index=signed(d["index"]), state=t["states"][state])
        return self._with_sms(t, body, rest, phone)

    def payouts(self, t: dict, policy: Policy, rest: tuple[str, ...], phone: str = "") -> str:
        cover = CoverQuote.for_policy(self.ds, policy).cover
        seasons = sorted((s for (d, s) in self.ds.calibration if d == policy.district), reverse=True)[:3]
        lines = []
        for s in seasons:
            share = self.ds.calibration[(policy.district, s)].payout
            lines.append(t["paid"].format(season=s, amount=rwf(share * cover), share=f"{share:.0%}")
                         if share > 0 else t["none"].format(season=s))
        return self._with_sms(t, t["payouts"].format(lines="\n".join(lines)), rest, phone)

    def report_loss(self, t: dict, policy: Policy, rest: tuple[str, ...], phone: str = "") -> str:
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
