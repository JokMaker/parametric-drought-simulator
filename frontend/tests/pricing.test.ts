import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DISTRICTS } from "../lib/constants";
import { payoutFromIndex } from "../lib/payout";
import { findPolicy } from "../lib/policies";
import { defaultTerms, expectedPayout, oneInTen, payoutHistory, perHectare, priceDistricts, rwf, rwfShort, seasonBooks } from "../lib/pricing";
import { calibration, history, model } from "./fixtures";

const terms = defaultTerms(model);
const paid = payoutHistory(history, calibration);

describe("payoutHistory", () => {
  it("uses the leave-one-out payout for seasons with harvest data", () => {
    for (const c of calibration) {
      const p = paid.find((h) => h.district === c.district && h.windowYear + 1 === c.season)!;
      assert.equal(p.payout, c.payout);
      assert.equal(p.pays, c.payout > 0);
    }
  });

  it("keeps every other season as it was", () => {
    assert.equal(paid.length, history.length);
    const before = history.filter((h) => h.windowYear + 1 < 2018);
    for (const h of before) assert.deepEqual(paid[history.indexOf(h)], h);
  });

  it("agrees with the payout curve for the full-model seasons", () => {
    for (const h of paid.filter((p) => p.windowYear + 1 < 2018)) {
      assert.ok(Math.abs(h.payout - payoutFromIndex(h.index, model.trigger, model.exit)) < 1e-6);
    }
  });
});

describe("priceDistricts", () => {
  const prices = priceDistricts(paid, model, terms);

  it("prices all seven districts over 25 seasons", () => {
    assert.deepEqual(prices.map((p) => p.district), [...DISTRICTS]);
    for (const p of prices) assert.equal(p.seasons, 25);
  });

  it("follows value, cover, fair premium, loading and subsidy in order", () => {
    for (const p of prices) {
      assert.ok(Math.abs(p.value - p.yieldKg * terms.price) < 1e-6);
      assert.ok(Math.abs(p.cover - p.value * 0.22) < 1e-6);
      assert.ok(Math.abs(p.fairPremium - p.cover * p.expectedPayout) < 1e-6);
      assert.ok(Math.abs(p.farmerPays - p.premium * 0.6) < 1e-6);
      assert.ok(p.rate > p.expectedPayout);
    }
  });

  it("charges the same premium as the backend's USSD quote", () => {
    // backend/app/policies.py CoverQuote for RDI-RWA-1233 (840 m2 in Rwamagana): RWF 584
    const policy = findPolicy("rdi-rwa-1233 ")!;
    const rate = expectedPayout(paid, policy.district);
    assert.ok(Math.abs(rate - 0.10637652) < 1e-6);
    const ha = perHectare(policy.district, model, terms, rate);
    assert.equal(Math.round(ha.farmerPays * policy.areaM2 / 10_000), 584);
  });
});

describe("seasonBooks and oneInTen", () => {
  const prices = priceDistricts(paid, model, terms);
  const books = seasonBooks(paid, prices);

  it("has one book per season and premiums equal to average payouts before loading", () => {
    assert.equal(books.length, 25);
    const meanPayouts = books.reduce((s, b) => s + b.payouts, 0) / books.length;
    // Burning cost: with no loading the premium would equal the average claim.
    assert.ok(Math.abs(books[0].premiums / (1 + terms.loading) - meanPayouts) / meanPayouts < 1e-9);
  });

  it("picks the third-largest season out of 25 as one in ten", () => {
    const sorted = books.map((b) => b.payouts).sort((a, b) => b - a);
    assert.equal(oneInTen(books), sorted[2]);
  });
});

describe("money formats", () => {
  it("rounds and groups RWF amounts", () => {
    assert.equal(rwf(584.27), "RWF 584");
    assert.equal(rwf(1234567.6), "RWF 1,234,568");
    assert.equal(rwfShort(585_400_000), "RWF 585M");
    assert.equal(rwfShort(2_240_000_000), "RWF 2.2B");
    assert.equal(rwfShort(9_999), "RWF 9,999");
  });
});
