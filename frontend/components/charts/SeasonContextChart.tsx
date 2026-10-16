"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { DROUGHT_YEARS } from "@/lib/constants";
import { pct, signedPct } from "@/lib/payout";
import { indexClass } from "@/lib/scales";

export type SeasonValue = { season: number; index: number; payout: number };

const TICK = { fontSize: 11, fill: "var(--muted)" };

// Documented drought periods, as Season A harvest years (rains fall the year before).
const DROUGHT_SEASON_RANGES: [number, number][] = DROUGHT_YEARS.map((y) => y + 1).reduce<[number, number][]>(
  (ranges, y) => {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === y - 1) last[1] = y;
    else ranges.push([y, y]);
    return ranges;
  },
  [],
);

function SeasonTooltip({ active, payload }: TooltipContentProps) {
  const d = payload?.[0]?.payload as SeasonValue | undefined;
  if (!active || !d) return null;
  return (
    <div className="card tabular px-3 py-2 text-xs shadow-md">
      <div className="font-semibold">Season A {d.season}</div>
      <div className="text-muted">
        Index {signedPct(d.index)} · payout {pct(d.payout)}
      </div>
    </div>
  );
}

/** One district's index for every season, with the selected season highlighted. */
export default function SeasonContextChart({
  data,
  selected,
  trigger,
  exit,
  onSelect,
}: {
  data: SeasonValue[];
  selected: number;
  trigger: number;
  exit: number;
  onSelect: (season: number) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 16, left: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        {DROUGHT_SEASON_RANGES.map(([a, b]) => (
          <ReferenceArea
            key={a}
            x1={a}
            x2={b}
            fill="var(--drought)"
            fillOpacity={0.06}
            label={{ value: "Drought years", position: "insideTop", fontSize: 10, fill: "var(--drought)" }}
          />
        ))}
        <XAxis dataKey="season" tick={TICK} tickLine={false} axisLine={false} interval={3} />
        <YAxis tick={TICK} tickLine={false} axisLine={false} unit="%" width={44} domain={[(min: number) => Math.floor((min - 8) / 10) * 10, "auto"]} />
        <Tooltip content={SeasonTooltip} cursor={{ fill: "var(--surface-2)" }} />
        <ReferenceLine y={0} stroke="var(--ink)" strokeOpacity={0.3} />
        <ReferenceLine
          y={trigger}
          stroke="var(--ink)"
          strokeDasharray="4 3"
          label={{ value: `${trigger}% trigger`, position: "insideBottomRight", fontSize: 10, fill: "var(--muted)" }}
        />
        <Bar
          dataKey="index"
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
          onClick={(d) => {
            const season = (d as unknown as { payload?: SeasonValue }).payload?.season;
            if (season) onSelect(season);
          }}
          className="cursor-pointer"
        >
          {data.map((d) => (
            <Cell
              key={d.season}
              style={{ fill: indexClass(d.index, trigger, exit).color }}
              fillOpacity={d.season === selected ? 1 : 0.45}
              stroke={d.season === selected ? "var(--ink)" : "none"}
              strokeWidth={1.5}
            />
          ))}
          <LabelList
            dataKey="index"
            content={(p) => {
              const i = Number(p.index);
              if (data[i]?.season !== selected) return null;
              const y = Number(p.y);
              const h = Number(p.height);
              const v = data[i].index;
              const ty = v < 0 ? Math.max(y, y + h) + 13 : Math.min(y, y + h) - 5;
              return (
                <text x={Number(p.x) + Number(p.width) / 2} y={ty} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)">
                  {signedPct(v)}
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
