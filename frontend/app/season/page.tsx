"use client";

import { IndexLegend } from "@/components/charts/ClassLegend";
import DistrictMap from "@/components/charts/DistrictMap";
import { Card, ErrorNote, Loading, PageHeader } from "@/components/ui";
import { getCurrentSeason, getModel, getShapes } from "@/lib/api";
import { pct, signedPct } from "@/lib/payout";
import { indexClass } from "@/lib/scales";
import type { CurrentSeason } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });

/** The window as a bar: elapsed days filled, months marked, today's data point pinned. */
function WindowProgress({ s }: { s: CurrentSeason }) {
  const share = s.daysElapsed / s.windowDays;
  const months = [
    { label: "October", at: 0 },
    { label: "November", at: 31 / s.windowDays },
    { label: "December", at: 61 / s.windowDays },
  ];
  return (
    <div>
      <div className="relative h-3 bg-surface-2">
        <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${share * 100}%` }} />
        {months.slice(1).map((m) => (
          <span key={m.label} className="absolute inset-y-0 w-px bg-surface" style={{ left: `${m.at * 100}%` }} />
        ))}
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-muted">
        {months.map((m) => (
          <span key={m.label} className="absolute pl-1" style={{ left: `${m.at * 100}%` }}>{m.label}</span>
        ))}
      </div>
      <div className="relative h-5">
        <span
          className="tabular absolute whitespace-nowrap border-l-2 border-ink pl-1.5 text-xs font-medium"
          style={{ left: `${share * 100}%` }}
        >
          Data to {fmt(s.asOf)} · day {s.daysElapsed} of {s.windowDays}
        </span>
      </div>
    </div>
  );
}

/** A value against its normal as a bar: 100% is the median of past seasons at the same date. */
function VsNormal({ value, normal, z, unit, digits = 0 }: { value: number; normal: number; z: number; unit: string; digits?: number }) {
  const ratio = normal ? value / normal : 1;
  const w = Math.min(1.6, Math.max(0, ratio)) / 1.6;
  const color = z <= -0.5 ? "var(--drought)" : z >= 0.5 ? "var(--other)" : "var(--faint)";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2.5 w-28 shrink-0 bg-surface-2">
        <div className="h-full" style={{ width: `${w * 100}%`, background: color }} />
        <span className="absolute -inset-y-1 w-px bg-ink/50" style={{ left: `${(1 / 1.6) * 100}%` }} title="normal" />
      </div>
      <span className="tabular whitespace-nowrap text-sm">
        {value.toFixed(digits)}
        {unit} <span className="text-xs text-muted">({Math.round(ratio * 100)}% of normal)</span>
      </span>
    </div>
  );
}

export default function SeasonPage() {
  const season = useApi("current-season", getCurrentSeason);
  const model = useApi("model", getModel);
  const shapes = useApi("shapes", getShapes);
  const error = season.error ?? model.error ?? shapes.error;

  let body;
  if (error) body = <ErrorNote message={error} />;
  else if (!season.data || !model.data || !shapes.data) body = <Loading />;
  else {
    const s = season.data;
    const { trigger, exit } = model.data;
    const byName = new Map(s.districts.map((d) => [d.district, d]));
    const dry = s.districts.filter((d) => d.rainZ <= -0.5);
    const paying = s.districts.filter((d) => d.payout > 0);
    const worst = [...s.districts].sort((a, b) => a.index - b.index)[0];
    const late = s.skillCurve.find((c) => c.day === 61);
    const final = s.skillCurve[s.skillCurve.length - 1];

    const title =
      paying.length === 0
        ? `Day ${s.daysElapsed} of ${s.windowDays}: rainfall below normal in ${dry.length} of 7 districts, none past the ${trigger}% trigger yet`
        : `Day ${s.daysElapsed} of ${s.windowDays}: ${paying.length} of 7 districts past the ${trigger}% trigger so far, ${worst.district} lowest at ${signedPct(worst.index)}`;

    body = (
      <div className="space-y-5">
        <Card
          label={`Season A ${s.season} · window ${fmt(s.windowStart)} – ${fmt(s.windowEnd, { day: "numeric", month: "short", year: "numeric" })} · provisional`}
          title={title}
          source={`Monitoring data: rainfall from ${s.sources.rainfall}; greenness from ${s.sources.greenness}. Each district's total so far is compared with the same calendar days of every season since 2001 and passed through the ${model.data.model} model. Updated ${fmt(s.generatedAt.slice(0, 10), { day: "numeric", month: "short", year: "numeric" })} by notebook/update_current_season.py. Payouts are settled later on the model's own data (CHIRPS and MODIS MOD13Q1), published weeks after the window closes.`}
        >
          <WindowProgress s={s} />
          <div className="mt-5 grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-center">
            <DistrictMap
              shapes={shapes.data}
              height={420}
              fill={(d) => (byName.has(d) ? indexClass(byName.get(d)!.index, trigger, exit).color : "var(--surface-2)")}
              label={(d) => (byName.has(d) ? signedPct(byName.get(d)!.index) : "")}
              ariaLabel={`Provisional predicted yield change by district, Season A ${s.season}, day ${s.daysElapsed}`}
              tooltip={(d) => {
                const v = byName.get(d);
                return v ? (
                  <div className="tabular space-y-0.5">
                    <div className="font-semibold">{d}</div>
                    <div className="flex justify-between gap-4"><span className="text-muted">Rainfall so far</span><span>{v.rainMm.toFixed(0)} mm</span></div>
                    <div className="flex justify-between gap-4"><span className="text-muted">Normal by now</span><span>{v.rainNormalMm.toFixed(0)} mm</span></div>
                    <div className="flex justify-between gap-4"><span className="text-muted">Provisional index</span><span className="font-medium">{signedPct(v.index)}</span></div>
                  </div>
                ) : d;
              }}
            />
            <div className="space-y-3 text-sm">
              <p className="text-muted">
                The window is <span className="font-medium text-ink">{Math.round((s.daysElapsed / s.windowDays) * 100)}% complete</span>.
                An early read this soon matched the final pay / no-pay decision in{" "}
                <span className="font-medium text-ink">{pct(s.skill.agreement)}</span> of past district-seasons
                {late && late.day > s.daysElapsed ? `; by the end of November it is ${pct(late.agreement)}, and ${pct(final.agreement)} when the window closes` : ""}.
              </p>
              <p className="text-muted">Treat the colours as a watch list, not a payout decision.</p>
            </div>
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <IndexLegend trigger={trigger} exit={exit} />
          </div>
        </Card>

        <Card
          label="Rainfall and greenness so far, against normal for the same dates"
          title={
            dry.length
              ? `${dry.map((d) => d.district).join(", ")} ${dry.length === 1 ? "has" : "have"} had less rain than normal since 1 October`
              : "Rainfall is near or above normal in every district since 1 October"
          }
          source="Normal = the median of the 25 past seasons over the same days of the window. The line on each bar marks normal (100%). Red: well below normal (z ≤ −0.5); green: well above (z ≥ 0.5)."
        >
          <div className="-mx-2 overflow-x-auto">
            <table className="tabular w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="px-2 pb-2 font-medium">District</th>
                  <th className="px-2 pb-2 font-medium">Rainfall so far</th>
                  <th className="px-2 pb-2 font-medium">Crop greenness (NDVI)</th>
                  <th className="px-2 pb-2 text-right font-medium">Provisional index</th>
                  <th className="px-2 pb-2 text-right font-medium">Payout if it ended today</th>
                </tr>
              </thead>
              <tbody>
                {[...s.districts].sort((a, b) => a.index - b.index).map((d) => (
                  <tr key={d.district} className="border-t border-line">
                    <td className="px-2 py-2.5 font-medium">{d.district}</td>
                    <td className="px-2 py-2.5"><VsNormal value={d.rainMm} normal={d.rainNormalMm} z={d.rainZ} unit=" mm" /></td>
                    <td className="px-2 py-2.5"><VsNormal value={d.ndvi} normal={d.ndviNormal} z={d.ndviZ} unit="" digits={2} /></td>
                    <td className="px-2 py-2.5 text-right font-semibold">{signedPct(d.index)}</td>
                    <td className="px-2 py-2.5 text-right">{pct(d.payout)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">The index uses both inputs; crop greenness carries most of its weight.</p>
        </Card>

        <Card
          label={`How far an early read can be trusted · tested on ${final.seasons} past seasons`}
          title={`An early read gets more reliable as the window fills: ${pct(s.skillCurve[0].agreement)} agreement with the final decision at day ${s.skillCurve[0].day}, ${pct(final.agreement)} at the close`}
          source={`Each past season was replayed with the same near-real-time data up to the same day of its window, and the early read's pay / no-pay decision compared with the season's final index (CHIRPS and MOD13Q1). Even with the whole window in, the two data sources disagree in ${pct(1 - final.agreement)} of district-seasons: monitoring data is for watching the season, final data for paying it.`}
        >
          <div className="space-y-2">
            {s.skillCurve.map((c) => {
              const here = s.daysElapsed >= c.day && (s.skillCurve.find((x) => x.day > s.daysElapsed)?.day ?? Infinity) > c.day;
              return (
                <div key={c.day} className="grid grid-cols-[110px_1fr_120px] items-center gap-3 text-sm">
                  <span className={here ? "font-semibold" : "text-muted"}>Day {c.day}{c.day === s.windowDays ? " (close)" : ""}</span>
                  <div className="h-3 bg-surface-2">
                    <div className="h-full" style={{ width: `${c.agreement * 100}%`, background: here ? "var(--accent)" : "var(--faint)" }} />
                  </div>
                  <span className="tabular text-right">
                    <span className="font-medium">{pct(c.agreement)}</span>
                    <span className="text-xs text-muted"> · r {c.correlation.toFixed(2)}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">
            Today is day {s.daysElapsed}: an early read now agrees with the final decision about {pct(s.skill.agreement)} of the time.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="This Season" />
      {body}
    </>
  );
}
