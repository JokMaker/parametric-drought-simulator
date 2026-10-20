import { DISTRICTS } from "./constants";
import type { HistoryPoint, ModelSummary, Simulation } from "./types";

// Cover is priced from what the maize is worth: area x expected yield x price.
// Price, yields and areas come from the NISR surveys (notebook Section 10b); the
// insurer's own choices (cover level, loading, subsidy, uptake) are editable.
export type Terms = {
  price: number; // RWF per kg, farm-gate
  coverLevel: number; // share of the crop's value insured; the exit level by default
  loading: number; // share added to the fair premium for costs and risk
  subsidy: number; // share of the premium the government pays
  uptake: number; // share of each district's smallholder maize area insured
};

export function defaultTerms(m: ModelSummary): Terms {
  return { price: m.pricingInputs.maizePriceRwfKg, coverLevel: Math.abs(m.exit) / 100, loading: 0.3, subsidy: 0.4, uptake: 0.3 };
}

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

/** Average payout share per season for a district over the whole backtest. */
export function expectedPayout(history: HistoryPoint[], district: string) {
  const pts = history.filter((p) => p.district === district);
  return pts.reduce((s, p) => s + p.payout, 0) / pts.length;
}

/** One hectare of maize in a district: what it is worth, its cover and its premium. */
export function perHectare(district: string, m: ModelSummary, terms: Terms, payoutRate: number) {
  const yieldKg = m.pricingInputs.expectedYieldKgHa[district];
  const value = yieldKg * terms.price;
  const cover = value * terms.coverLevel;
  const fairPremium = cover * payoutRate;
  const premium = fairPremium * (1 + terms.loading);
  return { yieldKg, value, cover, fairPremium, premium, farmerPays: premium * (1 - terms.subsidy) };
}

export type DistrictPrice = ReturnType<typeof perHectare> & {
  district: string;
  seasons: number;
  paidSeasons: number;
  expectedPayout: number; // average payout share per season (0-1)
  worst: { season: number; payout: number };
  rate: number; // premium as a share of the cover
  insuredHa: number;
};

/**
 * Burning-cost pricing: the fair premium is the average payout the index would
 * have made over every season in the backtest (2001-2025).
 */
export function priceDistricts(history: HistoryPoint[], m: ModelSummary, terms: Terms): DistrictPrice[] {
  return DISTRICTS.map((district) => {
    const pts = history.filter((p) => p.district === district);
    const rate = expectedPayout(history, district);
    const worstPt = pts.reduce((a, b) => (b.payout > a.payout ? b : a));
    const ha = perHectare(district, m, terms, rate);
    return {
      ...ha,
      district,
      seasons: pts.length,
      paidSeasons: pts.filter((p) => p.payout > 0).length,
      expectedPayout: rate,
      worst: { season: worstPt.windowYear + 1, payout: worstPt.payout },
      rate: ha.premium / ha.cover,
      insuredHa: m.pricingInputs.maizeAreaHa[district] * terms.uptake,
    };
  });
}

export type SeasonBook = { season: number; premiums: number; payouts: number; lossRatio: number; districtsPaid: number };

/** Each season of the backtest as the insurer's books would show it. */
export function seasonBooks(history: HistoryPoint[], prices: DistrictPrice[]): SeasonBook[] {
  const byDistrict = new Map(prices.map((p) => [p.district, p]));
  const premiums = prices.reduce((s, p) => s + p.premium * p.insuredHa, 0);
  const seasons = [...new Set(history.map((p) => p.windowYear + 1))].sort((a, b) => a - b);
  return seasons.map((season) => {
    const pts = history.filter((p) => p.windowYear + 1 === season && byDistrict.has(p.district));
    const payouts = pts.reduce((s, p) => {
      const d = byDistrict.get(p.district)!;
      return s + p.payout * d.cover * d.insuredHa;
    }, 0);
    return { season, premiums, payouts, lossRatio: payouts / premiums, districtsPaid: pts.filter((p) => p.payout > 0).length };
  });
}

/** The payout total reached or exceeded in one season out of ten. */
export function oneInTen(books: SeasonBook[]) {
  const sorted = books.map((b) => b.payouts).sort((a, b) => b - a);
  return sorted[Math.max(0, Math.ceil(sorted.length / 10) - 1)];
}
