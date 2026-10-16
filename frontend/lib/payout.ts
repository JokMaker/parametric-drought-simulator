import type { Simulation } from "./types";

/** Linear payout: 0 at or above the trigger, rising to 1 at the exit. */
export function payoutFromIndex(index: number, trigger: number, exit: number) {
  const p = (trigger - index) / (trigger - exit);
  return Math.min(1, Math.max(0, p));
}

/** Plain-language label for a z-score anomaly, e.g. "0.5 below normal". */
export function anomalyLabel(z: number) {
  if (Math.abs(z) < 0.05) return "about normal";
  return `${Math.abs(z).toFixed(1)} ${z > 0 ? "above" : "below"} normal`;
}

export function pct(x: number, digits = 0) {
  return `${(x * 100).toFixed(digits)}%`;
}

export function signedPct(x: number, digits = 1) {
  return `${x > 0 ? "+" : ""}${x.toFixed(digits)}%`;
}

/** FR6: the reason sentence shown with every payout decision. */
export function reason(s: Simulation, trigger: number, exit: number) {
  const seen = `Rainfall was ${anomalyLabel(s.rainZ)} and crop greenness ${anomalyLabel(s.ndviZ)}.`;
  const idx = `${s.index.toFixed(1)}%`;
  if (s.payout <= 0)
    return `${seen} Predicted yield change of ${idx} is above the ${trigger}% trigger, so no payout.`;
  if (s.payout >= 1)
    return `${seen} Predicted yield change of ${idx} is past the ${exit}% exit, so the full payout applies.`;
  return `${seen} Predicted yield change of ${idx} is between the ${trigger}% trigger and the ${exit}% exit, so ${pct(s.payout)} of the full payout applies.`;
}

export type Outcome = "hit" | "miss" | "false-payout" | "correct-no-payout";

/**
 * Compares the index decision with what actual yields implied. Two separate
 * thresholds: a season is "poor" when the actual yield change is at or below
 * `lowYieldThreshold` (-10%); the index "pays" when it is at or below the `trigger`.
 */
export function classify(
  s: Simulation,
  { trigger, lowYieldThreshold }: { trigger: number; lowYieldThreshold: number },
): Outcome | null {
  if (s.actualYieldAnom === null) return null;
  const poor = s.actualYieldAnom <= lowYieldThreshold;
  const paid = s.index <= trigger;
  if (poor) return paid ? "hit" : "miss";
  return paid ? "false-payout" : "correct-no-payout";
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  hit: "Paid in a poor season",
  miss: "Missed a poor season",
  "false-payout": "False payout",
  "correct-no-payout": "Correctly did not pay",
};
