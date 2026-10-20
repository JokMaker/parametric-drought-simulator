"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { rwf, type SeasonBook } from "@/lib/pricing";

const TICK = { fontSize: 11, fill: "var(--muted)" };

function BookTooltip({ active, payload }: TooltipContentProps) {
  const d = payload?.[0]?.payload as SeasonBook | undefined;
  if (!active || !d) return null;
  return (
    <div className="card tabular min-w-[210px] space-y-0.5 px-3 py-2.5 text-xs shadow-lg">
      <div className="font-semibold">Season A {d.season}</div>
      <div className="flex justify-between gap-4">
        <span className="text-muted">Payouts</span>
        <span className="font-medium">{rwf(d.payouts)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted">Premiums</span>
        <span className="font-medium">{rwf(d.premiums)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted">Loss ratio</span>
        <span className="font-medium">{Math.round(d.lossRatio * 100)}%</span>
      </div>
      <div className="text-muted">{d.districtsPaid} of 7 districts paid</div>
    </div>
  );
}

/** Payouts as a share of premiums, season by season; above 100% the scheme loses money. */
export default function LossRatioChart({ data }: { data: SeasonBook[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barCategoryGap={3}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="season" tick={TICK} tickLine={false} axisLine={false} interval={3} />
        <YAxis
          tick={TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          ticks={Array.from({ length: Math.ceil(Math.max(...data.map((d) => d.lossRatio))) + 1 }, (_, i) => i)}
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
        />
        <Tooltip content={BookTooltip} cursor={{ fill: "var(--surface-2)" }} />
        <ReferenceLine
          y={1}
          stroke="var(--ink)"
          strokeDasharray="5 4"
          label={{ value: "Break-even (100%)", position: "insideTopRight", fontSize: 11, fill: "var(--ink)" }}
        />
        <Bar dataKey="lossRatio" radius={[2, 2, 0, 0]} maxBarSize={22} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.season} style={{ fill: d.lossRatio > 1 ? "var(--sev-severe)" : "var(--other)" }} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
