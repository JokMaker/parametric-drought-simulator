import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { anomalyLabel, classify, modelError, payoutFromIndex, reason, uncertainty } from "../lib/payout";
import { model, sim } from "./fixtures";

describe("payoutFromIndex", () => {
  const pay = (index: number) => payoutFromIndex(index, -2, -22);

  it("pays nothing at or above the trigger", () => {
    assert.equal(pay(5), 0);
    assert.equal(pay(-2), 0);
  });

  it("rises linearly between trigger and exit", () => {
    assert.equal(pay(-12), 0.5);
    assert.ok(Math.abs(pay(-7) - 0.25) < 1e-12);
  });

  it("pays in full at and past the exit", () => {
    assert.equal(pay(-22), 1);
    assert.equal(pay(-60), 1);
  });

  it("never decreases as the index falls", () => {
    let last = 0;
    for (let i = 10; i >= -40; i -= 0.5) {
      assert.ok(pay(i) >= last);
      last = pay(i);
    }
  });
});

describe("classify", () => {
  const rule = { trigger: -2, lowYieldThreshold: -10 };

  it("returns null without a harvest record", () => {
    assert.equal(classify(sim(), rule), null);
  });

  it("covers all four outcomes", () => {
    assert.equal(classify(sim({ index: -15, actualYieldAnom: -30 }), rule), "hit");
    assert.equal(classify(sim({ index: 4, actualYieldAnom: -30 }), rule), "miss");
    assert.equal(classify(sim({ index: -15, actualYieldAnom: 5 }), rule), "false-payout");
    assert.equal(classify(sim({ index: 4, actualYieldAnom: 5 }), rule), "correct-no-payout");
  });

  it("treats the thresholds themselves as poor and paid", () => {
    assert.equal(classify(sim({ index: -2, actualYieldAnom: -10 }), rule), "hit");
  });
});

describe("reason", () => {
  it("explains each payout case", () => {
    assert.match(reason(sim({ index: 3, payout: 0 }), -2, -22), /above the -2% trigger, so no payout/);
    assert.match(reason(sim({ index: -12, payout: 0.5 }), -2, -22), /so 50% of the full payout applies/);
    assert.match(reason(sim({ index: -30, payout: 1 }), -2, -22), /past the -22% exit/);
  });

  it("describes the satellite readings in words", () => {
    assert.equal(anomalyLabel(0.02), "about normal");
    assert.equal(anomalyLabel(-1.24), "1.2 below normal");
    assert.equal(anomalyLabel(0.8), "0.8 above normal");
  });
});

describe("uncertainty", () => {
  it("uses the Ridge leave-one-out RMSE as the model error", () => {
    assert.equal(modelError(model), 22.26);
  });

  it("gives a 50% chance of a payout exactly at the trigger", () => {
    assert.ok(Math.abs(uncertainty(model.trigger, model).chanceBelowTrigger - 0.5) < 1e-6);
  });

  it("matches the normal distribution one error away", () => {
    const u = uncertainty(model.trigger + modelError(model), model);
    assert.ok(Math.abs(u.chanceBelowTrigger - 0.158655) < 1e-5);
    assert.equal(u.high - u.low, 2 * u.error);
  });

  it("falls back to a yes or no answer without a model error", () => {
    const noError = { ...model, validation: [] };
    assert.equal(uncertainty(-5, noError).chanceBelowTrigger, 1);
    assert.equal(uncertainty(5, noError).chanceBelowTrigger, 0);
  });
});
