"use client";

import { useState } from "react";

/**
 * A number box you can type into freely. While typing, any value inside the range
 * updates the page at once; out-of-range or half-typed values ("1" on the way to
 * "1500", an empty box) are left alone until you leave the box or press Enter,
 * when the value is clamped to the range. Arrow keys step up and down.
 */
export default function NumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  ariaLabel,
  className = "",
}: {
  id?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  ariaLabel?: string;
  className?: string;
}) {
  // What the user is typing; null shows the current value.
  const [draft, setDraft] = useState<string | null>(null);
  const parse = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/,/g, "")));
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  function commit() {
    if (draft === null) return;
    const n = parse(draft);
    if (Number.isFinite(n)) onChange(clamp(n));
    setDraft(null);
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = parse(e.target.value);
        if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const base = Number.isFinite(parse(draft ?? "")) ? parse(draft!) : value;
          onChange(clamp(base + (e.key === "ArrowUp" ? step : -step)));
          setDraft(null);
        }
      }}
      className={`tabular ${className}`}
    />
  );
}
