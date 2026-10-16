"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DISTRICTS, DROUGHT_YEARS } from "@/lib/constants";
import { anomalyLabel, pct, signedPct } from "@/lib/payout";
import { indexClass } from "@/lib/scales";
import type { HistoryPoint } from "@/lib/types";

/** Districts (rows) by window year (columns), coloured by the index; a dot marks a payout. */
export default function HistoryHeatmap({ points, trigger, exit }: { points: HistoryPoint[]; trigger: number; exit: number }) {
  const router = useRouter();
  const [hover, setHover] = useState<HistoryPoint | null>(null);
  const years = [...new Set(points.map((p) => p.windowYear))].sort((a, b) => a - b);
  const cell = new Map(points.map((p) => [`${p.district}:${p.windowYear}`, p]));

  return (
    <div>
      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div
          className="grid min-w-[760px] gap-[2px]"
          style={{ gridTemplateColumns: `88px repeat(${years.length}, minmax(22px, 1fr))` }}
          role="grid"
          aria-label="Predicted yield change by district and year"
        >
          <div />
          {years.map((y) => {
            const drought = DROUGHT_YEARS.includes(y);
            return (
              <div
                key={y}
                className={`tabular border-t-2 pt-1 text-center text-[10px] ${
                  drought ? "border-drought font-semibold text-ink" : "border-transparent text-faint"
                }`}
                title={drought ? `${y}: documented drought year` : String(y)}
              >
                {String(y).slice(2)}
              </div>
            );
          })}
          {DISTRICTS.map((d) => (
            <div key={d} className="contents" role="row">
              <div className="flex items-center pr-2 text-xs text-ink">{d}</div>
              {years.map((y) => {
                const p = cell.get(`${d}:${y}`);
                if (!p) return <div key={y} className="h-7 rounded-[2px] bg-surface-2" />;
                const pays = p.index <= trigger;
                return (
                  <button
                    key={y}
                    role="gridcell"
                    aria-label={`${d}, ${y} rains: ${signedPct(p.index)}${pays ? ", payout" : ""}`}
                    onMouseEnter={() => setHover(p)}
                    onFocus={() => setHover(p)}
                    onMouseLeave={() => setHover(null)}
                    onBlur={() => setHover(null)}
                    onClick={() => router.push(`/explorer?district=${d}&season=${y + 1}`)}
                    className={`flex h-7 items-center justify-center rounded-[2px] outline-offset-1 ${
                      hover === p ? "outline-2 outline-ink" : ""
                    }`}
                    style={{ background: indexClass(p.index, trigger, exit).color }}
                  >
                    {pays && <span className="h-1.5 w-1.5 rounded-full bg-white ring-1 ring-black/70" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="tabular mt-1 min-h-[2.5rem] bg-surface-2 px-3 py-2 text-xs">
        {hover ? (
          <span>
            <span className="font-semibold">
              {hover.district}, {hover.windowYear} rains (Season A {hover.windowYear + 1})
            </span>
            {hover.droughtYear && <span className="text-drought"> · documented drought</span>}
            <span className="text-muted">
              {" "}
              · rainfall {anomalyLabel(hover.rainZ)}, greenness {anomalyLabel(hover.ndviZ)} · index{" "}
            </span>
            <span className="font-medium">{signedPct(hover.index)}</span>
            <span className="text-muted"> · payout </span>
            <span className="font-medium">{pct(hover.payout)}</span>
          </span>
        ) : (
          <span className="text-muted">Hover a cell for details; click it to open that season in the Explorer.</span>
        )}
      </div>
    </div>
  );
}
