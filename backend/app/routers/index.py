"""The drought index: model, per-season results, history, basis risk and the season monitor."""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse

from .. import data
from ..dependencies import get_dataset
from ..schemas import (
    BasisRisk,
    Coefficients,
    HistoryPoint,
    ModelSummary,
    PlotLoss,
    PricingInputs,
    Simulation,
    ValidationRow,
)

router = APIRouter(prefix="/api")


def _simulation(r: data.SeasonResult) -> Simulation:
    return Simulation(
        district=r.district, season=r.season, rain_z=r.rain_z, ndvi_z=r.ndvi_z, index=r.index,
        payout=r.payout, actual_yield_anom=r.actual_yield_anom, payout_if_actual=r.payout_if_actual,
    )


@router.get("/health", tags=["Service"], summary="Check the API is up")
def health(ds: data.Dataset = Depends(get_dataset)) -> dict:
    return {"status": "ok", "seasons": len(ds.seasons), "calibration": len(ds.calibration)}


# Uptime monitors check with HEAD; kept out of the docs so it is not listed twice.
router.add_api_route("/health", health, methods=["HEAD"], include_in_schema=False)


@router.get("/model", tags=["Index and payouts"], response_model=ModelSummary, summary="The calibrated model, trigger, exit and validation")
def get_model(ds: data.Dataset = Depends(get_dataset)) -> ModelSummary:
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
            ValidationRow(scheme=v["Validation"], model=v["Model"], rmse=v["RMSE"], mae=v["MAE"], r2=v["Predictive R2"])
            for v in meta["validation_main"]
        ],
        pricing_inputs=PricingInputs(**meta["pricing_inputs"]),
    )


@router.get("/simulate", tags=["Index and payouts"], response_model=Simulation, summary="Index and payout for one district and season")
def simulate(district: str = Query(...), season: int = Query(...), ds: data.Dataset = Depends(get_dataset)) -> Simulation:
    name = ds.district_named(district)
    if name is None:
        raise HTTPException(404, f"Unknown district: {district}")
    result = ds.result(name, season)
    if result is None:
        raise HTTPException(404, f"No satellite data for {name} Season A {season}")
    return _simulation(result)


@router.get("/seasons", tags=["Index and payouts"], response_model=list[Simulation], summary="Every season with harvest data (2018 to 2025)")
def seasons(ds: data.Dataset = Depends(get_dataset)) -> list[Simulation]:
    """The district-seasons with harvest data, with the leave-one-out index."""
    keys = sorted(ds.calibration, key=lambda k: (k[1], k[0]))
    return [_simulation(ds.result(d, s)) for d, s in keys]


@router.get("/history", tags=["Index and payouts"], response_model=list[HistoryPoint], summary="Backtest of every season since 2001")
def history(ds: data.Dataset = Depends(get_dataset)) -> list[HistoryPoint]:
    """Backtest on satellite data alone, with the model fitted on all observations for
    every year (as in the notebook's drought-year check)."""
    points = []
    for row in sorted(ds.seasons.values(), key=lambda r: (r.window_year, r.district)):
        index = ds.model.predict(row.rain_z, row.ndvi_z)
        points.append(HistoryPoint(
            window_year=row.window_year, district=row.district, rain_z=row.rain_z, ndvi_z=row.ndvi_z,
            index=index, payout=ds.model.payout(index), pays=index <= ds.model.trigger, drought_year=row.drought_year,
        ))
    return points


@router.get("/basis-risk", tags=["Index and payouts"], response_model=list[BasisRisk], summary="Basis risk per district")
def basis_risk(ds: data.Dataset = Depends(get_dataset)) -> list[BasisRisk]:
    return [BasisRisk(district=d, basis_risk=r) for d, r in ds.basis_risk().items()]


@router.get("/plot-losses", tags=["Index and payouts"], response_model=list[PlotLoss], summary="Share of surveyed farms with a severe loss")
def plot_losses(ds: data.Dataset = Depends(get_dataset)) -> list[PlotLoss]:
    """Share of NISR-surveyed farms that lost more than half their expected maize harvest."""
    return [
        PlotLoss(district=p.district, season=p.season, plots=p.plots, severe_loss_share=p.severe_loss_share)
        for p in ds.plot_losses
    ]


@router.get("/current-season", tags=["Season monitor"], summary="The season in progress: provisional index")
def current_season() -> FileResponse:
    """The Season A window in progress: a provisional index from near-real-time data
    (notebook/update_current_season.py), and how far such an early read can be trusted."""
    path = data.DATA_DIR / "current_season.json"
    if not path.exists():
        raise HTTPException(404, "No season monitor yet; run notebook/update_current_season.py")
    return FileResponse(path, media_type="application/json")


@router.get("/geo/districts", tags=["Map"], summary="District boundaries (GeoJSON)")
def district_shapes() -> FileResponse:
    """District boundaries (FAO GAUL 2025, simplified) for the dashboard map."""
    path = data.DATA_DIR / "eastern_districts.geojson"
    if not path.exists():
        raise HTTPException(404, "District shapes not exported; run the notebook's Section 3")
    return FileResponse(path, media_type="application/geo+json")
