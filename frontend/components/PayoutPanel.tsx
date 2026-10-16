"use client";

import { classify, pct, reason, signedPct } from "@/lib/payout";
import { indexClass, indexClasses, payoutClass } from "@/lib/scales";
import type { ModelSummary, Simulation } from "@/lib/types";
import { Card } from "./ui";

// Yield-change range drawn on the payout scale: losses on the left, gains on the right.
const LOW = -40;
const HIGH = 30;
const at = (v: number) => ((Math.min(HIGH, Math.max(LOW, v)) - LOW) / (HIGH - LOW)) * 100;

const SOURCE_SAT = "CHIRPS rainfall and MODIS NDVI, October–December, against each district's own record.";

function payoutHeadline(sim: Simulation, m: ModelSummary) {
  const loss = sim.index < 0 ? `${Math.abs(sim.index).toFixed(0)}% below normal` : `${sim.index.toFixed(0)}% above normal`;
  if (sim.payout >= 1) return `Full payout: the index predicts a harvest ${loss}`;
  if (sim.payout > 0) return `${pct(sim.payout)} payout: the index predicts a harvest ${loss}`;
  return sim.index <= m.trigger
    ? `No payout yet: the index sits at the ${m.trigger}% trigger`
    : `No payout: the index predicts a harvest ${loss}`;
}

function satelliteHeadline(sim: Simulation) {
  const word = (z: number) => (Math.abs(z) < 0.25 ? "near normal" : z < 0 ? "below normal" : "above normal");
  const rain = word(sim.rainZ);
  const green = word(sim.ndviZ);
  if (rain === green) return `Rainfall and crop greenness were both ${rain}`;
  return `Rainfall was ${rain}; crop greenness was ${green}`;
}

function harvestHeadline(sim: Simulation, m: ModelSummary) {
  const outcome = classify(sim, m)!;
  const actual = sim.actualYieldAnom!;
  const fell = actual < 0 ? `the harvest fell ${Math.abs(actual).toFixed(0)}%` : `the harvest rose ${actual.toFixed(0)}%`;
  switch (outcome) {
    case "hit":
      return `Correct: ${fell} and the index paid ${pct(sim.payout)}`;
    case "miss":
      return `Missed: ${fell} but the index paid nothing`;
    case "false-payout":
      return `False payout: the index paid ${pct(sim.payout)} but ${fell}`;
    default:
      return `Correct: no payout, and ${fell}`;
  }
}

/** Index position across the severity classes, with the harvest marked when known. */
function PayoutScale({ sim, model }: { sim: Simulation; model: ModelSummary }) {
  const { trigger, exit } = model;
  const step = (trigger - exit) / 3;
  const classes = indexClasses(trigger, exit);
  // Class bands from left (worst) to right (best).
  const bands = [
    { from: LOW, to: exit, c: classes[5] },
    { from: exit, to: exit + step, c: classes[4] },
    { from: exit + step, to: exit + 2 * step, c: classes[3] },
    { from: exit + 2 * step, to: trigger, c: classes[2] },
    { from: trigger, to: 10, c: classes[1] },
    { from: 10, to: HIGH, c: classes[0] },
  ];
  return (
    <div className="pt-4 pb-1">
      <div className="relative">
        <div className="flex h-3 overflow-hidden rounded-sm">
          {bands.map((b) => (
            <div key={b.c.key} style={{ width: `${at(b.to) - at(b.from)}%`, background: b.c.color }} />
          ))}
        </div>
        <span className="absolute -top-1.5 h-6 w-[3px] -translate-x-1/2 bg-ink" style={{ left: `${at(sim.index)}%` }} />
        {sim.actualYieldAnom !== null && (
          <span
            className="absolute -top-1.5 h-6 -translate-x-1/2 border-l-[3px] border-dotted border-ink"
            style={{ left: `${at(sim.actualYieldAnom)}%` }}
          />
        )}
      </div>
      <div className="tabular relative mt-2 h-4 text-[11px] text-muted">
        {[
          { v: exit, t: `${exit}% exit`, cls: "" },
          { v: trigger, t: `${trigger}% trigger`, cls: "" },
          // Too close to the trigger label on narrow screens.
          { v: 0, t: "0", cls: "hidden sm:inline" },
        ].map((x) => (
          <span key={x.t} className={`absolute -translate-x-1/2 whitespace-nowrap ${x.cls}`} style={{ left: `${at(x.v)}%` }}>
            {x.t}
          </span>
        ))}
      </div>
      <div className="tabular mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-[3px] bg-ink" /> Index {signedPct(sim.index)}
        </span>
        {sim.actualYieldAnom !== null && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 border-l-[3px] border-dotted border-ink" /> Actual harvest {signedPct(sim.actualYieldAnom)}
          </span>
        )}
      </div>
    </div>
  );
}

function AnomalyBar({ label, z }: { label: string; z: number }) {
  const LIMIT = 2.5;
  const w = (Math.min(LIMIT, Math.abs(z)) / LIMIT) * 50;
  const below = z < 0;
  return (
    <div className="grid grid-cols-[150px_1fr_110px] items-center gap-4 text-sm">
      <span>{label}</span>
      <div className="relative h-3 bg-surface-2">
        <div className="absolute inset-y-[-4px] left-1/2 w-px bg-ink/40" />
        <div
          className="absolute inset-y-0"
          style={{
            background: below ? "var(--drought)" : "var(--other)",
            ...(below ? { right: "50%", width: `${w}%` } : { left: "50%", width: `${w}%` }),
          }}
        />
      </div>
      <span className="tabular text-right">
        <span className="font-medium">{Math.abs(z).toFixed(1)}</span>{" "}
        <span className="text-muted">{z < 0 ? "below" : "above"}</span>
      </span>
    </div>
  );
}

function CompareRow({ label, value, min, max, color, text }: {
  label: string; value: number; min: number; max: number; color: string; text: string;
}) {
  const span = max - min;
  const zero = ((0 - min) / span) * 100;
  const v = Math.min(max, Math.max(min, value));
  const p = ((v - min) / span) * 100;
  return (
    <div className="grid grid-cols-[150px_1fr_70px] items-center gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <div className="relative h-3 bg-surface-2">
        {min < 0 && <div className="absolute inset-y-[-4px] w-px bg-ink/40" style={{ left: `${zero}%` }} />}
        <div className="absolute inset-y-0" style={{ left: `${Math.min(zero, p)}%`, width: `${Math.abs(p - zero)}%`, background: color }} />
      </div>
      <span className="tabular text-right font-medium">{text}</span>
    </div>
  );
}

export function PayoutCard({ sim, model }: { sim: Simulation; model: ModelSummary }) {
  return (
    <Card
      label={`Payout · ${sim.district}, Season A ${sim.season}`}
      title={payoutHeadline(sim, model)}
      source={`${model.model} model. Payout starts at the ${model.trigger}% trigger and is full at the ${model.exit}% exit.`}
    >
      <div className="flex flex-wrap gap-x-12 gap-y-3">
        <div>
          <div className="tabular text-4xl font-semibold tracking-tight">{pct(sim.payout)}</div>
          <div className="mt-1 text-[13px] text-muted">of the full payout</div>
        </div>
        <div>
          <div className="tabular text-4xl font-semibold tracking-tight">{signedPct(sim.index)}</div>
          <div className="mt-1 text-[13px] text-muted">predicted yield change</div>
        </div>
      </div>
      <PayoutScale sim={sim} model={model} />
      <p className="mt-3 text-sm text-muted">{reason(sim, model.trigger, model.exit)}</p>
    </Card>
  );
}

export function SatelliteCard({ sim }: { sim: Simulation }) {
  return (
    <Card label="What the satellites saw" title={satelliteHeadline(sim)} source={SOURCE_SAT + " Units: standard deviations."}>
      <div className="space-y-3">
        <AnomalyBar label="Rainfall" z={sim.rainZ} />
        <AnomalyBar label="Crop greenness (NDVI)" z={sim.ndviZ} />
      </div>
    </Card>
  );
}

export function HarvestCard({ sim, model }: { sim: Simulation; model: ModelSummary }) {
  if (sim.actualYieldAnom === null || sim.payoutIfActual === null) return null;
  const gap = Math.abs(sim.payout - sim.payoutIfActual);
  return (
    <Card
      label="Check against the harvest"
      title={harvestHeadline(sim, model)}
      source={`NISR Seasonal Agricultural Survey, Season A ${sim.season}. A harvest ${Math.abs(model.lowYieldThreshold)}% or more below normal counts as poor.`}
    >
      <div className="space-y-3">
        <CompareRow label="Predicted (index)" value={sim.index} min={-50} max={50} text={signedPct(sim.index)}
          color={indexClass(sim.index, model.trigger, model.exit).color} />
        <CompareRow label="Actual harvest" value={sim.actualYieldAnom} min={-50} max={50} text={signedPct(sim.actualYieldAnom)}
          color={indexClass(sim.actualYieldAnom, model.trigger, model.exit).color} />
        <div className="h-1" />
        <CompareRow label="Index paid" value={sim.payout} min={0} max={1} text={pct(sim.payout)} color={payoutClass(sim.payout).color} />
        <CompareRow label="Harvest called for" value={sim.payoutIfActual} min={0} max={1} text={pct(sim.payoutIfActual)}
          color={payoutClass(sim.payoutIfActual).color} />
      </div>
      <p className="tabular mt-4 text-sm">
        Gap between the two payouts (basis risk): <span className="font-semibold">{pct(gap)}</span>
      </p>
    </Card>
  );
}
