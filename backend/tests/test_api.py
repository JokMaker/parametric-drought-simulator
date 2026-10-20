"""Checks the API against the notebook's published results."""

import csv

import pytest
from fastapi.testclient import TestClient

from app import data
from app.main import app

client = TestClient(app)


def test_model_summary():
    m = client.get("/api/model").json()
    assert m["model"] == "Ridge"
    assert m["trigger"] == -2 and m["exit"] == -22 and m["lowYieldThreshold"] == -10
    assert round(m["hitRate"], 2) == 0.50 and round(m["falsePayoutRate"], 3) == 0.225
    assert m["coefficients"] == pytest.approx({"rain_z": 0.66, "ndvi_z": 9.17}, abs=0.01)
    assert len(m["validation"]) == 8


def test_formula_matches_exported_index():
    """The backend's scaler + coefficients reproduce seasons.csv's index."""
    ds = data.load()
    with open(data.DATA_DIR / "seasons.csv") as f:
        rows = [r for r in csv.DictReader(f) if r["index"]]
    assert len(rows) == 175
    for r in rows:
        predicted = ds.model.predict(float(r["rain_z"]), float(r["ndvi_z"]))
        # The CSV rounds z-scores to 4 decimals, so allow a small gap.
        assert predicted == pytest.approx(float(r["index"]), abs=0.01)


def test_calibration_season_uses_loo_index():
    # The missed season: the harvest fell 16% below trend, the index did not pay.
    s = client.get("/api/simulate", params={"district": "Gatsibo", "season": 2022}).json()
    assert s["index"] == pytest.approx(7.72, abs=0.01)
    assert s["payout"] == 0
    assert s["actualYieldAnom"] == pytest.approx(-15.67, abs=0.01)
    assert s["payoutIfActual"] == pytest.approx(0.68, abs=0.005)

    # The good catch: the index paid 57%, and the harvest justified a full payout.
    s = client.get("/api/simulate", params={"district": "Rwamagana", "season": 2023}).json()
    assert s["index"] == pytest.approx(-13.41, abs=0.01)
    assert s["payout"] == pytest.approx(0.57, abs=0.005) and s["payoutIfActual"] == 1

    # An older release (2019): the year the index missed most.
    s = client.get("/api/simulate", params={"district": "Rwamagana", "season": 2019}).json()
    assert s["actualYieldAnom"] == pytest.approx(-34.97, abs=0.01)
    assert s["payout"] == 0


def test_satellite_only_season():
    # Drought year 2017 (2016 rains): its yields are not used (imputed by NISR), so satellite-only.
    s = client.get("/api/simulate", params={"district": "Kirehe", "season": 2017}).json()
    assert s["actualYieldAnom"] is None and s["payoutIfActual"] is None
    assert s["index"] == pytest.approx(-19.0, abs=0.1)
    assert s["payout"] == pytest.approx(0.85, abs=0.005)


@pytest.mark.parametrize(
    "params,status",
    [
        ({"district": "Nowhere", "season": 2022}, 404),
        ({"district": "Kirehe", "season": 1990}, 404),  # before NDVI
        ({"district": "Kirehe"}, 422),
    ],
)
def test_simulate_errors(params, status):
    assert client.get("/api/simulate", params=params).status_code == status


def test_history_matches_drought_year_check():
    pts = client.get("/api/history").json()
    assert len(pts) == 175
    drought = [p for p in pts if p["droughtYear"]]
    other = [p for p in pts if not p["droughtYear"]]
    assert (sum(p["pays"] for p in drought), len(drought)) == (34, 63)
    assert (sum(p["pays"] for p in other), len(other)) == (26, 112)
    assert all((p["payout"] > 0) == (p["index"] < -2) for p in pts)


def test_basis_risk():
    br = {b["district"]: b["basisRisk"] for b in client.get("/api/basis-risk").json()}
    expected = {"Nyagatare": 0.33, "Kirehe": 0.29, "Ngoma": 0.27, "Gatsibo": 0.25,
                "Rwamagana": 0.21, "Bugesera": 0.20, "Kayonza": 0.18}
    assert br == pytest.approx(expected, abs=0.005)


def test_seasons_hit_and_false_payout_rates():
    rows = client.get("/api/seasons").json()
    assert len(rows) == 56
    assert {r["season"] for r in rows} == set(range(2018, 2026))
    poor = [r for r in rows if r["actualYieldAnom"] <= -10]
    other = [r for r in rows if r["actualYieldAnom"] > -10]
    assert (sum(r["index"] <= -2 for r in poor), len(poor)) == (8, 16)
    assert (sum(r["index"] <= -2 for r in other), len(other)) == (9, 40)


def test_current_season():
    s = client.get("/api/current-season").json()
    assert s["windowDays"] == 92 and 1 <= s["daysElapsed"] <= 92
    assert sorted(d["district"] for d in s["districts"]) == [
        "Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"]
    assert all(0 <= d["payout"] <= 1 for d in s["districts"])
    assert [c["day"] for c in s["skillCurve"]] == [15, 31, 46, 61, 92]


def test_district_shapes():
    r = client.get("/api/geo/districts")
    assert r.status_code == 200
    geo = r.json()
    assert geo["type"] == "FeatureCollection"
    names = sorted(f["properties"]["district"] for f in geo["features"])
    assert names == ["Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"]


def test_history_has_anomalies_for_tooltips():
    p = client.get("/api/history").json()[0]
    assert {"rainZ", "ndviZ", "index", "payout"} <= p.keys()


def test_cors_allows_frontend():
    r = client.get("/api/model", headers={"Origin": "http://localhost:3000"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_pricing_inputs():
    """What a farmer's maize is worth, as the notebook's Section 10b computes it."""
    p = client.get("/api/model").json()["pricingInputs"]
    assert p["season"] == 2025
    assert p["maizePriceRwfKg"] == 200
    assert p["priceByYear"] == {"2019": 150, "2020": 250, "2021": 200, "2022": 200}
    assert set(p["expectedYieldKgHa"]) == set(p["maizeAreaHa"]) == {
        "Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"}
    assert p["expectedYieldKgHa"]["Kayonza"] == pytest.approx(1581.8, abs=0.1)
    assert p["farmSizeHa"]["p50"] == pytest.approx(0.0624, abs=1e-4)
