"""The USSD menu that Africa's Talking calls on every key press.

Africa's Talking sends the whole session's input so far as `text`, with answers
joined by "*" ("" on the first screen, "1" after choosing 1, "4*1" after
choosing 4 then 1). The reply starts with "CON " to wait for another answer or
"END " to close the session. The figures match the dashboard's USSD and Farmer
View pages for the same demo policy.
"""

import json
import os

from . import data, reports

DISTRICTS = ["Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"]
CODES = {"Bugesera": "BUG", "Gatsibo": "GAT", "Kayonza": "KAY", "Kirehe": "KIR", "Ngoma": "NGO", "Nyagatare": "NYA", "Rwamagana": "RWA"}
LOADING, SUBSIDY = 0.3, 0.4  # the dashboard's default terms


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


def respond(text: str) -> str:
    ds = data.load()
    policy_id = os.environ.get("AT_POLICY", "RDI-RWA-1233")
    district, area_m2 = demo_policies()[policy_id]
    p = ds.meta["pricing_inputs"]
    exit_ = ds.model.exit
    ha = area_m2 / 10_000
    value_ha = p["expected_yield_kg_ha"][district] * p["maize_price_rwf_kg"]
    cover = value_ha * abs(exit_) / 100 * ha
    record = _payout_record(ds, district)
    premium = cover * (sum(record) / len(record)) * (1 + LOADING) * (1 - SUBSIDY)
    current = _current()
    answers = [a for a in text.split("*") if a] if text else []

    if not answers:
        return (f"CON RDI Maize Insurance\n{district} {policy_id}\n1. My cover\n2. This season\n"
                "3. Last result\n4. Report a crop loss\n0. Exit")
    choice = answers[0]
    if choice == "1":
        return (f"END Maize area {area_m2:,} m2\nCover {rwf(cover)}\nYou pay {rwf(premium)}/season\n"
                f"Paid when the district index falls below {ds.model.trigger:.0f}%")
    if choice == "2":
        if not current:
            return "END No season in progress."
        d = next(x for x in current["districts"] if x["district"] == district)
        share = round(100 * d["rainMm"] / d["rainNormalMm"]) if d["rainNormalMm"] else 100
        return (f"END Season A {current['season']}, day {current['daysElapsed']} of {current['windowDays']}\n"
                f"Rain {share}% of normal\nIndex {signed(d['index'])} (provisional)\nFinal result after 31 Dec")
    if choice == "3":
        last = max(s for (d, s) in ds.calibration if d == district)
        row = ds.calibration[(district, last)]
        paid = f"Paid {row.payout:.0%}: {rwf(row.payout * cover)}" if row.payout > 0 else "No payout"
        return f"END Season A {last}\n{district} index {signed(row.index_loo)}\n{paid}"
    if choice == "4":
        if not current:
            return "END No season in progress to report on."
        if len(answers) == 1:
            return f"CON Report a crop loss for\nSeason A {current['season']}?\n1. Yes\n0. Back"
        if answers[1] == "1":
            created = reports.add(policy_id, district, current["season"])
            total = next((n for d, s, n in reports.summary() if d == district and s == current["season"]), 0)
            return (f"END Thank you. Report received.\n{total} report(s) for {district}." if created
                    else f"END You have already reported this season.\n{total} report(s) on file.")
        return respond("")
    if choice == "0":
        return "END Thank you for using RDI Maize Insurance."
    return respond("")
