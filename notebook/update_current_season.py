"""Season monitor: a provisional drought index for the Season A window in progress.

The model's own inputs (CHIRPS rainfall, MODIS MOD13Q1 greenness) are final products
published weeks after the fact, so they settle payouts. While the October-December
window is still open, this script follows the season with near-real-time data:

- rainfall: NASA GPM IMERG V07 (about two days behind),
- greenness: NDVI from MODIS MOD09GA daily surface reflectance, cloud-masked.

Each district's total so far is compared with the same calendar days in every season
since 2001, turned into z-scores and passed through the saved model (backend/data/
model.json). The script also replays every past season at the same point in its window
and compares that early read with the season's final index, so the dashboard can say
how far an early read can be trusted.

Run from the repository root, with the notebook's environment:
    python notebook/update_current_season.py               # daily refresh, about a minute
    python notebook/update_current_season.py --skill-curve # also redo the reliability curve, a few minutes
It writes backend/data/current_season.json, which the API serves at /api/current-season.
"""

import datetime as dt
import json
import sys
from pathlib import Path

import ee
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
EXPORT = ROOT / "backend" / "data"
DISTRICTS = ["Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"]
FIRST_SEASON = 2001
WINDOW = (10, 12)  # October-December of the year before the Season A harvest

ee.Initialize(project="rwanda-drought-index")
districts = (ee.FeatureCollection("FAO/GAUL/2025/level2")
             .filter(ee.Filter.eq("ISO3_CODE", "RWA"))
             .filter(ee.Filter.inList("GAUL2_NAME", DISTRICTS)))
cropland = ee.ImageCollection("ESA/WorldCover/v200").first().select("Map").eq(40)
imerg = ee.ImageCollection("NASA/GPM_L3/IMERG_V07").select("precipitation")  # mm/hr, half-hourly
mod09 = ee.ImageCollection("MODIS/061/MOD09GA")


def latest(coll):
    t = coll.sort("system:time_start", False).first().get("system:time_start").getInfo()
    return dt.datetime.fromtimestamp(t / 1000, dt.UTC).date()


def ndvi_clear(img):
    """Daily NDVI with cloud and cloud-shadow pixels removed (MOD09GA state_1km bits 0-2)."""
    state = img.select("state_1km")
    clear = state.bitwiseAnd(3).eq(0).And(state.bitwiseAnd(4).eq(0))
    return img.normalizedDifference(["sur_refl_b02", "sur_refl_b01"]).rename("ndvi").updateMask(clear)


def window_for(today):
    """The Season A window that is open, or the last one to close."""
    year = today.year if today.month >= WINDOW[0] else today.year - 1
    start = dt.date(year, WINDOW[0], 1)
    end = dt.date(year, WINDOW[1], 31)
    return year + 1, start, end


def extract(days):
    """Rainfall total and mean NDVI over the first `days` days of every window since 2001."""
    seasons = ee.List.sequence(FIRST_SEASON, SEASON)

    def per_season(y):
        y = ee.Number(y)
        start = ee.Date.fromYMD(y.subtract(1), WINDOW[0], 1)
        end = start.advance(days, "day")
        rain = imerg.filterDate(start, end).sum().multiply(0.5).rename("rain")  # half-hourly mm/hr -> mm
        ndvi = mod09.filterDate(start, end).map(ndvi_clear).mean().rename("ndvi")
        img = rain.addBands(ndvi).updateMask(cropland)
        fc = img.reduceRegions(collection=districts, reducer=ee.Reducer.mean(), scale=500)
        return fc.map(lambda f: f.set("season", y))

    feats = ee.FeatureCollection(seasons.map(per_season)).flatten().getInfo()["features"]
    return pd.DataFrame([{"district": f["properties"]["GAUL2_NAME"], "season": int(f["properties"]["season"]),
                          "rain_mm": f["properties"].get("rain"), "ndvi": f["properties"].get("ndvi")} for f in feats])


today = dt.date.today()
SEASON, WIN_START, WIN_END = window_for(today)
rain_last, ndvi_last = latest(imerg), latest(mod09)
as_of = min(rain_last, ndvi_last, WIN_END)
days = (as_of - WIN_START).days + 1
window_days = (WIN_END - WIN_START).days + 1
if days < 1:
    raise SystemExit(f"No near-real-time data inside the {WIN_START}–{WIN_END} window yet (latest {as_of}).")
OUT = EXPORT / "current_season.json"
previous = json.loads(OUT.read_text()) if OUT.exists() else {}
if previous.get("season") == SEASON and previous.get("asOf") == as_of.isoformat() and "--skill-curve" not in sys.argv:
    print(f"No new data since {as_of} (day {days} of the window); nothing to update.")
    sys.exit(0)
print(f"Season A {SEASON}: window {WIN_START} to {WIN_END}; data to {as_of} "
      f"(rainfall {rain_last}, greenness {ndvi_last}), day {days} of {window_days}")

d = extract(days)
assert set(d["district"]) == set(DISTRICTS), "District names changed"
m = json.loads((EXPORT / "model.json").read_text())

def add_index(t):
    """z-scores per district across seasons, then the saved model and payout rule."""
    t = t.copy()
    t["rain_z"] = t.groupby("district")["rain_mm"].transform(lambda s: (s - s.mean()) / s.std(ddof=1))
    t["ndvi_z"] = t.groupby("district")["ndvi"].transform(lambda s: (s - s.mean()) / s.std(ddof=1))
    X = (t[["rain_z", "ndvi_z"]].to_numpy() - np.array(m["scaler_mean"])) / np.array(m["scaler_scale"])
    t["index"] = X @ np.array(m["coefficients"]) + m["intercept"]
    t["payout"] = np.clip((m["trigger"] - t["index"]) / (m["trigger"] - m["exit"]), 0, 1)
    return t


FINAL = pd.read_csv(EXPORT / "seasons.csv")[["district", "season", "index"]].rename(columns={"index": "final"})


def skill_at(t, day):
    """How well an early read on `day` matched each past season's final index."""
    past = t[t["season"] < SEASON].merge(FINAL, on=["district", "season"]).dropna(subset=["final"])
    early, final_pays = past["index"] <= m["trigger"], past["final"] <= m["trigger"]
    return {
        "day": int(day),
        "seasons": int(past["season"].nunique()),
        "correlation": round(float(past["index"].corr(past["final"])), 3),
        "agreement": round(float((early == final_pays).mean()), 3),
        "finalPaidCaught": round(float(early[final_pays].mean()), 3) if final_pays.any() else None,
    }


d = add_index(d)
skill = skill_at(d, days)
print(f"Early read on day {days} against the final index, {skill['seasons']} past seasons: "
      f"r = {skill['correlation']:.2f}, same pay / no-pay decision in {skill['agreement']:.0%}")

# The reliability curve: the same test at fixed points of the window. It only uses past
# seasons, so it is kept from the previous run unless asked for.
curve = previous.get("skillCurve")
if "--skill-curve" in sys.argv or not curve:
    curve = []
    for day in (15, 31, 46, 61, window_days):
        curve.append(skill_at(add_index(extract(day)), day))
        print(f"  day {day}: r = {curve[-1]['correlation']:.2f}, agreement {curve[-1]['agreement']:.0%}")

now = d[d["season"] == SEASON].set_index("district").loc[DISTRICTS]
normal = d[d["season"] < SEASON].groupby("district")[["rain_mm", "ndvi"]].median()
out = {
    "season": SEASON,
    "windowStart": WIN_START.isoformat(),
    "windowEnd": WIN_END.isoformat(),
    "asOf": as_of.isoformat(),
    "daysElapsed": days,
    "windowDays": window_days,
    "status": "open" if today <= WIN_END else "closed",
    "generatedAt": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"),
    "sources": {"rainfall": f"NASA GPM IMERG V07 (to {rain_last})",
                "greenness": f"MODIS MOD09GA daily NDVI, cloud-masked (to {ndvi_last})"},
    "skill": skill,
    "skillCurve": curve,
    "districts": [
        {"district": k, "rainMm": round(float(r["rain_mm"]), 1), "rainNormalMm": round(float(normal.loc[k, "rain_mm"]), 1),
         "rainZ": round(float(r["rain_z"]), 3), "ndvi": round(float(r["ndvi"]), 4),
         "ndviNormal": round(float(normal.loc[k, "ndvi"]), 4), "ndviZ": round(float(r["ndvi_z"]), 3),
         "index": round(float(r["index"]), 2), "payout": round(float(r["payout"]), 4)}
        for k, r in now.iterrows()
    ],
}
OUT.write_text(json.dumps(out, indent=1))
print(now[["rain_mm", "rain_z", "ndvi", "ndvi_z", "index", "payout"]].round(2).to_string())
print(f"Wrote {EXPORT / 'current_season.json'}")
