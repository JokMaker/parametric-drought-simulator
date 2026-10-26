import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_RULE, checkStatus } from "../lib/fieldChecks";
import { DEMO_POLICIES, findPolicy } from "../lib/policies";
import { indexClass, payoutClass, riskClass } from "../lib/scales";
import { smsParts } from "../lib/sms";

describe("checkStatus", () => {
  const status = (payout: number, reports: number, lossShare: number | null) => checkStatus(payout, reports, lossShare, DEFAULT_RULE);

  it("flags loss evidence the index did not pay for", () => {
    assert.equal(status(0, 3, null), "check");
    assert.equal(status(0, 0, 0.47), "check");
    assert.equal(status(0.002, 0, 0.59), "check"); // Ngoma 2019: a token payout
  });

  it("is settled by a real payout", () => {
    assert.equal(status(0.4, 5, 0.5), "paid");
    assert.equal(status(0.1, 0, null), "paid");
  });

  it("watches weak evidence and clears the rest", () => {
    assert.equal(status(0, 1, null), "watch");
    assert.equal(status(0, 0, 0.36), "watch");
    assert.equal(status(0, 0, 0.2), "clear");
    assert.equal(status(0, 0, null), "clear");
  });
});

describe("smsParts", () => {
  it("fits 160 plain characters in one SMS and 153 per part after that", () => {
    assert.deepEqual(smsParts("a".repeat(160)), { length: 160, encoding: "GSM", parts: 1 });
    assert.equal(smsParts("a".repeat(161)).parts, 2);
    assert.equal(smsParts("a".repeat(307)).parts, 3);
  });

  it("counts extension characters twice", () => {
    assert.equal(smsParts("€".repeat(80)).length, 160);
    assert.equal(smsParts("€".repeat(81)).parts, 2);
  });

  it("switches to UCS-2 for one character outside the GSM alphabet", () => {
    assert.deepEqual(smsParts("07•• ••• 123"), { length: 12, encoding: "UCS-2", parts: 1 });
    assert.equal(smsParts("•" + "a".repeat(70)).parts, 2);
  });

  it("keeps every demo policy's masked phone in GSM", () => {
    for (const p of DEMO_POLICIES) assert.equal(smsParts(p.phone).encoding, "GSM");
  });
});

describe("findPolicy", () => {
  it("has two policies per district with unique ids", () => {
    assert.equal(DEMO_POLICIES.length, 14);
    assert.equal(new Set(DEMO_POLICIES.map((p) => p.id)).size, 14);
  });

  it("ignores case and spaces and rejects unknown ids", () => {
    assert.equal(findPolicy("  rdi-rwa-1233")?.district, "Rwamagana");
    assert.equal(findPolicy("RDI-XXX-0000"), undefined);
  });
});

describe("colour classes", () => {
  it("bands the index by trigger and exit", () => {
    const key = (v: number) => indexClass(v, -2, -22).key;
    assert.deepEqual([15, 0, -5, -12, -18, -25].map(key), ["gain", "normal", "watch", "moderate", "severe", "extreme"]);
  });

  it("bands payouts and basis risk", () => {
    assert.deepEqual([0, 0.2, 0.5, 0.9, 1].map((s) => payoutClass(s).key), ["none", "watch", "moderate", "severe", "extreme"]);
    assert.deepEqual([0.05, 0.15, 0.25, 0.4].map((r) => riskClass(r).key), ["low", "some", "high", "very"]);
  });
});
