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
};

export type Simulation = {
  district: string;
  season: number;
  rainZ: number;
  ndviZ: number;
  index: number; // predicted yield change (%)
  payout: number; // 0 to 1
  actualYieldAnom: number | null; // only for seasons with yield data (2022–2025)
  payoutIfActual: number | null;
};

export type HistoryPoint = {
  windowYear: number; // year of the Oct–Dec rains; the Season A harvest is windowYear + 1
  district: string;
  index: number;
  payout: number; // 0 to 1
  pays: boolean;
  droughtYear: boolean;
};

export type BasisRisk = { district: string; basisRisk: number };
