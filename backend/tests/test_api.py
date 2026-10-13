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
    assert m["trigger"] == -4 and m["exit"] == -24 and m["lowYieldThreshold"] == -10
    assert round(m["hitRate"], 2) == 0.91 and round(m["falsePayoutRate"], 2) == 0.18
    assert m["coefficients"] == pytest.approx({"rain_z": 13.47, "ndvi_z": 9.91}, abs=0.01)
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
    # The missed season: the harvest fell 16%, the index did not pay.
    s = client.get("/api/simulate", params={"district": "Gatsibo", "season": 2022}).json()
    assert s["index"] == pytest.approx(-2.30, abs=0.01)
    assert s["payout"] == 0
    assert s["actualYieldAnom"] == pytest.approx(-16.29, abs=0.01)
    assert s["payoutIfActual"] == pytest.approx(0.61, abs=0.005)

    # The good catch: full payout, and the harvest justified it.
    s = client.get("/api/simulate", params={"district": "Rwamagana", "season": 2023}).json()
    assert s["index"] == pytest.approx(-34.22, abs=0.01)
    assert s["payout"] == 1 and s["payoutIfActual"] == 1

    s = client.get("/api/simulate", params={"district": "Bugesera", "season": 2024}).json()
    assert s["actualYieldAnom"] == pytest.approx(13.72, abs=0.01)


def test_satellite_only_season():
    # Drought year 2017 (2016 rains): satellite-only, full payout.
    s = client.get("/api/simulate", params={"district": "Kirehe", "season": 2017}).json()
    assert s["actualYieldAnom"] is None and s["payoutIfActual"] is None
    assert s["index"] == pytest.approx(-41.8, abs=0.1)
    assert s["payout"] == 1


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
    assert (sum(p["pays"] for p in drought), len(drought)) == (43, 63)
    assert (sum(p["pays"] for p in other), len(other)) == (43, 112)
    assert all((p["payout"] > 0) == (p["index"] < -4) for p in pts)


def test_basis_risk():
    br = {b["district"]: b["basisRisk"] for b in client.get("/api/basis-risk").json()}
    expected = {"Bugesera": 0.31, "Kirehe": 0.28, "Gatsibo": 0.25, "Nyagatare": 0.22,
                "Ngoma": 0.11, "Kayonza": 0.08, "Rwamagana": 0.00}
    assert br == pytest.approx(expected, abs=0.005)


def test_seasons_hit_and_false_payout_rates():
    rows = client.get("/api/seasons").json()
    assert len(rows) == 28
    assert {r["season"] for r in rows} == {2022, 2023, 2024, 2025}
    poor = [r for r in rows if r["actualYieldAnom"] <= -10]
    other = [r for r in rows if r["actualYieldAnom"] > -10]
    assert (sum(r["index"] <= -4 for r in poor), len(poor)) == (10, 11)
    assert (sum(r["index"] <= -4 for r in other), len(other)) == (3, 17)


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
