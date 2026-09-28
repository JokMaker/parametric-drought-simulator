"""Loads the Step 12 notebook export (backend/data/) into memory once.

- model.json       scaler, Ridge coefficients, thresholds, validation
- calibration.csv  the 21 district-seasons with yield data; index is the
                   leave-one-out prediction
- seasons.csv      every district-season; index from the model fitted on all
                   21 observations (blank before NDVI begins)
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
class Dataset:
    model: IndexModel
    meta: dict
    calibration: dict[tuple[str, int], CalibrationRow]
    seasons: dict[tuple[str, int], SeasonRow]

    @property
    def districts(self) -> list[str]:
        return sorted({d for d, _ in self.seasons})


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

    return Dataset(model=model, meta=meta, calibration=calibration, seasons=seasons)
