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
    assert m["trigger"] == -7 and m["exit"] == -27 and m["lowYieldThreshold"] == -10
    assert round(m["hitRate"], 2) == 0.86 and round(m["falsePayoutRate"], 2) == 0.29
    assert m["coefficients"] == pytest.approx({"rain_z": 17.13, "ndvi_z": 1.61}, abs=0.01)
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
    s = client.get("/api/simulate", params={"district": "Kirehe", "season": 2022}).json()
    assert s["index"] == pytest.approx(-1.75, abs=0.01)
    assert s["payout"] == 0
    assert s["actualYieldAnom"] == pytest.approx(-40.76, abs=0.01)
    assert s["payoutIfActual"] == 1

    s = client.get("/api/simulate", params={"district": "Rwamagana", "season": 2023}).json()
    assert s["index"] == pytest.approx(-23.80, abs=0.01)
    assert s["payout"] == pytest.approx(0.84, abs=0.005)


def test_satellite_only_season():
    s = client.get("/api/simulate", params={"district": "Kirehe", "season": 2015}).json()
    assert s["actualYieldAnom"] is None and s["payoutIfActual"] is None
    assert 0 <= s["payout"] <= 1


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
    assert (sum(p["pays"] for p in drought), len(drought)) == (42, 63)
    assert (sum(p["pays"] for p in other), len(other)) == (39, 112)
    assert all((p["payout"] > 0) == (p["index"] < -7) for p in pts)


def test_basis_risk():
    br = {b["district"]: b["basisRisk"] for b in client.get("/api/basis-risk").json()}
    expected = {"Kirehe": 0.38, "Kayonza": 0.31, "Gatsibo": 0.26, "Bugesera": 0.25,
                "Nyagatare": 0.25, "Ngoma": 0.11, "Rwamagana": 0.03}
    assert br == pytest.approx(expected, abs=0.005)


def test_seasons_hit_and_false_payout_rates():
    rows = client.get("/api/seasons").json()
    assert len(rows) == 21
    poor = [r for r in rows if r["actualYieldAnom"] <= -10]
    other = [r for r in rows if r["actualYieldAnom"] > -10]
    assert (sum(r["index"] <= -7 for r in poor), len(poor)) == (6, 7)
    assert (sum(r["index"] <= -7 for r in other), len(other)) == (4, 14)


def test_cors_allows_frontend():
    r = client.get("/api/model", headers={"Origin": "http://localhost:3000"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"
