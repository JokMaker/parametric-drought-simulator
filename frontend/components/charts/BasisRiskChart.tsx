"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BasisRisk } from "@/lib/types";

export default function BasisRiskChart({ data }: { data: BasisRisk[] }) {
  const sorted = [...data].sort((a, b) => b.basisRisk - a.basisRisk);
  const fmt = (v: unknown) => `${(Number(v) * 100).toFixed(0)}%`;
  return (
    <ResponsiveContainer width="100%" height={sorted.length * 42 + 30}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--grid)" />
        <XAxis
          type="number"
          domain={[0, (max: number) => Math.ceil(max * 10) / 10]}
          tickCount={6}
          tickFormatter={fmt}
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="district"
          tick={{ fontSize: 12, fill: "var(--ink)" }}
          tickLine={false}
          axisLine={false}
          width={84}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          content={({ active, payload }) => {
            const d = payload?.[0]?.payload as BasisRisk | undefined;
            if (!active || !d) return null;
            return (
              <div className="card tabular px-3 py-2 text-xs shadow-lg">
                <div className="font-semibold">{d.district}</div>
                <div className="text-muted">Basis risk {fmt(d.basisRisk)}</div>
              </div>
            );
          }}
        />
        <Bar dataKey="basisRisk" fill="var(--pay)" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
          <LabelList
            dataKey="basisRisk"
            position="right"
            formatter={fmt}
            style={{ fontSize: 11, fill: "var(--ink)" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
