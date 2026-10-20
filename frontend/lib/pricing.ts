import { DISTRICTS } from "./constants";
import type { HistoryPoint, Simulation } from "./types";

// Contract terms an insurer sets. Defaults are illustrative and every one is editable.
export type Terms = {
  sumInsured: number; // RWF paid per farmer at a full payout
  loading: number; // share added to the fair premium for costs and risk
  subsidy: number; // share of the premium the government pays
  farmers: number; // farmers insured in each district
};

export const DEFAULT_TERMS: Terms = { sumInsured: 60_000, loading: 0.3, subsidy: 0.4, farmers: 10_000 };

export const rwf = (v: number) => `RWF ${Math.round(v).toLocaleString("en-US")}`;

/** Large totals as "RWF 585M" or "RWF 2.2B". */
export const rwfShort = (v: number) =>
  v >= 1e9 ? `RWF ${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `RWF ${Math.round(v / 1e6)}M` : rwf(v);

/**
 * The history with the leave-one-out index for seasons that have harvest data,
 * so every page shows the same payout for the same district-season.
 */
export function payoutHistory(history: HistoryPoint[], calibration: Simulation[]): HistoryPoint[] {
  const loo = new Map(calibration.map((s) => [`${s.district}:${s.season}`, s]));
  return history.map((p) => {
    const c = loo.get(`${p.district}:${p.windowYear + 1}`);
    return c ? { ...p, index: c.index, payout: c.payout, pays: c.payout > 0 } : p;
  });
}

export type DistrictPrice = {
  district: string;
  seasons: number;
  paidSeasons: number;
  expectedPayout: number; // average payout share per season (0-1)
  worst: { season: number; payout: number };
  fairPremium: number; // RWF: expected payout x sum insured
  premium: number; // RWF: fair premium plus loading
  farmerPays: number; // RWF: premium after subsidy
  rate: number; // premium as a share of the sum insured
};

/**
 * Burning-cost pricing: the fair premium is the average payout the index would
 * have made over every season in the backtest (2001-2025).
 */
export function priceDistricts(history: HistoryPoint[], terms: Terms): DistrictPrice[] {
  return DISTRICTS.map((district) => {
    const pts = history.filter((p) => p.district === district);
    const expectedPayout = pts.reduce((s, p) => s + p.payout, 0) / pts.length;
    const worstPt = pts.reduce((a, b) => (b.payout > a.payout ? b : a));
    const fairPremium = expectedPayout * terms.sumInsured;
    const premium = fairPremium * (1 + terms.loading);
    return {
      district,
      seasons: pts.length,
      paidSeasons: pts.filter((p) => p.payout > 0).length,
      expectedPayout,
      worst: { season: worstPt.windowYear + 1, payout: worstPt.payout },
      fairPremium,
      premium,
      farmerPays: premium * (1 - terms.subsidy),
      rate: premium / terms.sumInsured,
    };
  });
}

export type SeasonBook = { season: number; premiums: number; payouts: number; lossRatio: number; districtsPaid: number };

/** Each season of the backtest as the insurer's books would show it. */
export function seasonBooks(history: HistoryPoint[], prices: DistrictPrice[], terms: Terms): SeasonBook[] {
  const premiums = prices.reduce((s, p) => s + p.premium, 0) * terms.farmers;
  const seasons = [...new Set(history.map((p) => p.windowYear + 1))].sort((a, b) => a - b);
  return seasons.map((season) => {
    const pts = history.filter((p) => p.windowYear + 1 === season);
    const payouts = pts.reduce((s, p) => s + p.payout, 0) * terms.sumInsured * terms.farmers;
    return { season, premiums, payouts, lossRatio: payouts / premiums, districtsPaid: pts.filter((p) => p.payout > 0).length };
  });
}
