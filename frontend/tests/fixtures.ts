// The data the dashboard runs on without the backend (lib/mock-data.json, written by
// backend/scripts/export_mock.py), so the tests check the real model and seasons.
import { readFileSync } from "node:fs";
import type { HistoryPoint, ModelSummary, Simulation } from "../lib/types";

const data = JSON.parse(readFileSync(new URL("../lib/mock-data.json", import.meta.url), "utf8"));

export const model: ModelSummary = data.model;
export const calibration: Simulation[] = data.seasons;
export const history: HistoryPoint[] = data.history;

export function sim(overrides: Partial<Simulation> = {}): Simulation {
  return { district: "Ngoma", season: 2023, rainZ: 0, ndviZ: 0, index: 0, payout: 0, actualYieldAnom: null, payoutIfActual: null, ...overrides };
}
