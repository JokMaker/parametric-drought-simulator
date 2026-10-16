// One colour meaning across the dashboard: red = drought or payout, green = normal.
// Values fall into named classes (like drought-monitor categories) tied to the
// trigger and exit, so a colour always has a label. Colours are CSS variables, so
// every class follows light and dark mode.

export type ColorClass = { key: string; label: string; range: string; color: string };

const r = (v: number) => Math.round(v);

/**
 * Predicted yield change classes. The band between trigger and exit is split in
 * three, so each class is also a payout band (payout rises linearly in it).
 */
export function indexClasses(trigger: number, exit: number): ColorClass[] {
  const step = (trigger - exit) / 3;
  const a = trigger - step;
  const b = trigger - 2 * step;
  return [
    { key: "gain", label: "Above normal", range: "> +10%", color: "var(--sev-gain)" },
    { key: "normal", label: "Near normal, no payout", range: `${r(trigger)} to +10%`, color: "var(--sev-normal)" },
    { key: "watch", label: "Payout starts", range: `${r(trigger)} to ${r(a)}%`, color: "var(--sev-watch)" },
    { key: "moderate", label: "Moderate loss", range: `${r(a)} to ${r(b)}%`, color: "var(--sev-moderate)" },
    { key: "severe", label: "Severe loss", range: `${r(b)} to ${r(exit)}%`, color: "var(--sev-severe)" },
    { key: "extreme", label: "Full payout", range: `≤ ${r(exit)}%`, color: "var(--sev-extreme)" },
  ];
}

export function indexClass(value: number, trigger: number, exit: number): ColorClass {
  const c = indexClasses(trigger, exit);
  const step = (trigger - exit) / 3;
  if (value > 10) return c[0];
  if (value > trigger) return c[1];
  if (value > trigger - step) return c[2];
  if (value > trigger - 2 * step) return c[3];
  if (value > exit) return c[4];
  return c[5];
}

/** Payout share 0–1, on the same ramp as the index (payout grows as the index falls). */
export const PAYOUT_CLASSES: ColorClass[] = [
  { key: "none", label: "No payout", range: "0%", color: "var(--sev-normal)" },
  { key: "watch", label: "Small payout", range: "1–33%", color: "var(--sev-watch)" },
  { key: "moderate", label: "Partial payout", range: "34–66%", color: "var(--sev-moderate)" },
  { key: "severe", label: "Large payout", range: "67–99%", color: "var(--sev-severe)" },
  { key: "extreme", label: "Full payout", range: "100%", color: "var(--sev-extreme)" },
];

export function payoutClass(share: number): ColorClass {
  if (share <= 0) return PAYOUT_CLASSES[0];
  if (share <= 1 / 3) return PAYOUT_CLASSES[1];
  if (share <= 2 / 3) return PAYOUT_CLASSES[2];
  if (share < 1) return PAYOUT_CLASSES[3];
  return PAYOUT_CLASSES[4];
}

/** Basis risk 0–1: how far the index payout was from what the harvest called for. */
export const RISK_CLASSES: ColorClass[] = [
  { key: "low", label: "Close match", range: "< 10%", color: "var(--risk-1)" },
  { key: "some", label: "Some mismatch", range: "10–20%", color: "var(--risk-2)" },
  { key: "high", label: "High mismatch", range: "20–30%", color: "var(--risk-3)" },
  { key: "very", label: "Very high mismatch", range: "≥ 30%", color: "var(--risk-4)" },
];

export function riskClass(risk: number): ColorClass {
  if (risk < 0.1) return RISK_CLASSES[0];
  if (risk < 0.2) return RISK_CLASSES[1];
  if (risk < 0.3) return RISK_CLASSES[2];
  return RISK_CLASSES[3];
}

/** Dark classes need light text on top of them. */
export const isDark = (c: ColorClass) => c.key === "extreme" || c.key === "severe" || c.key === "very" || c.key === "gain";
