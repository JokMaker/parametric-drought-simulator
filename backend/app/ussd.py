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

import json
import os

from . import data, messaging, reports

DISTRICTS = ["Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"]
CODES = {"Bugesera": "BUG", "Gatsibo": "GAT", "Kayonza": "KAY", "Kirehe": "KIR", "Ngoma": "NGO", "Nyagatare": "NYA", "Rwamagana": "RWA"}
LOADING, SUBSIDY = 0.3, 0.4  # the dashboard's default terms
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
        "back": "\n0. Back",
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
        "back": "\n0. Subira inyuma",
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


def demo_policies() -> dict[str, tuple[str, int]]:
    """The dashboard's synthetic demo policies: id -> (district, maize area in m2)."""
    out = {}
    for d, district in enumerate(DISTRICTS):
        for k in (1, 2):
            pid = f"RDI-{CODES[district]}-{1000 + d * 37 + k * 11:04d}"
            out[pid] = (district, 600 + d * 40 if k == 1 else 2_500 + d * 150)
    return out


def rwf(v: float) -> str:
    return f"RWF {round(v):,}"


def signed(v: float) -> str:
    return f"{'+' if v > 0 else ''}{v:.1f}%"


def _digits(phone: str) -> str:
    return "".join(c for c in phone if c.isdigit())[-9:]


def policy_for(phone: str) -> str | None:
    """The demo policy belongs to the demo phone (AT_PHONE); other numbers have none."""
    demo_phone = messaging.settings()["AT_PHONE"]
    if demo_phone and _digits(phone) == _digits(demo_phone):
        return os.environ.get("AT_POLICY", "RDI-RWA-1233")
    return None


def _payout_record(ds: data.Dataset, district: str) -> list[float]:
    """Payout share per season: leave-one-out where there is harvest data, as on the dashboard."""
    shares = []
    for (d, season), row in ds.seasons.items():
        if d != district:
            continue
        cal = ds.calibration.get((d, season))
        shares.append(cal.payout if cal else ds.model.payout(ds.model.predict(row.rain_z, row.ndvi_z)))
    return shares


def _current() -> dict | None:
    path = data.DATA_DIR / "current_season.json"
    return json.loads(path.read_text()) if path.exists() else None


def _replay(text: str) -> tuple[str, list[str]]:
    """Replay the answers so far. On the main menu "5" switches language; elsewhere
    "0" goes back a screen and anything else goes forward."""
    lang, path = "en", []
    for a in text.split("*") if text else []:
        if not path and a == "5":
            lang = "rw" if lang == "en" else "en"
        elif a == "0" and path:
            path.pop()
        else:
            path.append(a)
    return lang, path


def respond(text: str, phone: str = "") -> str:
    lang, path = _replay(text)
    t = T[lang]

    policy_id = policy_for(phone)
    if policy_id is None:
        return "END " + t["no_policy"]

    ds = data.load()
    district, area_m2 = demo_policies()[policy_id]
    p = ds.meta["pricing_inputs"]
    ha = area_m2 / 10_000
    cover = p["expected_yield_kg_ha"][district] * p["maize_price_rwf_kg"] * abs(ds.model.exit) / 100 * ha
    record = _payout_record(ds, district)
    premium = cover * (sum(record) / len(record)) * (1 + LOADING) * (1 - SUBSIDY)
    current = _current()
    trigger = f"{ds.model.trigger:.0f}"

    def sms_screen(body: str) -> str:
        # A screen that offers to send itself by SMS; answering 1 sends it.
        if len(path) > 1 and path[1] == "1":
            try:
                messaging.send_sms(body.replace("\n", ". "))
                return "END " + t["sent"]
            except messaging.SmsError:
                return "END " + t["not_sent"]
        return "CON " + body + t["sms_option"]

    if not path:
        return "CON " + t["menu"].format(district=district, policy=policy_id)
    choice = path[0]

    if choice == "1":
        season = current["season"] if current else max(s for (_, s) in ds.seasons) + 1
        return sms_screen(t["cover"].format(season=season, area=f"{area_m2:,}", district=district,
                                            cover=rwf(cover), premium=rwf(premium), trigger=trigger))
    if choice == "2":
        if not current:
            return "END " + t["no_season"]
        d = next(x for x in current["districts"] if x["district"] == district)
        rain = round(100 * d["rainMm"] / d["rainNormalMm"]) if d["rainNormalMm"] else 100
        state = "trigger" if d["payout"] > 0 else "watch" if d["rainZ"] <= -0.5 or d["ndviZ"] <= -0.5 else "normal"
        return sms_screen(t["season"].format(season=current["season"], day=current["daysElapsed"], days=current["windowDays"],
                                             rain=rain, index=signed(d["index"]), state=t["states"][state]))
    if choice == "3":
        seasons = sorted((s for (dd, s) in ds.calibration if dd == district), reverse=True)[:3]
        lines = []
        for s in seasons:
            row = ds.calibration[(district, s)]
            lines.append(t["paid"].format(season=s, amount=rwf(row.payout * cover), share=f"{row.payout:.0%}")
                         if row.payout > 0 else t["none"].format(season=s))
        return sms_screen(t["payouts"].format(lines="\n".join(lines)))
    if choice == "4":
        if not current:
            return "END " + t["no_season"]
        if len(path) == 1:
            return "CON " + t["cause"]
        cause = CAUSE_KEYS.get(path[1])
        if cause is None:
            return "CON " + t["cause"]
        season = current["season"]
        created = reports.add(policy_id, district, season, cause)
        n = next((c for d, s, c in reports.summary() if d == district and s == season), 0)
        if created:
            return "END " + t["thanks"].format(cause=t["causes"][cause], n=n, district=district, season=season)
        return "END " + t["already"].format(n=n, district=district)
    if choice == "0":
        return "END " + t["exit"]
    return "CON " + t["menu"].format(district=district, policy=policy_id)
