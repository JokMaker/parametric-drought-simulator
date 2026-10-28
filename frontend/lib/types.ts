// Contract between the frontend and the FastAPI backend.
// The backend returns exactly these shapes.

export type ValidationRow = {
  scheme: string; // "Leave-one-out" | "Leave-one-season-out"
  model: string; // "Ridge" | "Lasso" | "Quadratic OLS" | "Baseline (mean)"
  rmse: number;
  mae: number;
  r2: number;
};

export type ModelSummary = {
  model: string; // "Ridge"
  coefficients: { rain_z: number; ndvi_z: number };
  trigger: number; // -7, applies to the index (predicted yield change)
  exit: number; // -27
  lowYieldThreshold: number; // -10, actual yield change at or below this is a "poor" season
  hitRate: number; // 0.86
  falsePayoutRate: number; // 0.29
  validation: ValidationRow[];
  pricingInputs: PricingInputs;
};

/** What a farmer's maize is worth, from the NISR surveys (notebook Section 10b). */
export type PricingInputs = {
  season: number; // the season the expected yields are for
  maizePriceRwfKg: number; // farm-gate price used by default
  priceByYear: Record<string, number>; // median farm-gate price per survey year
  expectedYieldKgHa: Record<string, number>; // trend-adjusted expected yield per district
  maizeAreaHa: Record<string, number>; // survey-weighted smallholder maize area per district
  farmSizeHa: { p25: number; p50: number; p75: number; p90: number }; // maize area per farmer
};

export type Simulation = {
  district: string;
  season: number;
  rainZ: number;
  ndviZ: number;
  index: number; // predicted yield change (%)
  payout: number; // 0 to 1
  actualYieldAnom: number | null; // only for seasons with yield data (2018–2025)
  payoutIfActual: number | null;
};

export type HistoryPoint = {
  windowYear: number; // year of the Oct–Dec rains; the Season A harvest is windowYear + 1
  district: string;
  rainZ: number;
  ndviZ: number;
  index: number;
  payout: number; // 0 to 1
  pays: boolean;
  droughtYear: boolean;
};

/** The Season A window in progress (notebook/update_current_season.py). */
export type SeasonSkill = {
  day: number; // day of the window the early read was taken
  seasons: number;
  correlation: number; // early read against the final index
  agreement: number; // share with the same pay / no-pay decision
  finalPaidCaught: number | null; // share of finally paid district-seasons the early read already paid
};

export type CurrentSeason = {
  season: number;
  windowStart: string;
  windowEnd: string;
  asOf: string;
  daysElapsed: number;
  windowDays: number;
  status: "open" | "closed";
  generatedAt: string;
  sources: { rainfall: string; greenness: string };
  skill: SeasonSkill;
  skillCurve: SeasonSkill[];
  districts: {
    district: string;
    rainMm: number;
    rainNormalMm: number;
    rainZ: number;
    ndvi: number;
    ndviNormal: number;
    ndviZ: number;
    index: number;
    payout: number;
  }[];
};

/** Share of NISR-surveyed farms that lost more than half their expected maize harvest. */
export type PlotLoss = { district: string; season: number; plots: number; severeLossShare: number };

/** Crop-loss reports on file for a district-season. */
export type ReportCount = {
  district: string;
  season: number;
  reports: number;
  causes: Partial<Record<"drought" | "pests" | "flood" | "other", number>>; // reports that gave a cause
};

/** Whether SMS through Africa's Talking is set up; the phone is masked. */
export type SmsStatus = { configured: boolean; sandbox: boolean; phone: string };

export type LossReportResult = { created: boolean; reports: number };

/** A policy a farmer signed up for over USSD; the phone is masked. */
export type RegisteredPolicy = {
  policyId: string;
  phone: string;
  channel: "ussd" | "web"; // a real dial, or the dashboard's on-screen phone
  district: string;
  areaM2: number;
  season: number;
  premium: number; // RWF per season, as quoted at sign-up
  createdAt: string; // ISO time, UTC
};

export type BasisRisk = { district: string; basisRisk: number };

/** District boundaries (GeoJSON FeatureCollection, property `district`). */
export type DistrictShapes = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  { district: string }
>;
