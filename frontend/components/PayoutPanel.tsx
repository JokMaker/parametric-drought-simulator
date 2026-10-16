"use client";

import { classify, pct, reason, signedPct } from "@/lib/payout";
import { indexClass, indexClasses, payoutClass } from "@/lib/scales";
import type { ModelSummary, Simulation } from "@/lib/types";
import { ArrowRight } from "lucide-react";
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

/** A marker under the scale with its label beside it, flipped to the left near the right edge. */
function Pin({ value, label, dotted = false }: { value: number; label: string; dotted?: boolean }) {
  const pos = at(value);
  const flip = pos > 70;
  return (
    <div className="relative h-6">
      <span
        className={`absolute inset-y-0 -translate-x-1/2 ${dotted ? "border-l-2 border-dotted border-ink" : "w-0.5 bg-ink"}`}
        style={{ left: `${pos}%` }}
      />
      <span
        className={`tabular absolute bottom-0.5 whitespace-nowrap text-xs font-medium ${flip ? "-translate-x-full pr-2" : "pl-2"}`}
        style={{ left: `${pos}%` }}
      >
        {label}
      </span>
    </div>
  );
}

/** Index position across the severity classes, with the payout zones named on the bar. */
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
  const zones = [
    { from: LOW, to: exit, t: "Full payout", v: `≤ ${exit}%` },
    { from: exit, to: trigger, t: "Partial payout", v: `${trigger} to ${exit}%` },
    { from: trigger, to: HIGH, t: "No payout", v: `> ${trigger}%` },
  ];
  const harvest = sim.actualYieldAnom;
  return (
    <div className="pt-5">
      <div className="flex text-[11px]">
        {zones.map((z) => (
          <div
            key={z.t}
            className="border-l border-ink/30 px-1.5 first:border-l-0 first:pl-0"
            style={{ width: `${at(z.to) - at(z.from)}%` }}
          >
            <div className="truncate font-medium text-ink">{z.t}</div>
            <div className="tabular truncate text-faint">{z.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex h-3.5 overflow-hidden rounded-sm">
        {bands.map((b) => (
          <div key={b.c.key} style={{ width: `${at(b.to) - at(b.from)}%`, background: b.c.color }} />
        ))}
      </div>
      <Pin value={sim.index} label={`Index ${signedPct(sim.index)}`} />
      {harvest !== null && <Pin value={harvest} label={`Real harvest ${signedPct(harvest)}`} dotted />}
    </div>
  );
}

const DOWN = "var(--drought)";
const UP = "var(--other)";

/** One step of the index chain. */
function Step({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-sm bg-surface-2 px-3 py-2.5">
      <div className="truncate text-xs text-muted">{label}</div>
      <div className="tabular mt-0.5 text-2xl font-semibold tracking-tight" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

const sd = (z: number) => `${z < 0 ? "▼" : "▲"} ${Math.abs(z).toFixed(1)}`;

/** Satellites in, payout out: the whole index in one row. */
function Chain({ sim }: { sim: Simulation }) {
  const arrow = <ArrowRight size={16} className="hidden shrink-0 self-center text-faint sm:block" />;
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-stretch">
      <Step label="Rainfall" value={sd(sim.rainZ)} sub="SD from normal" color={sim.rainZ < 0 ? DOWN : UP} />
      <Step label="Crop greenness" value={sd(sim.ndviZ)} sub="SD from normal" color={sim.ndviZ < 0 ? DOWN : UP} />
      {arrow}
      <Step label="Predicted yield" value={signedPct(sim.index)} sub="vs a normal harvest" />
      {arrow}
      <Step label="Payout" value={pct(sim.payout)} sub="of the sum insured" />
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
      source={`${reason(sim, model.trigger, model.exit)} ${model.model} model; rainfall is CHIRPS and crop greenness MODIS NDVI, October–December, in standard deviations (SD) from each district's own record.`}
    >
      <Chain sim={sim} />
      <PayoutScale sim={sim} model={model} />
    </Card>
  );
}

export type InputSeason = { season: number; rainZ: number; ndviZ: number };

/** Every season as a dot on one line; the selected season stands out. */
function Strip({ label, low, high, series, pick, season }: {
  label: string; low: string; high: string; series: InputSeason[]; pick: (s: InputSeason) => number; season: number;
}) {
  const LIMIT = 2.5;
  const x = (z: number) => ((Math.min(LIMIT, Math.max(-LIMIT, z)) + LIMIT) / (2 * LIMIT)) * 100;
  const current = series.find((s) => s.season === season);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        {current && <span className="tabular font-semibold" style={{ color: pick(current) < 0 ? DOWN : UP }}>{sd(pick(current))} SD</span>}
      </div>
      <div className="relative h-7">
        <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-ink/30" />
        {series.map((s) =>
          s.season === season ? null : (
            <span
              key={s.season}
              title={`Season A ${s.season}`}
              className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-faint/60"
              style={{ left: `${x(pick(s))}%` }}
            />
          ),
        )}
        {current && (
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
            style={{ left: `${x(pick(current))}%`, background: pick(current) < 0 ? DOWN : UP }}
          />
        )}
      </div>
      <div className="flex justify-between text-[11px] text-muted">
        <span>← {low}</span>
        <span>normal</span>
        <span>{high} →</span>
      </div>
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "the lowest", "3rd-lowest", "2nd-highest"... of all seasons. */
function rankText(series: InputSeason[], pick: (s: InputSeason) => number, season: number) {
  const cur = series.find((s) => s.season === season);
  if (!cur) return "";
  const lower = series.filter((s) => pick(s) < pick(cur)).length;
  const n = series.length;
  if (lower === 0) return "the lowest";
  if (lower === n - 1) return "the highest";
  if (lower < n / 2) return `${ordinal(lower + 1)}-lowest`;
  return `${ordinal(n - lower)}-highest`;
}

export function SatelliteCard({ sim, series }: { sim: Simulation; series: InputSeason[] }) {
  const ranked = series.some((s) => s.season === sim.season);
  return (
    <Card
      label={`What the satellites saw · ${sim.district}, ${series.length} seasons`}
      title={
        ranked
          ? `Rainfall was ${rankText(series, (s) => s.rainZ, sim.season)} and crop greenness ${rankText(series, (s) => s.ndviZ, sim.season)} of ${series.length} seasons`
          : satelliteHeadline(sim)
      }
      source={SOURCE_SAT + " Units: standard deviations (SD). Each grey dot is another season; the large dot is this one."}
    >
      <div className="space-y-4">
        <Strip label="Rainfall" low="drier" high="wetter" series={series} pick={(s) => s.rainZ} season={sim.season} />
        <Strip label="Crop greenness (NDVI)" low="browner" high="greener" series={series} pick={(s) => s.ndviZ} season={sim.season} />
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
      <div className="tabular mt-4 flex flex-wrap items-baseline gap-x-2 border-t border-line pt-3 text-sm">
        <span className="text-muted">Basis risk</span>
        <span className="text-lg font-semibold">{pct(gap)}</span>
        <span className="text-muted">gap between the two payouts</span>
      </div>
    </Card>
  );
}
