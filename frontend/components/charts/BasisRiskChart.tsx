"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BasisRisk } from "@/lib/types";

export default function BasisRiskChart({ data }: { data: BasisRisk[] }) {
  const sorted = [...data].sort((a, b) => b.basisRisk - a.basisRisk);
  const fmt = (v: unknown) => `${(Number(v) * 100).toFixed(0)}%`;
  return (
    <ResponsiveContainer width="100%" height={sorted.length * 40 + 30}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="#e2e5e0" />
        <XAxis
          type="number"
          domain={[0, (max: number) => Math.ceil(max * 10) / 10]}
          tickCount={6}
          tickFormatter={fmt}
          tick={{ fontSize: 11, fill: "#5d6877" }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="district"
          tick={{ fontSize: 12, fill: "#1b2430" }}
          tickLine={false}
          axisLine={false}
          width={84}
        />
        <Tooltip
          cursor={{ fill: "rgba(27,36,48,0.05)" }}
          formatter={(v) => [fmt(v), "Basis risk"]}
          contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e2e5e0" }}
        />
        <Bar dataKey="basisRisk" fill="#a15c07" radius={[0, 3, 3, 0]} maxBarSize={22} isAnimationActive={false}>
          <LabelList dataKey="basisRisk" position="right" formatter={fmt} style={{ fontSize: 11, fill: "#1b2430" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
