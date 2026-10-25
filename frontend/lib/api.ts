// All calls to the backend live here. With NEXT_PUBLIC_USE_MOCK=true every call
// returns the saved API responses in lib/mock-data.json instead.

import {
  mockBasisRisk,
  mockCurrentSeason,
  mockHistory,
  mockModel,
  mockPlotLosses,
  mockSeasons,
  mockShapes,
  mockSimulation,
} from "./mock";
import type {
  BasisRisk,
  CurrentSeason,
  DistrictShapes,
  HistoryPoint,
  LossReportResult,
  ModelSummary,
  PlotLoss,
  ReportCount,
  Simulation,
  SmsStatus,
} from "./types";

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

/** The calibration district-seasons with actual yields (2018–2025). */
export async function getSeasons(): Promise<Simulation[]> {
  if (USE_MOCK) return mockSeasons;
  return get("/api/seasons", "season comparison");
}

/** The Season A window in progress, from near-real-time satellite data. */
export async function getCurrentSeason(): Promise<CurrentSeason> {
  if (USE_MOCK) return mockCurrentSeason;
  return get("/api/current-season", "current season");
}

/** Survey evidence of crop failure per district-season (NISR plots). */
export async function getPlotLosses(): Promise<PlotLoss[]> {
  if (USE_MOCK) return mockPlotLosses;
  return get("/api/plot-losses", "survey losses");
}

/** Crop-loss reports on file. Saved results have none: reports need the live API. */
export async function getReportCounts(): Promise<ReportCount[]> {
  if (USE_MOCK) return [];
  return get("/api/loss-reports/summary", "loss reports");
}

/** A farmer reports a crop loss for a district-season. */
export async function reportLoss(policyId: string, district: string, season: number): Promise<LossReportResult> {
  if (USE_MOCK) return { created: true, reports: 1 };
  const res = await fetch(`${API}/api/loss-reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ policyId, district, season }),
  });
  if (!res.ok) throw new Error("Could not send the report");
  return res.json() as Promise<LossReportResult>;
}

/** Whether the backend can send SMS (Africa's Talking credentials in backend/.env). */
export async function getSmsStatus(): Promise<SmsStatus> {
  if (USE_MOCK) return { configured: false, sandbox: true, phone: "" };
  return get("/api/sms/status", "SMS status");
}

/** Send a message to the demo phone through Africa's Talking. */
export async function sendSms(message: string): Promise<{ status: string; phone: string; sandbox: boolean }> {
  const res = await fetch(`${API}/api/sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail ?? "Could not send the SMS");
  return body;
}

/** The seven district boundaries for the map. */
export async function getShapes(): Promise<DistrictShapes> {
  if (USE_MOCK) return mockShapes;
  return get("/api/geo/districts", "district map");
}
