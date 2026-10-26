"""Response shapes. These mirror frontend/lib/types.ts field for field."""

from pydantic import BaseModel, ConfigDict, Field
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


class PricingInputs(CamelModel):
    """What a farmer's maize is worth, from the NISR surveys (notebook Section 10b)."""

    season: int
    maize_price_rwf_kg: float
    price_by_year: dict[int, float]
    expected_yield_kg_ha: dict[str, float]
    maize_area_ha: dict[str, float]
    farm_size_ha: dict[str, float]


class ModelSummary(CamelModel):
    model: str
    coefficients: Coefficients
    trigger: float
    exit: float
    low_yield_threshold: float
    hit_rate: float
    false_payout_rate: float
    validation: list[ValidationRow]
    pricing_inputs: PricingInputs


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


class LossReportIn(CamelModel):
    policy_id: str = Field(pattern=r"^RDI-[A-Z]{3}-\d{4}$")
    district: str
    season: int


class LossReportOut(CamelModel):
    created: bool  # False when this policy had already reported this season
    reports: int  # reports now on file for the district-season


class UssdPreviewIn(CamelModel):
    text: str = Field("", max_length=100)  # the answers so far, joined by "*"
    policy_id: str


class UssdPreviewOut(CamelModel):
    reply: str  # starts with "CON " (waiting for an answer) or "END " (session over)


class SmsIn(CamelModel):
    message: str = Field(min_length=1, max_length=480)


class SmsStatus(CamelModel):
    configured: bool
    sandbox: bool
    phone: str  # masked


class ReportCount(CamelModel):
    district: str
    season: int
    reports: int
    causes: dict[str, int] = {}  # drought / pests / flood / other, for reports that gave one


class PlotLoss(CamelModel):
    district: str
    season: int
    plots: int
    severe_loss_share: float


class BasisRisk(CamelModel):
    district: str
    basis_risk: float
