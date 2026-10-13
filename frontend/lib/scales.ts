// One colour meaning across the dashboard: red = drought or payout, green = normal.
// Colours are CSS variables mixed in OKLab, so every scale follows light and dark mode.

const DROUGHT = "var(--drought)";
const NORMAL = "var(--other)";
const MID = "var(--div-mid)";
const RISK = "var(--pay)";

const mix = (color: string, share: number) =>
  `color-mix(in oklab, ${color} ${Math.round(Math.min(1, Math.max(0, share)) * 100)}%, ${MID})`;

/** Yield-change range the index colours span; values beyond it take the end colour. */
export const INDEX_RANGE = 30;

/** Predicted yield change (%): red below zero, green above, neutral at no change. */
export function indexColor(value: number) {
  return value < 0 ? mix(DROUGHT, -value / INDEX_RANGE) : mix(NORMAL, value / INDEX_RANGE);
}

/** Payout share 0–1: neutral at no payout, red at the full payout. */
export function payoutColor(share: number) {
  return share <= 0 ? MID : mix(DROUGHT, 0.2 + 0.8 * share);
}

/** Basis risk 0–1, on a 0–50% scale: neutral to orange. */
export const RISK_RANGE = 0.5;
export function riskColor(risk: number) {
  return mix(RISK, risk / RISK_RANGE);
}

export const INDEX_GRADIENT = `linear-gradient(90deg, ${DROUGHT}, ${MID}, ${NORMAL})`;
export const PAYOUT_GRADIENT = `linear-gradient(90deg, ${MID}, ${DROUGHT})`;
export const RISK_GRADIENT = `linear-gradient(90deg, ${MID}, ${RISK})`;
