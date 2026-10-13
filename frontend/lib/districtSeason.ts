import type { HistoryPoint, Simulation } from "./types";

/** One district in one season, as the map, heatmap and tooltips show it. */
export type DistrictSeason = {
  district: string;
  season: number;
  rainZ: number;
  ndviZ: number;
  index: number;
  payout: number;
  actualYieldAnom: number | null;
};

/**
 * Values for every district in a season. Seasons with yield data use the
 * calibration (leave-one-out) values, so they match the Explorer exactly;
 * other seasons use the satellite backtest.
 */
export function districtsInSeason(
  history: HistoryPoint[],
  calibration: Simulation[],
  season: number,
): Map<string, DistrictSeason> {
  const out = new Map<string, DistrictSeason>();
  for (const p of history) {
    if (p.windowYear !== season - 1) continue;
    out.set(p.district, {
      district: p.district,
      season,
      rainZ: p.rainZ,
      ndviZ: p.ndviZ,
      index: p.index,
      payout: p.payout,
      actualYieldAnom: null,
    });
  }
  for (const s of calibration) {
    if (s.season !== season) continue;
    out.set(s.district, {
      district: s.district,
      season,
      rainZ: s.rainZ,
      ndviZ: s.ndviZ,
      index: s.index,
      payout: s.payout,
      actualYieldAnom: s.actualYieldAnom,
    });
  }
  return out;
}
