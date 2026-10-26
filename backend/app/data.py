"""Loads the notebook export (backend/data/) into memory once.

- model.json       scaler, Ridge coefficients, thresholds, validation, pricing inputs
- calibration.csv  the 56 district-seasons with yield data; index is the
                   leave-one-out prediction
- seasons.csv      every district-season; index from the model fitted on all
                   56 observations (blank before NDVI begins)
- plot_losses.csv  share of surveyed farms that lost more than half their
                   expected harvest, per district-season with yield data
"""

import csv
import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from .model import IndexModel

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))


@dataclass(frozen=True)
class CalibrationRow:
    district: str
    season: int
    yield_anom: float
    rain_z: float
    ndvi_z: float
    index_loo: float
    payout: float
    payout_if_actual: float
    basis_risk: float


@dataclass(frozen=True)
class SeasonRow:
    district: str
    season: int
    window_year: int
    rain_z: float
    ndvi_z: float
    drought_year: bool


@dataclass(frozen=True)
class PlotLoss:
    district: str
    season: int
    plots: int
    severe_loss_share: float


@dataclass(frozen=True)
class SeasonResult:
    """What the index says for one district-season. Seasons with harvest data use the
    leave-one-out index, so the comparison with the actual harvest is honest (the model
    never saw that season); the others use the model fitted on all observations."""

    district: str
    season: int
    rain_z: float
    ndvi_z: float
    index: float
    payout: float
    actual_yield_anom: float | None = None
    payout_if_actual: float | None = None


@dataclass(frozen=True)
class Dataset:
    model: IndexModel
    meta: dict
    calibration: dict[tuple[str, int], CalibrationRow]
    seasons: dict[tuple[str, int], SeasonRow]
    plot_losses: list[PlotLoss]

    @property
    def districts(self) -> list[str]:
        return sorted({d for d, _ in self.seasons})

    def result(self, district: str, season: int) -> SeasonResult | None:
        """The index and payout for a district-season, or None if there is no satellite data."""
        cal = self.calibration.get((district, season))
        if cal is not None:
            return SeasonResult(cal.district, cal.season, cal.rain_z, cal.ndvi_z, cal.index_loo, cal.payout,
                                cal.yield_anom, cal.payout_if_actual)
        row = self.seasons.get((district, season))
        if row is None:
            return None
        index = self.model.predict(row.rain_z, row.ndvi_z)
        return SeasonResult(row.district, row.season, row.rain_z, row.ndvi_z, index, self.model.payout(index))

    def payout_rate(self, district: str) -> float:
        """Average payout share per season over the whole record: the fair premium rate
        (burning cost), the same figure the dashboard's pricing uses."""
        shares = [self.result(d, s).payout for (d, s) in self.seasons if d == district]
        return sum(shares) / len(shares)

    def basis_risk(self) -> dict[str, float]:
        """Average gap between the index payout and the harvest's payout, per district."""
        gaps: dict[str, list[float]] = {}
        for row in self.calibration.values():
            gaps.setdefault(row.district, []).append(row.basis_risk)
        return {d: sum(g) / len(g) for d, g in sorted(gaps.items())}

    @property
    def current_season(self) -> dict | None:
        """The season monitor's latest output (notebook/update_current_season.py). Read
        on every call, because the script rewrites the file while the server runs."""
        path = DATA_DIR / "current_season.json"
        return json.loads(path.read_text()) if path.exists() else None


def _read_csv(name: str) -> list[dict[str, str]]:
    with open(DATA_DIR / name, newline="") as f:
        return list(csv.DictReader(f))


@lru_cache
def load() -> Dataset:
    meta = json.loads((DATA_DIR / "model.json").read_text())
    if meta["features"] != ["rain_z", "ndvi_z"]:
        raise ValueError(f"Unexpected model features: {meta['features']}")

    model = IndexModel(
        name=meta["model"],
        scaler_mean=tuple(meta["scaler_mean"]),
        scaler_scale=tuple(meta["scaler_scale"]),
        coefficients=tuple(meta["coefficients"]),
        intercept=meta["intercept"],
        trigger=meta["trigger"],
        exit=meta["exit"],
    )

    calibration = {}
    for r in _read_csv("calibration.csv"):
        row = CalibrationRow(
            district=r["district"],
            season=int(r["season"]),
            yield_anom=float(r["yield_anom"]),
            rain_z=float(r["rain_z"]),
            ndvi_z=float(r["ndvi_z"]),
            index_loo=float(r["index_loo"]),
            payout=float(r["payout"]),
            payout_if_actual=float(r["payout_if_actual"]),
            basis_risk=float(r["basis_risk"]),
        )
        calibration[(row.district, row.season)] = row

    # Keep only seasons the index can be run on (NDVI starts in 2000).
    seasons = {}
    for r in _read_csv("seasons.csv"):
        if not r["rain_z"] or not r["ndvi_z"]:
            continue
        row = SeasonRow(
            district=r["district"],
            season=int(r["season"]),
            window_year=int(r["window_year"]),
            rain_z=float(r["rain_z"]),
            ndvi_z=float(r["ndvi_z"]),
            drought_year=r["drought_year"] == "True",
        )
        seasons[(row.district, row.season)] = row

    plot_losses = [
        PlotLoss(r["district"], int(r["season"]), int(r["plots"]), float(r["severe_loss_share"]))
        for r in _read_csv("plot_losses.csv")
    ] if (DATA_DIR / "plot_losses.csv").exists() else []

    return Dataset(model=model, meta=meta, calibration=calibration, seasons=seasons, plot_losses=plot_losses)
