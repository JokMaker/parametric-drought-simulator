"use client";

import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { classify, OUTCOME_LABEL, signedPct, type Outcome } from "@/lib/payout";
import type { ModelSummary, Simulation } from "@/lib/types";

type Dot = { x: number; y: number; district: string; season: number; outcome: Outcome };

const MATCH = "var(--ink)";
const MISMATCH = "var(--pay)";
const TICK = { fontSize: 11, fill: "var(--muted)" };

function DotTooltip({ active, payload }: TooltipContentProps) {
  const d = payload?.[0]?.payload as Dot | undefined;
  if (!active || !d) return null;
  return (
    <div className="card tabular min-w-[200px] space-y-0.5 px-3 py-2.5 text-xs shadow-lg">
      <div className="font-semibold">
        {d.district} · Season A {d.season}
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted">Actual yield change</span>
        <span className="font-medium">{signedPct(d.x)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted">Predicted (index)</span>
        <span className="font-medium">{signedPct(d.y)}</span>
      </div>
      <div className="pt-1 text-muted">{OUTCOME_LABEL[d.outcome]}</div>
    </div>
  );
}

/** Each calibration district-season: predicted (leave-one-out) against actual yield change. */
export default function IndexVsActualChart({ seasons, model }: { seasons: Simulation[]; model: ModelSummary }) {
  const dots: Dot[] = seasons
    .filter((s) => s.actualYieldAnom !== null)
    .map((s) => ({
      x: s.actualYieldAnom!,
      y: s.index,
      district: s.district,
      season: s.season,
      outcome: classify(s, model)!,
    }));
  const match = dots.filter((d) => d.outcome === "hit" || d.outcome === "correct-no-payout");
  const mismatch = dots.filter((d) => d.outcome === "miss" || d.outcome === "false-payout");
  const lim = Math.ceil(Math.max(...dots.flatMap((d) => [Math.abs(d.x), Math.abs(d.y)])) / 10) * 10;

  return (
    <div>
      <ResponsiveContainer width="100%" height={330}>
        <ScatterChart margin={{ top: 12, right: 16, bottom: 18, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" />
          {/* Payout zone: index at or below the trigger. */}
          <ReferenceArea y1={-lim} y2={model.trigger} fill="var(--drought)" fillOpacity={0.07} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[-lim, lim]}
            tick={TICK}
            tickLine={false}
            unit="%"
            label={{ value: "Actual yield change", position: "insideBottom", offset: -12, fontSize: 11, fill: "var(--muted)" }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[-lim, lim]}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            unit="%"
            width={48}
          />
          <ZAxis range={[70, 70]} />
          <ReferenceLine
            segment={[
              { x: -lim, y: -lim },
              { x: lim, y: lim },
            ]}
            stroke="var(--faint)"
            strokeDasharray="1 4"
          />
          <ReferenceLine
            y={model.trigger}
            stroke="var(--ink)"
            strokeDasharray="5 4"
            label={{ value: `Trigger ${model.trigger}%`, position: "insideTopRight", fontSize: 11, fill: "var(--ink)" }}
          />
          <ReferenceLine
            x={model.lowYieldThreshold}
            stroke="var(--drought)"
            strokeDasharray="2 3"
            label={{ value: `Poor harvest ${model.lowYieldThreshold}%`, position: "insideTopLeft", fontSize: 11, fill: "var(--muted)" }}
          />
          <Tooltip content={DotTooltip} cursor={false} />
          <Scatter data={match} fill={MATCH} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false} />
          <Scatter data={mismatch} fill={MISMATCH} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: MATCH }} />
          Decision matched the harvest ({match.length})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: MISMATCH }} />
          Missed season or false payout ({mismatch.length})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-3 rounded-sm" style={{ background: "var(--drought)", opacity: 0.25 }} />
          Payout zone
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t border-dotted border-faint" />
          Perfect prediction
        </span>
      </div>
    </div>
  );
}
