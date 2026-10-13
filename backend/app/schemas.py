"""Response shapes. These mirror frontend/lib/types.ts field for field."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Coefficients(BaseModel):
    rain_z: float
    ndvi_z: float


class ValidationRow(BaseModel):
    scheme: str
    model: str
    rmse: float
    mae: float
    r2: float


class ModelSummary(CamelModel):
    model: str
    coefficients: Coefficients
    trigger: float
    exit: float
    low_yield_threshold: float
    hit_rate: float
    false_payout_rate: float
    validation: list[ValidationRow]


class Simulation(CamelModel):
    district: str
    season: int
    rain_z: float
    ndvi_z: float
    index: float
    payout: float
    actual_yield_anom: float | None
    payout_if_actual: float | None


class HistoryPoint(CamelModel):
    window_year: int
    district: str
    rain_z: float
    ndvi_z: float
    index: float
    payout: float
    pays: bool
    drought_year: bool


class BasisRisk(CamelModel):
    district: str
    basis_risk: float
