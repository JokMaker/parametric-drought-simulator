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

const RED = "#b42318";
const GREY = "#8a95a3";
const AMBER = "#a15c07";
const AXIS_TICK = { fontSize: 11, fill: "#5d6877" };
// Same left margin and axis width on both charts so the years line up.
const MARGIN = { top: 16, right: 16, bottom: 0, left: 0 };
const Y_WIDTH = 48;

function YearTooltip({ active, payload }: TooltipContentProps) {
  const d = payload?.[0]?.payload as YearBar | undefined;
  if (!active || !d) return null;
  return (
    <div className="tabular rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <div className="font-semibold">
        {d.year} rains · Season A {d.year + 1}
      </div>
      {d.droughtYear && <div className="text-drought">Documented drought year</div>}
      <div className="mt-1">Predicted yield change: {d.index.toFixed(1)}%</div>
      <div>
        Payout: <span className="font-semibold">{(d.payout * 100).toFixed(0)}%</span>
        {d.districts > 1 && " average"}
      </div>
      {d.districts > 1 && (
        <div className="text-muted">
          {d.paying} of {d.districts} districts paid
        </div>
      )}
    </div>
  );
}

export function IndexChart({ data, trigger, exit }: { data: YearBar[]; trigger: number; exit: number }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={MARGIN} syncId="history">
        <CartesianGrid vertical={false} stroke="#e2e5e0" />
        <XAxis dataKey="year" tick={AXIS_TICK} tickLine={false} interval={1} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          unit="%"
          width={Y_WIDTH}
          domain={[(min: number) => Math.floor(Math.min(min, exit - 3)), "auto"]}
          allowDecimals={false}
        />
        <Tooltip cursor={{ fill: "rgba(27,36,48,0.05)" }} content={YearTooltip} />
        <ReferenceLine y={0} stroke="#1b2430" strokeOpacity={0.4} />
        <ReferenceLine
          y={trigger}
          stroke="#1b2430"
          strokeDasharray="5 4"
          label={{ value: `Trigger ${trigger}%`, position: "insideBottomRight", fontSize: 11, fill: "#1b2430" }}
        />
        <ReferenceLine
          y={exit}
          stroke={RED}
          strokeDasharray="2 4"
          label={{ value: `Exit ${exit}%`, position: "insideBottomRight", fontSize: 11, fill: RED }}
        />
        <Bar dataKey="index" radius={[2, 2, 2, 2]} maxBarSize={22} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.year} fill={d.droughtYear ? RED : GREY} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PayoutChart({ data }: { data: YearBar[] }) {
  const fmt = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={MARGIN} syncId="history">
        <CartesianGrid vertical={false} stroke="#e2e5e0" />
        <XAxis dataKey="year" tick={AXIS_TICK} tickLine={false} interval={1} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={Y_WIDTH}
          domain={[0, 1]}
          ticks={[0, 0.5, 1]}
          tickFormatter={fmt}
        />
        <Tooltip cursor={{ fill: "rgba(27,36,48,0.05)" }} content={YearTooltip} />
        <Bar dataKey="payout" radius={[2, 2, 0, 0]} maxBarSize={22} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.year} fill={AMBER} fillOpacity={d.droughtYear ? 1 : 0.55} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
