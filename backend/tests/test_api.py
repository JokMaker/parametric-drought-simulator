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


@pytest.fixture
def report_db(tmp_path, monkeypatch):
    """A fresh reports database for each test, so tests never touch real reports."""
    from app import reports

    monkeypatch.setattr(reports, "DB_PATH", tmp_path / "loss_reports.sqlite3")


def test_loss_reports_count_once_per_policy(report_db):
    report = {"policyId": "RDI-RWA-1233", "district": "Rwamagana", "season": 2019}
    r = client.post("/api/loss-reports", json=report)
    assert r.status_code == 201 and r.json() == {"created": True, "reports": 1}
    # The same farmer reporting again does not add to the count.
    assert client.post("/api/loss-reports", json=report).json() == {"created": False, "reports": 1}
    other = {**report, "policyId": "RDI-RWA-1244"}
    assert client.post("/api/loss-reports", json=other).json() == {"created": True, "reports": 2}
    assert client.get("/api/loss-reports/summary").json() == [
        {"district": "Rwamagana", "season": 2019, "reports": 2, "causes": {}}]


@pytest.mark.parametrize(
    "report",
    [
        {"policyId": "RDI-RWA-1233", "district": "Nowhere", "season": 2019},
        {"policyId": "RDI-RWA-1233", "district": "Rwamagana", "season": 1990},
        {"policyId": "not-a-policy", "district": "Rwamagana", "season": 2019},
    ],
)
def test_loss_reports_rejected(report_db, report):
    assert client.post("/api/loss-reports", json=report).status_code == 422


def test_loss_report_for_the_season_in_progress(report_db):
    season = client.get("/api/current-season").json()["season"]
    report = {"policyId": "RDI-BUG-1011", "district": "Bugesera", "season": season}
    assert client.post("/api/loss-reports", json=report).status_code == 201


def test_plot_losses():
    """Survey evidence for field checks, as the notebook exports it."""
    rows = client.get("/api/plot-losses").json()
    assert len(rows) == 56
    by = {(r["district"], r["season"]): r["severeLossShare"] for r in rows}
    # Season A 2019, the index's worst miss: about half of all surveyed farms lost half their harvest.
    assert all(by[(d, 2019)] > 0.45 for d in
               ["Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"])
    assert by[("Bugesera", 2023)] == pytest.approx(0.63, abs=0.01)


DEMO_PHONE = "+250700000001"


@pytest.fixture
def demo_phone(monkeypatch):
    """The USSD demo policy belongs to AT_PHONE; use a fixed test number, and never send real SMS."""
    from app import messaging

    monkeypatch.setattr(messaging, "settings", lambda: {
        "AT_USERNAME": "sandbox", "AT_API_KEY": "k", "AT_PHONE": DEMO_PHONE, "AT_DAILY_LIMIT": "", "AT_SENDER_ID": ""})
    sent = []
    monkeypatch.setattr(messaging, "send_sms", lambda message: sent.append(message) or {"status": "Success"})
    return sent


def ussd(text, phone=DEMO_PHONE):
    r = client.post("/api/ussd", data={"sessionId": "s1", "serviceCode": "*384*1#", "phoneNumber": phone, "text": text})
    assert r.status_code == 200
    return r.text


@pytest.mark.parametrize(
    "text,starts,contains",
    [
        ("", "CON", "1. My cover"),
        ("1", "CON", "Insured value RWF"),
        ("2", "CON", "Rain so far"),
        ("3", "CON", "Your payouts"),
        ("4", "CON", "What damaged your crop?"),
        ("1*0", "CON", "1. My cover"),          # back to the menu
        ("4*0", "CON", "1. My cover"),
        ("0", "END", "Thank you for using"),
        ("5", "CON", "Ubwishingizi bwanjye"),   # Kinyarwanda
        ("5*0", "END", "Murakoze"),             # exit from the Kinyarwanda menu
        ("5*5", "CON", "1. My cover"),          # and back to English
    ],
)
def test_ussd_menu(demo_phone, text, starts, contains):
    reply = ussd(text)
    assert reply.startswith(starts) and contains in reply


def test_ussd_screens_fit_a_phone(demo_phone):
    for text in ["", "1", "2", "3", "4", "5", "5*1", "5*2", "5*3", "5*4"]:
        assert len(ussd(text)) <= 182, text


def test_ussd_unknown_number_has_no_policy(demo_phone):
    assert ussd("", phone="+250788000000").startswith("END No RDI policy")


def test_ussd_sends_a_screen_by_sms(demo_phone):
    assert ussd("1*1") == "END Sent. Check your SMS messages."
    assert "Insured value RWF" in demo_phone[0] and "\n" not in demo_phone[0]


def test_ussd_report_saves_the_cause(report_db, demo_phone):
    reply = ussd("4*2")
    assert reply.startswith("END Thank you") and "(pests or disease)" in reply and "1 report(s) for Rwamagana" in reply
    assert ussd("4*1").startswith("END You have already reported")
    season = client.get("/api/current-season").json()["season"]
    assert client.get("/api/loss-reports/summary").json() == [
        {"district": "Rwamagana", "season": season, "reports": 1, "causes": {"pests": 1}}]


def test_reset_removes_reports(report_db):
    from app import reports

    reports.add("RDI-RWA-1233", "Rwamagana", 2019, "drought")
    assert reports.clear() == 1 and reports.summary() == []


def test_sms_status_hides_the_key():
    s = client.get("/api/sms/status").json()
    assert set(s) == {"configured", "sandbox", "phone"}


def test_sms_parts_counts_like_a_phone():
    from app.messaging import sms_parts

    assert sms_parts("x" * 160) == 1 and sms_parts("x" * 161) == 2
    # One character outside the GSM alphabet switches the whole message to 70 per SMS.
    assert sms_parts("07•• ••• 185 " + "x" * 60) == 2


def test_live_sms_is_limited(report_db, monkeypatch):
    from app import messaging

    monkeypatch.setattr(messaging, "settings", lambda: {
        "AT_USERNAME": "my-live-app", "AT_API_KEY": "k", "AT_PHONE": "+250700000000", "AT_DAILY_LIMIT": "2"})
    monkeypatch.setattr(messaging.urllib.request, "urlopen", lambda *a, **k: (_ for _ in ()).throw(AssertionError("must not send")))
    # Too long for one SMS: refused before anything is sent.
    with pytest.raises(messaging.SmsError, match="billed as 2 SMS"):
        messaging.send_sms("x" * 200)
    # Daily limit reached: refused before anything is sent.
    messaging.reports.log_sms(2, live=True)
    with pytest.raises(messaging.SmsError, match="daily limit"):
        messaging.send_sms("short")


def test_live_sms_uses_the_sender_id(report_db, monkeypatch):
    import io
    import json as jsonlib
    from urllib.parse import parse_qs

    from app import messaging

    monkeypatch.setattr(messaging, "settings", lambda: {
        "AT_USERNAME": "my-live-app", "AT_API_KEY": "k", "AT_PHONE": "+250700000000",
        "AT_DAILY_LIMIT": "20", "AT_SENDER_ID": "RDIMaize"})
    sent = {}

    def fake_urlopen(req, timeout):
        sent.update(parse_qs(req.data.decode()))
        reply = {"SMSMessageData": {"Recipients": [{"status": "Success", "cost": "RWF 12", "messageId": "x"}]}}
        return io.BytesIO(jsonlib.dumps(reply).encode())

    monkeypatch.setattr(messaging.urllib.request, "urlopen", fake_urlopen)
    assert messaging.send_sms("short")["status"] == "Success"
    assert sent["from"] == ["RDIMaize"] and sent["to"] == ["+250700000000"]
