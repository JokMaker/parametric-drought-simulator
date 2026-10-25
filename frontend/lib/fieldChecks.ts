// When does a district need a field check? When the index paid nothing (or too little) but there is
// evidence of loss on the ground: farmers' own reports, or (for past seasons) the
// share of surveyed farms whose harvest largely failed. This is the safety net for
// losses the satellites miss, such as Season A 2019.

// paidEnough: a payout below this share does not settle a district with strong loss
// evidence (in 2019 Ngoma lost 39% of its harvest and the index paid 0.2%).
export type CheckRule = { reports: number; lossShare: number; paidEnough: number };

// In ordinary seasons 10-40% of surveyed farms harvest under half the expected yield,
// because small plots vary a lot; in Season A 2019 it was 47-59% in every district.
// 45% marks an unusual season, and "watch" starts 10 points lower.
export const DEFAULT_RULE: CheckRule = { reports: 3, lossShare: 0.45, paidEnough: 0.25 };

export type CheckStatus = "paid" | "check" | "watch" | "clear";

export const STATUS_LABEL: Record<CheckStatus, string> = {
  paid: "Paid by the index",
  check: "Field check needed",
  watch: "Watch",
  clear: "No sign of loss",
};

export function checkStatus(
  payout: number,
  reports: number,
  lossShare: number | null,
  rule: CheckRule,
): CheckStatus {
  const evidence = reports >= rule.reports || (lossShare ?? 0) >= rule.lossShare;
  if (evidence && payout < rule.paidEnough) return "check";
  if (payout > 0) return "paid";
  if (reports > 0 || (lossShare ?? 0) >= rule.lossShare - 0.1) return "watch";
  return "clear";
}
