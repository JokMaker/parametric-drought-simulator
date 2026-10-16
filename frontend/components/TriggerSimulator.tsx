"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import IndexVsActualChart from "@/components/charts/IndexVsActualChart";
import { Card, DotCount } from "@/components/ui";
import { POOR_RULE } from "@/lib/constants";
import { classify, payoutFromIndex, pct } from "@/lib/payout";
import type { ModelSummary, Simulation } from "@/lib/types";

/** Outcomes of the district-seasons with harvest data under a given trigger and exit. */
function score(seasons: Simulation[], m: ModelSummary, trigger: number, exit: number) {
  const known = seasons.filter((s) => s.actualYieldAnom !== null);
  const o = known.map((s) => classify(s, { trigger, lowYieldThreshold: m.lowYieldThreshold }));
  const poor = o.filter((x) => x === "hit" || x === "miss").length;
  const risk =
    known.reduce(
      (a, s) => a + Math.abs(payoutFromIndex(s.index, trigger, exit) - payoutFromIndex(s.actualYieldAnom!, trigger, exit)),
      0,
    ) / known.length;
  return {
    total: known.length,
    poor,
    normal: known.length - poor,
    hits: o.filter((x) => x === "hit").length,
    misses: o.filter((x) => x === "miss").length,
    falsePay: o.filter((x) => x === "false-payout").length,
    right: o.filter((x) => x === "hit" || x === "correct-no-payout").length,
    risk,
  };
}

function Slider({ id, label, value, min, max, onChange, mark }: {
  id: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void; mark: number;
}) {
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular text-lg font-semibold">{value}%</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--accent)]"
      />
      <div className="tabular relative h-4 text-[11px] text-faint">
        <span>{min}%</span>
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-muted"
          style={{ left: `${((mark - min) / (max - min)) * 100}%` }}
        >
          ▲ model {mark}%
        </span>
        <span className="absolute right-0">{max}%</span>
      </div>
    </div>
  );
}

/**
 * An explorable trade-off: move the trigger and see which seasons would be paid.
 * A higher trigger pays more poor harvests but also more good ones.
 */
export default function TriggerSimulator({ seasons, model }: { seasons: Simulation[]; model: ModelSummary }) {
  const [trigger, setTrigger] = useState(model.trigger);
  const [exit, setExit] = useState(model.exit);
  const base = score(seasons, model, model.trigger, model.exit);
  const now = score(seasons, model, trigger, exit);
  const changed = trigger !== model.trigger || exit !== model.exit;

  const diff = (a: number, b: number, more: string, fewer: string) =>
    a === b ? null : a > b ? `${a - b} ${more}` : `${b - a} ${fewer}`;
  const effects = [
    diff(now.hits, base.hits, "more poor harvests paid", "fewer poor harvests paid"),
    diff(now.falsePay, base.falsePay, "more false payouts", "fewer false payouts"),
  ].filter(Boolean);

  const title = !changed
    ? `At the model's ${model.trigger}% trigger, ${now.hits} of ${now.poor} poor harvests are paid and ${now.falsePay} good seasons are paid by mistake`
    : effects.length
      ? `A ${trigger}% trigger gives ${effects.join(" and ")} than the model's ${model.trigger}%`
      : `A ${trigger}% trigger makes the same pay / no-pay decisions as the model's ${model.trigger}%`;

  const delta = (a: number, b: number, goodWhenUp: boolean, fmt = (x: number) => String(x)) => {
    if (a === b || !changed) return null;
    const up = a > b;
    const good = up === goodWhenUp;
    return (
      <span className="tabular ml-1.5 text-xs font-medium" style={{ color: good ? "var(--other)" : "var(--drought)" }}>
        {up ? "▲" : "▼"} {fmt(Math.abs(a - b))}
      </span>
    );
  };

  return (
    <Card
      label="What if · try a different trigger"
      title={title}
      action={
        changed && (
          <button
            onClick={() => {
              setTrigger(model.trigger);
              setExit(model.exit);
            }}
            className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1 text-sm text-muted hover:bg-surface-2 hover:text-ink"
          >
            <RotateCcw size={14} /> Reset to model
          </button>
        )
      }
      source={`Recomputed in the browser for the ${now.total} district-seasons with NISR harvest data, using the leave-one-out index. ${POOR_RULE(model.lowYieldThreshold)} Basis risk is the average gap between the index payout and the payout the real harvest would give under the same trigger and exit.`}
    >
      <div className="flex flex-col gap-5 sm:flex-row">
        <Slider
          id="sim-trigger"
          label="Trigger: payout starts"
          value={trigger}
          min={-20}
          max={5}
          mark={model.trigger}
          onChange={(v) => {
            setTrigger(v);
            if (exit > v - 5) setExit(v - 5);
          }}
        />
        <Slider
          id="sim-exit"
          label="Exit: full payout"
          value={exit}
          min={-45}
          max={-5}
          mark={model.exit}
          onChange={(v) => setExit(Math.min(v, trigger - 5))}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line md:grid-cols-4">
        {[
          { k: "Poor harvests paid", v: `${now.hits} of ${now.poor}`, d: delta(now.hits, base.hits, true), dots: <DotCount filled={now.hits} total={now.poor} color="var(--sev-extreme)" /> },
          { k: "Missed", v: `${now.misses}`, d: delta(now.misses, base.misses, false), dots: <DotCount filled={now.misses} total={now.poor} color="var(--risk-4)" /> },
          { k: "False payouts", v: `${now.falsePay} of ${now.normal}`, d: delta(now.falsePay, base.falsePay, false), dots: <DotCount filled={now.falsePay} total={now.normal} color="var(--risk-4)" /> },
          { k: "Basis risk", v: pct(now.risk), d: delta(Math.round(now.risk * 100), Math.round(base.risk * 100), false, (x) => `${x} pts`), dots: null },
        ].map((c) => (
          <div key={c.k} className="bg-surface px-4 py-3">
            <div className="text-xs text-muted">{c.k}</div>
            <div className="tabular mt-0.5 text-xl font-semibold">
              {c.v}
              {c.d}
            </div>
            {c.dots && <div className="mt-1.5">{c.dots}</div>}
          </div>
        ))}
      </div>

      <div className="mt-5">
        <IndexVsActualChart seasons={seasons} model={{ ...model, trigger, exit }} />
      </div>
    </Card>
  );
}
