import json
import os
from collections import defaultdict
from urllib.parse import parse_qs

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, RedirectResponse

from . import data, messaging, reports, ussd
from .schemas import (
    BasisRisk,
    Coefficients,
    HistoryPoint,
    LossReportIn,
    LossReportOut,
    ModelSummary,
    PlotLoss,
    PricingInputs,
    ReportCount,
    SmsIn,
    SmsStatus,
    Simulation,
    ValidationRow,
)

app = FastAPI(
    title="Drought Index Simulator API",
    description="Parametric drought-index insurance simulator, Season A maize, Eastern Rwanda.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _calibration_simulation(row: data.CalibrationRow) -> Simulation:
    # Seasons with yield data use the leave-one-out index, so the comparison
    # with actual yield is honest (the model never saw that season).
    return Simulation(
        district=row.district,
        season=row.season,
        rain_z=row.rain_z,
        ndvi_z=row.ndvi_z,
        index=row.index_loo,
        payout=row.payout,
        actual_yield_anom=row.yield_anom,
        payout_if_actual=row.payout_if_actual,
    )


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse("/docs")


@app.get("/api/health")
def health() -> dict:
    ds = data.load()
    return {"status": "ok", "seasons": len(ds.seasons), "calibration": len(ds.calibration)}


@app.get("/api/model", response_model=ModelSummary)
def get_model() -> ModelSummary:
    ds = data.load()
    meta = ds.meta
    rain, ndvi = ds.model.coefficients
    return ModelSummary(
        model=ds.model.name,
        coefficients=Coefficients(rain_z=rain, ndvi_z=ndvi),
        trigger=ds.model.trigger,
        exit=ds.model.exit,
        low_yield_threshold=meta["low_yield_threshold"],
        hit_rate=meta["hit_rate"],
        false_payout_rate=meta["false_payout_rate"],
        validation=[
            ValidationRow(
                scheme=v["Validation"],
                model=v["Model"],
                rmse=v["RMSE"],
                mae=v["MAE"],
                r2=v["Predictive R2"],
            )
            for v in meta["validation_main"]
        ],
        pricing_inputs=PricingInputs(**meta["pricing_inputs"]),
    )


@app.get("/api/simulate", response_model=Simulation)
def simulate(district: str = Query(...), season: int = Query(...)) -> Simulation:
    ds = data.load()
    if (district, season) in ds.calibration:
        return _calibration_simulation(ds.calibration[(district, season)])

    row = ds.seasons.get((district, season))
    if row is None:
        if district not in ds.districts:
            raise HTTPException(404, f"Unknown district: {district}")
        raise HTTPException(404, f"No satellite data for {district} Season A {season}")

    index = ds.model.predict(row.rain_z, row.ndvi_z)
    return Simulation(
        district=row.district,
        season=row.season,
        rain_z=row.rain_z,
        ndvi_z=row.ndvi_z,
        index=index,
        payout=ds.model.payout(index),
        actual_yield_anom=None,
        payout_if_actual=None,
    )


@app.get("/api/history", response_model=list[HistoryPoint])
def history() -> list[HistoryPoint]:
    # Backtest on satellite data alone, using the model fitted on all 21
    # observations for every year (as in the notebook's drought-year check).
    ds = data.load()
    points = []
    for row in sorted(ds.seasons.values(), key=lambda r: (r.window_year, r.district)):
        index = ds.model.predict(row.rain_z, row.ndvi_z)
        points.append(
            HistoryPoint(
                window_year=row.window_year,
                district=row.district,
                rain_z=row.rain_z,
                ndvi_z=row.ndvi_z,
                index=index,
                payout=ds.model.payout(index),
                pays=index <= ds.model.trigger,
                drought_year=row.drought_year,
            )
        )
    return points


@app.get("/api/basis-risk", response_model=list[BasisRisk])
def basis_risk() -> list[BasisRisk]:
    ds = data.load()
    gaps: dict[str, list[float]] = defaultdict(list)
    for row in ds.calibration.values():
        gaps[row.district].append(row.basis_risk)
    return [BasisRisk(district=d, basis_risk=sum(g) / len(g)) for d, g in sorted(gaps.items())]


@app.get("/api/current-season")
def current_season() -> FileResponse:
    """The Season A window in progress: a provisional index from near-real-time data
    (notebook/update_current_season.py), and how far such an early read can be trusted."""
    path = data.DATA_DIR / "current_season.json"
    if not path.exists():
        raise HTTPException(404, "No season monitor yet; run notebook/update_current_season.py")
    return FileResponse(path, media_type="application/json")


def _current_season() -> int | None:
    path = data.DATA_DIR / "current_season.json"
    return json.loads(path.read_text())["season"] if path.exists() else None


@app.post("/api/loss-reports", response_model=LossReportOut, status_code=201)
def report_loss(body: LossReportIn) -> LossReportOut:
    """A farmer reports a crop loss. Reports count towards a field check for the district-season."""
    ds = data.load()
    if body.district not in ds.districts:
        raise HTTPException(422, f"Unknown district: {body.district}")
    if (body.district, body.season) not in ds.seasons and body.season != _current_season():
        raise HTTPException(422, f"No Season A {body.season} to report on")
    created = reports.add(body.policy_id, body.district, body.season)
    total = next((n for d, s, n in reports.summary() if d == body.district and s == body.season), 0)
    return LossReportOut(created=created, reports=total)


@app.get("/api/loss-reports/summary", response_model=list[ReportCount])
def loss_report_summary() -> list[ReportCount]:
    """Crop-loss reports on file, per district-season."""
    return [ReportCount(district=d, season=s, reports=n, causes=reports.causes(d, s)) for d, s, n in reports.summary()]


@app.get("/api/plot-losses", response_model=list[PlotLoss])
def plot_losses() -> list[PlotLoss]:
    """Share of NISR-surveyed farms that lost more than half their expected maize harvest."""
    return [
        PlotLoss(district=p.district, season=p.season, plots=p.plots, severe_loss_share=p.severe_loss_share)
        for p in data.load().plot_losses
    ]


@app.get("/api/sms/status", response_model=SmsStatus)
def sms_status() -> SmsStatus:
    """Whether SMS through Africa's Talking is set up (backend/.env), without revealing the key."""
    return SmsStatus(configured=messaging.configured(), sandbox=messaging.sandbox(), phone=messaging.masked_phone())


@app.post("/api/sms")
def send_sms(body: SmsIn) -> dict:
    """Send a payout message to the demo phone through Africa's Talking."""
    if not messaging.configured():
        raise HTTPException(503, "SMS is not set up: add AT_USERNAME, AT_API_KEY and AT_PHONE to backend/.env")
    try:
        return messaging.send_sms(body.message) | {"phone": messaging.masked_phone(), "sandbox": messaging.sandbox()}
    except messaging.SmsError as e:
        raise HTTPException(502, str(e)) from e


@app.post("/api/ussd", response_class=PlainTextResponse)
async def ussd_callback(request: Request) -> str:
    """Africa's Talking calls this on every key press of a USSD session; the reply is the next screen.

    The form (sessionId, serviceCode, phoneNumber, text) is parsed with the standard
    library, so the backend needs no extra form-parsing package."""
    form = parse_qs((await request.body()).decode(), keep_blank_values=True)
    return ussd.respond(form.get("text", [""])[0], form.get("phoneNumber", [""])[0])


@app.get("/api/geo/districts")
def district_shapes() -> FileResponse:
    """District boundaries (FAO GAUL 2025, simplified) for the dashboard map."""
    path = data.DATA_DIR / "eastern_districts.geojson"
    if not path.exists():
        raise HTTPException(404, "District shapes not exported; run the notebook's Section 3")
    return FileResponse(path, media_type="application/geo+json")


@app.get("/api/seasons", response_model=list[Simulation])
def seasons() -> list[Simulation]:
    ds = data.load()
    rows = sorted(ds.calibration.values(), key=lambda r: (r.season, r.district))
    return [_calibration_simulation(r) for r in rows]
