"""Checks the API against the notebook's published results."""

import csv
import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app import data
from app.dependencies import get_gateway, get_sms_settings, get_store
from app.main import app
from app.messaging import (
    LiveGateway,
    SandboxGateway,
    SmsError,
    SmsGateway,
    SmsSettings,
    UnconfiguredGateway,
    gateway_for,
    sms_parts,
)
from app.reports import PostgresStore, SqliteStore
from app.ussd import Session

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


def test_health_answers_uptime_monitors():
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.head("/api/health").status_code == 200


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


# Fixtures inject test versions of the API's building blocks through FastAPI's
# dependency overrides, so no test touches the real database, .env or Africa's Talking.

DEMO_PHONE = "+250700000001"


@pytest.fixture(autouse=True)
def report_db(tmp_path):
    """A fresh, temporary report store for every test, so none reaches the real
    database (DATABASE_URL in backend/.env)."""
    store = SqliteStore(tmp_path / "loss_reports.sqlite3")
    app.dependency_overrides[get_store] = lambda: store
    yield store
    app.dependency_overrides.pop(get_store, None)


class FakeGateway(SmsGateway):
    """Records messages instead of sending them."""

    def __init__(self, settings):
        super().__init__(settings)
        self.sent = []
        self.recipients = []

    def send(self, message, to=""):
        self.sent.append(message)
        self.recipients.append(to or self.settings.phone)
        return {"status": "Success", "parts": sms_parts(message)}


@pytest.fixture
def gateway(report_db):
    """Sandbox settings with a test phone, and a gateway that never sends."""
    settings = SmsSettings(username="sandbox", api_key="k", phone=DEMO_PHONE)
    gateway = FakeGateway(settings)
    app.dependency_overrides[get_sms_settings] = lambda: settings
    app.dependency_overrides[get_gateway] = lambda: gateway
    yield gateway
    app.dependency_overrides.pop(get_sms_settings, None)
    app.dependency_overrides.pop(get_gateway, None)


@pytest.fixture
def demo_phone(gateway):
    """The messages the fake gateway has sent."""
    return gateway.sent


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


def ussd(text, phone=DEMO_PHONE):
    r = client.post("/api/ussd", data={"sessionId": "s1", "serviceCode": "*384*1#", "phoneNumber": phone, "text": text})
    assert r.status_code == 200
    return r.text


@pytest.mark.parametrize(
    "text,starts,contains",
    [
        ("", "CON", "1. Ubwishingizi bwanjye"),  # opens in Kinyarwanda
        ("1", "CON", "Agaciro kishingiwe RWF"),
        ("2", "CON", "Imvura:"),
        ("3", "CON", "Ingurane wahawe"),
        ("4", "CON", "Ni iki cyangije imyaka?"),
        ("1*0", "CON", "1. Ubwishingizi bwanjye"),  # back to the menu
        ("0", "END", "Murakoze"),
        ("5", "CON", "1. My cover"),             # English
        ("5*1", "CON", "Insured value RWF"),
        ("5*2", "CON", "Rain so far"),
        ("5*3", "CON", "Your payouts"),
        ("5*4", "CON", "What damaged your crop?"),
        ("5*4*0", "CON", "1. My cover"),
        ("5*0", "END", "Thank you for using"),   # exit from the English menu
        ("5*5", "CON", "1. Ubwishingizi bwanjye"),  # and back to Kinyarwanda
    ],
)
def test_ussd_menu(demo_phone, text, starts, contains):
    reply = ussd(text)
    assert reply.startswith(starts) and contains in reply


def test_ussd_screens_fit_a_phone(demo_phone):
    for text in ["", "1", "2", "3", "4", "5", "5*1", "5*2", "5*3", "5*4"]:
        assert len(ussd(text)) <= 182, text


NEW_PHONE = "+250788000000"


def test_ussd_unknown_number_is_offered_cover(demo_phone):
    assert ussd("", phone=NEW_PHONE).startswith("CON RDI Ubwishingizi bw'ibigori\nNta bwishingizi")
    assert "1. Buy cover" in ussd("5", phone=NEW_PHONE)
    assert ussd("0", phone=NEW_PHONE).startswith("END Murakoze")


@pytest.mark.parametrize(
    "text,contains",
    [
        ("5*1", "Choose your district:\n1. Bugesera"),
        ("5*1*3", "Kayonza\nEnter your maize field size in m2 (50 to 100,000)"),
        ("5*1*9", "Invalid answer.\nChoose your district"),     # no district 9
        ("5*1*3*20", "Invalid answer.\nKayonza\nEnter"),       # below 50 m2
        ("5*1*3*abc", "Invalid answer.\nKayonza\nEnter"),
        ("5*1*3*20*1250", "Kayonza, 1,250 m2\nInsured value RWF"),  # a wrong answer, then a right one
        ("5*1*3*1,250", "Kayonza, 1,250 m2"),                    # written as the screen writes it
        ("5*1*3*1250*0", "Kayonza\nEnter"),                     # back from the confirmation
        ("1*3*1250", "Umusanzu RWF"),
    ],
)
def test_ussd_sign_up_screens(gateway, report_db, text, contains):
    reply = ussd(text, phone=NEW_PHONE)
    assert reply.startswith("CON") and contains in reply and len(reply) <= 182
    assert report_db.policies() == []  # nothing is saved before the farmer confirms


def test_ussd_sign_up_saves_the_policy_and_texts_the_caller(gateway, report_db):
    quote = ussd("5*1*3*1250", phone=NEW_PHONE)
    reply = ussd("5*1*3*1250*1", phone=NEW_PHONE)
    assert reply == "END Done. Your policy number is RDI-KAY-5001. We sent it to you by SMS."
    # The confirmation goes to the farmer's own number, as one SMS; the insurer (AT_PHONE) hears of it too.
    assert gateway.recipients == [NEW_PHONE, DEMO_PHONE]
    assert "RDI-KAY-5001" in gateway.sent[0] and sms_parts(gateway.sent[0]) == 1
    assert gateway.sent[1] == "RDI: new policy RDI-KAY-5001, Kayonza, 1,250 m2, premium RWF 749 a season."
    [saved] = client.get("/api/policies").json()
    assert saved["policyId"] == "RDI-KAY-5001" and saved["district"] == "Kayonza" and saved["areaM2"] == 1250
    assert saved["phone"] == "+250••••000"  # masked in the API
    assert f"RWF {round(saved['premium']):,}" in quote  # the premium quoted is the premium stored
    # Dialling again from the same number (in any format) opens the farmer's own menu.
    assert ussd("", phone="0788000000").startswith("CON RDI Ubwishingizi bw'ibigori\nKayonza RDI-KAY-5001")
    assert "Maize 1,250 m2 in Kayonza" in ussd("5*1", phone=NEW_PHONE)
    # A screen sent by SMS goes to the farmer who asked for it, not the demo phone.
    assert ussd("5*3*1", phone=NEW_PHONE) == "END Sent. Check your SMS messages."
    assert gateway.recipients[-1] == NEW_PHONE and "Your payouts" in gateway.sent[-1]
    assert ussd("5*4*1", phone=NEW_PHONE).startswith("END Thank you. Report received (drought)")


def test_ussd_sign_up_in_kinyarwanda_texts_in_kinyarwanda(gateway):
    assert ussd("1*7*600*1", phone=NEW_PHONE).startswith("END Byakozwe. Nimero y'ubwishingizi bwawe ni RDI-RWA-5001")
    assert gateway.sent[0].startswith("RDI Ubwishingizi: nimero yawe ni RDI-RWA-5001") and sms_parts(gateway.sent[0]) == 1


def test_ussd_sign_up_works_without_sms(report_db):
    app.dependency_overrides[get_sms_settings] = lambda: SmsSettings()
    try:
        assert ussd("5*1*1*800*1", phone=NEW_PHONE) == "END Done. Your policy number is RDI-BUG-5001."
    finally:
        app.dependency_overrides.pop(get_sms_settings, None)


def test_store_keeps_one_policy_per_number(store):
    first, created = store.register("+250788111222", "Ngoma", 900, 2026, 400.0)
    assert created and first.id == "RDI-NGO-5001"
    again, created = store.register("0788111222", "Kirehe", 3000, 2026, 900.0)
    assert not created and again == first
    second, _ = store.register("+250788333444", "Kirehe", 3000, 2026, 900.0)
    assert second.id == "RDI-KIR-5002" and store.policy("RDI-KIR-5002") == second
    assert store.policy_for_phone("+250 788 111 222") == first and store.policy_for_phone("+250700000009") is None
    with pytest.raises(ValueError):
        store.register("+250788555666", "Nowhere", 900, 2026, 400.0)


def test_ussd_matches_the_number_in_any_format(demo_phone):
    assert ussd("", phone="0700000001").startswith("CON RDI Ubwishingizi")


def test_ussd_sends_a_screen_by_sms(demo_phone):
    assert ussd("5*1*1") == "END Sent. Check your SMS messages."
    assert "Insured value RWF" in demo_phone[0] and "\n" not in demo_phone[0]


def test_ussd_report_saves_the_cause(demo_phone):
    reply = ussd("5*4*2")
    assert reply.startswith("END Thank you") and "(pests or disease)" in reply and "1 report(s) for Rwamagana" in reply
    assert ussd("5*4*1").startswith("END You have already reported")
    season = client.get("/api/current-season").json()["season"]
    assert client.get("/api/loss-reports/summary").json() == [
        {"district": "Rwamagana", "season": season, "reports": 1, "causes": {"pests": 1}}]


def test_ussd_preview_runs_the_same_menu(report_db):
    def preview(text, policy="RDI-KAY-1085"):
        return client.post("/api/ussd/preview", json={"text": text, "policyId": policy})

    assert preview("").json()["reply"].startswith("CON RDI Ubwishingizi bw'ibigori\nKayonza RDI-KAY-1085")
    assert "Your payouts" in preview("5*3").json()["reply"]
    assert preview("5*4*1").json()["reply"].startswith("END Thank you. Report received (drought)")
    assert preview("", policy="RDI-XXX-0000").status_code == 422
    # A policy a farmer signed up for can be previewed too.
    report_db.register("+250788000000", "Ngoma", 900, 2026, 400.0)
    assert preview("", policy="RDI-NGO-5001").json()["reply"].startswith("CON RDI Ubwishingizi bw'ibigori\nNgoma RDI-NGO-5001")


def test_session_replays_back_and_language():
    assert Session.replay("") == Session("rw", ())
    assert Session.replay("1*0*3") == Session("rw", ("3",))
    assert Session.replay("5*2") == Session("en", ("2",))
    assert Session.replay("5*5") == Session("rw", ())


@pytest.fixture(params=["sqlite", "postgres"])
def store(request, tmp_path):
    """Each store test runs on SQLite and, when TEST_DATABASE_URL names a Postgres
    database, on Postgres too, in a schema of its own that is dropped afterwards."""
    if request.param == "sqlite":
        yield SqliteStore(tmp_path / "r.sqlite3")
        return
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is not set")
    import psycopg
    from psycopg.conninfo import make_conninfo

    schema = f"test_{uuid.uuid4().hex[:12]}"
    with psycopg.connect(url, autocommit=True) as con:
        con.execute(f"CREATE SCHEMA {schema}")
    store = PostgresStore(make_conninfo(url, options=f"-c search_path={schema}"))
    try:
        yield store
    finally:
        store.pool.close()
        with psycopg.connect(url, autocommit=True) as con:
            con.execute(f"DROP SCHEMA {schema} CASCADE")


def test_store_reset_and_causes(store):
    store.add("RDI-RWA-1233", "Rwamagana", 2019, "drought")
    store.add("RDI-RWA-1244", "Rwamagana", 2019, "pests")
    assert store.count("Rwamagana", 2019) == 2 and store.causes("Rwamagana", 2019) == {"drought": 1, "pests": 1}
    with pytest.raises(ValueError):
        store.add("RDI-BUG-1011", "Bugesera", 2019, "locusts")
    assert store.clear() == 2 and store.summary() == []
    store.log_sms(1, live=True)
    store.log_sms(2, live=False)  # the sandbox is not counted
    assert store.live_sms_today() == 1


def test_sms_status_hides_the_key():
    s = client.get("/api/sms/status").json()
    assert set(s) == {"configured", "sandbox", "phone"}


def test_sms_parts_counts_like_a_phone():
    assert sms_parts("x" * 160) == 1 and sms_parts("x" * 161) == 2
    # One character outside the GSM alphabet switches the whole message to 70 per SMS.
    assert sms_parts("07•• ••• 185 " + "x" * 60) == 2


class RecordingTransport:
    """Stands in for the HTTP call to Africa's Talking."""

    def __init__(self, status="Success"):
        self.calls = []
        self.status = status

    def __call__(self, url, fields, headers):
        self.calls.append((url, fields))
        return {"SMSMessageData": {"Recipients": [{"status": self.status, "cost": "RWF 12", "messageId": "x"}]}}


def test_gateway_for_picks_the_right_class(tmp_path):
    store = SqliteStore(tmp_path / "r.sqlite3")
    assert isinstance(gateway_for(SmsSettings(), store), UnconfiguredGateway)
    assert isinstance(gateway_for(SmsSettings("sandbox", "k", "+250700000001"), store), SandboxGateway)
    assert isinstance(gateway_for(SmsSettings("my-live-app", "k", "+250700000001"), store), LiveGateway)


def test_sandbox_gateway_sends_to_the_sandbox_host(tmp_path):
    transport = RecordingTransport()
    gateway = SandboxGateway(SmsSettings("sandbox", "k", "+250700000001"), SqliteStore(tmp_path / "r.sqlite3"), transport)
    assert gateway.send("x" * 200)["parts"] == 2  # the sandbox allows long messages
    url, fields = transport.calls[0]
    assert url.startswith("https://api.sandbox.africastalking.com") and "from" not in fields


def test_live_gateway_limits(tmp_path):
    store = SqliteStore(tmp_path / "r.sqlite3")
    transport = RecordingTransport()
    gateway = LiveGateway(SmsSettings("my-live-app", "k", "+250700000000", daily_limit=2), store, transport)
    # Too long for one SMS: refused before anything is sent.
    with pytest.raises(SmsError, match="billed as 2 SMS"):
        gateway.send("x" * 200)
    # Daily limit reached: refused before anything is sent.
    store.log_sms(2, live=True)
    with pytest.raises(SmsError, match="daily limit"):
        gateway.send("short")
    assert transport.calls == []


def test_live_gateway_uses_the_sender_id(tmp_path):
    transport = RecordingTransport()
    gateway = LiveGateway(SmsSettings("my-live-app", "k", "+250700000000", sender_id="RDIMaize"),
                          SqliteStore(tmp_path / "r.sqlite3"), transport)
    assert gateway.send("short")["status"] == "Success"
    url, fields = transport.calls[0]
    assert url.startswith("https://api.africastalking.com") and fields["from"] == "RDIMaize" and fields["to"] == "+250700000000"


def test_rejected_message_raises(tmp_path):
    gateway = SandboxGateway(SmsSettings("sandbox", "k", "+250700000001"), SqliteStore(tmp_path / "r.sqlite3"),
                             RecordingTransport(status="Rejected"))
    with pytest.raises(SmsError, match="Rejected"):
        gateway.send("short")


def test_unconfigured_sms_returns_503():
    app.dependency_overrides[get_sms_settings] = lambda: SmsSettings()
    try:
        assert client.post("/api/sms", json={"message": "hello"}).status_code == 503
    finally:
        app.dependency_overrides.pop(get_sms_settings, None)
