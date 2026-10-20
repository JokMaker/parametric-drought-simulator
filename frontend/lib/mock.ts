// Offline data: the API's own responses, saved by backend/scripts/export_mock.py.
// Used when NEXT_PUBLIC_USE_MOCK is true, so the dashboard shows the same results
// with or without the backend. Re-run that script after re-running the notebook.

import data from "./mock-data.json";
import type { BasisRisk, CurrentSeason, DistrictShapes, HistoryPoint, ModelSummary, Simulation } from "./types";

export const mockModel = data.model as ModelSummary;
export const mockSeasons = data.seasons as Simulation[];
export const mockBasisRisk = data.basisRisk as BasisRisk[];
export const mockHistory = data.history as HistoryPoint[];
export const mockShapes = data.geo as unknown as DistrictShapes;
export const mockCurrentSeason = data.currentSeason as CurrentSeason;

const simulations = data.simulations as Simulation[];

export function mockSimulation(district: string, season: number): Simulation {
  const s = simulations.find((x) => x.district === district && x.season === season);
  if (!s) throw new Error(`No satellite data for ${district} Season A ${season}`);
  return s;
}
