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

export type YearBar = {
  year: number; // window year (Oct–Dec rains)
  index: number; // average predicted yield change (%)
  payout: number; // average payout, 0 to 1
  paying: number; // districts that paid
  districts: number; // districts shown
  droughtYear: boolean;
};

// Theme variables (see globals.css) so both charts follow light and dark mode.
const DROUGHT = "var(--drought)";
const OTHER = "var(--other)";
const INK = "var(--ink)";
const AXIS_TICK = { fontSize: 11, fill: "var(--muted)" };
const GRID = "var(--grid)";
// Same margins and axis width on both charts so the years line up.
const MARGIN = { top: 16, right: 12, bottom: 0, left: 0 };
const Y_WIDTH = 48;

const colour = (d: YearBar) => (d.droughtYear ? DROUGHT : OTHER);

function YearTooltip({ active, payload }: TooltipContentProps) {
  const d = payload?.[0]?.payload as YearBar | undefined;
  if (!active || !d) return null;
  return (
    <div className="card tabular min-w-[190px] px-3 py-2.5 text-xs shadow-lg">
      <div className="font-semibold">
        {d.year} rains · Season A {d.year + 1}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-muted">
        <span className="h-2 w-2 rounded-sm" style={{ background: colour(d) }} />
        {d.droughtYear ? "Documented drought year" : "Other year"}
      </div>
      <div className="mt-2 flex justify-between gap-4">
        <span className="text-muted">Predicted yield change</span>
        <span className="font-medium">{d.index.toFixed(1)}%</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted">{d.districts > 1 ? "Average payout" : "Payout"}</span>
        <span className="font-medium">{(d.payout * 100).toFixed(0)}%</span>
      </div>
      {d.districts > 1 && (
        <div className="flex justify-between gap-4">
          <span className="text-muted">Districts paid</span>
          <span className="font-medium">
            {d.paying} of {d.districts}
          </span>
        </div>
      )}
    </div>
  );
}

const cursor = { fill: "var(--surface-2)" };

export function IndexChart({ data, trigger, exit }: { data: YearBar[]; trigger: number; exit: number }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={MARGIN} syncId="history" barCategoryGap={3}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="year" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={1} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          unit="%"
          width={Y_WIDTH}
          domain={[(min: number) => Math.floor(Math.min(min, exit - 3)), "auto"]}
          allowDecimals={false}
        />
        <Tooltip cursor={cursor} content={YearTooltip} />
        <ReferenceLine y={0} stroke={INK} strokeOpacity={0.35} />
        <ReferenceLine
          y={trigger}
          stroke={INK}
          strokeDasharray="5 4"
          label={{ value: `Trigger ${trigger}%`, position: "insideBottomRight", fontSize: 11, fill: INK }}
        />
        <ReferenceLine
          y={exit}
          stroke={INK}
          strokeOpacity={0.6}
          strokeDasharray="2 4"
          label={{ value: `Exit ${exit}%`, position: "insideBottomRight", fontSize: 11, fill: "var(--muted)" }}
        />
        <Bar dataKey="index" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.year} fill={colour(d)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PayoutChart({ data }: { data: YearBar[] }) {
  const fmt = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} margin={MARGIN} syncId="history" barCategoryGap={3}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="year" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={1} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={Y_WIDTH}
          domain={[0, 1]}
          ticks={[0, 0.5, 1]}
          tickFormatter={fmt}
        />
        <Tooltip cursor={cursor} content={YearTooltip} />
        <Bar dataKey="payout" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.year} fill={colour(d)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
