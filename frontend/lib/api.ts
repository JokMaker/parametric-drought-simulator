// All calls to the backend live here. With NEXT_PUBLIC_USE_MOCK=true every call
// returns the saved API responses in lib/mock-data.json instead.

import {
  mockBasisRisk,
  mockHistory,
  mockModel,
  mockSeasons,
  mockSimulation,
} from "./mock";
import type { BasisRisk, HistoryPoint, ModelSummary, Simulation } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

async function get<T>(path: string, what: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`Could not load ${what}`);
  return res.json() as Promise<T>;
}

/** True when the backend answers its health check. */
export async function isApiUp(): Promise<boolean> {
  if (USE_MOCK) return false;
  try {
    return (await fetch(`${API}/api/health`)).ok;
  } catch {
    return false;
  }
}

export async function getModel(): Promise<ModelSummary> {
  if (USE_MOCK) return mockModel;
  return get("/api/model", "model summary");
}

export async function getSimulation(district: string, season: number): Promise<Simulation> {
  if (USE_MOCK) return mockSimulation(district, season);
  const q = new URLSearchParams({ district, season: String(season) });
  return get(`/api/simulate?${q}`, "simulation");
}

export async function getHistory(): Promise<HistoryPoint[]> {
  if (USE_MOCK) return mockHistory;
  return get("/api/history", "drought history");
}

export async function getBasisRisk(): Promise<BasisRisk[]> {
  if (USE_MOCK) return mockBasisRisk;
  return get("/api/basis-risk", "basis risk");
}

/** The calibration district-seasons with actual yields (2022–2025). */
export async function getSeasons(): Promise<Simulation[]> {
  if (USE_MOCK) return mockSeasons;
  return get("/api/seasons", "season comparison");
}
