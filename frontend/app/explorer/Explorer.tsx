"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent } from "react";
import SeasonContextChart, { type SeasonValue } from "@/components/charts/SeasonContextChart";
import { HarvestCard, type InputSeason, PayoutCard, SatelliteCard } from "@/components/PayoutPanel";
import SeasonTimeline from "@/components/SeasonTimeline";
import { Card, ErrorNote, Loading } from "@/components/ui";
import { getHistory, getModel, getSeasons, getSimulation } from "@/lib/api";
import { DISTRICTS, FIRST_SEASON, isDroughtSeason, LAST_SEASON, SEASONS, windowYearOf } from "@/lib/constants";
import { useApi } from "@/lib/useApi";

const EXAMPLES = [
  { label: "Good catch", district: "Rwamagana", season: 2023 },
  { label: "Missed season", district: "Gatsibo", season: 2022 },
  { label: "Drought year", district: "Kirehe", season: 2017 },
];

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function contextHeadline(series: SeasonValue[], season: number, district: string) {
  const n = series.length;
  const current = series.find((s) => s.season === season);
  if (!current) return `${district} since ${FIRST_SEASON}`;
  const rank = series.filter((s) => s.index < current.index).length + 1;
  if (rank === 1) return `The worst predicted harvest in ${district} since ${FIRST_SEASON}`;
  if (rank <= 5) return `The ${ordinal(rank)}-worst predicted harvest in ${district} of ${n} seasons`;
  if (rank === n) return `The best predicted harvest in ${district} since ${FIRST_SEASON}`;
  if (rank > n - 5) return `One of ${district}'s best seasons: ${ordinal(n - rank + 1)}-best of ${n}`;
  return `An ordinary season for ${district}: ${ordinal(rank)} of ${n}, ranked from the worst`;
}

export default function Explorer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // The selection lives in the URL so links like ?district=Kirehe&season=2022 work.
  const districtParam = params.get("district");
  const district = DISTRICTS.find((d) => d === districtParam) ?? "Rwamagana";
  const seasonParam = Number(params.get("season"));
  const season = SEASONS.includes(seasonParam) ? seasonParam : 2023;

  const model = useApi("model", getModel);
  const sim = useApi(`${district}:${season}`, () => getSimulation(district, season));
  const history = useApi("history", getHistory);
  const calibration = useApi("seasons", getSeasons);

  function select(next: { district?: string; season?: number }) {
    const q = new URLSearchParams({
      district: next.district ?? district,
      season: String(next.season ?? season),
    });
    router.replace(`${pathname}?${q}`, { scroll: false });
  }

  // Left and right arrow keys step through seasons.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowLeft" && season > FIRST_SEASON) select({ season: season - 1 });
    if (e.key === "ArrowRight" && season < LAST_SEASON) select({ season: season + 1 });
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // This district's index for every season; seasons with harvest data use the
  // leave-one-out value, so the chart matches the payout card exactly.
  const series: SeasonValue[] = [];
  const inputs: InputSeason[] = [];
  if (history.data && calibration.data) {
    const loo = new Map(
      calibration.data.filter((s) => s.district === district).map((s) => [s.season, s]),
    );
    for (const p of history.data) {
      if (p.district !== district) continue;
      const s = p.windowYear + 1;
      const c = loo.get(s);
      series.push({ season: s, index: c?.index ?? p.index, payout: c?.payout ?? p.payout });
      inputs.push({ season: s, rainZ: p.rainZ, ndviZ: p.ndviZ });
    }
    series.sort((a, b) => a.season - b.season);
  }
  const paidSeasons = model.data ? series.filter((s) => s.index <= model.data!.trigger).length : 0;

  return (
    <div className="space-y-5">
      <section className="card space-y-4 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="text-[13px] text-muted">
            District
            <div className="mt-1.5 flex flex-wrap overflow-hidden rounded-sm border border-line">
              {DISTRICTS.map((d) => (
                <button
                  key={d}
                  onClick={() => select({ district: d })}
                  aria-pressed={d === district}
                  className={`border-r border-line px-3 py-1.5 text-sm last:border-r-0 ${
                    d === district ? "bg-ink text-surface" : "text-ink hover:bg-surface-2"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </label>
          <div className="text-[13px] text-muted">
            Examples:{" "}
            {EXAMPLES.map((e, i) => (
              <span key={e.label}>
                {i > 0 && " · "}
                <button
                  onClick={() => select({ district: e.district, season: e.season })}
                  className="text-accent underline-offset-2 hover:underline"
                >
                  {e.label}
                </button>
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
            <span>Season A (harvest year)</span>
            <span className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-ink/70" /> Harvest data
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3.5 rounded-full bg-drought" /> Documented drought
              </span>
            </span>
          </div>
          <SeasonTimeline season={season} onSelect={(s) => select({ season: s })} />
        </div>
      </section>

      {model.error || sim.error ? (
        <ErrorNote message={model.error ?? sim.error ?? ""} />
      ) : model.data && sim.data ? (
        <>
          <PayoutCard sim={sim.data} model={model.data} />
          <SatelliteCard sim={sim.data} series={inputs} />
          <HarvestCard sim={sim.data} model={model.data} />
          {series.length > 0 && (
            <Card
              label={`Every season · ${district}, ${FIRST_SEASON}–${LAST_SEASON} · trigger reached in ${paidSeasons} of ${series.length}`}
              title={contextHeadline(series, season, district)}
              source={`Predicted yield change for every Season A. Seasons with harvest data use the leave-one-out index. Shaded: documented droughts (Niyonsenga et al., 2024)${
                isDroughtSeason(season) ? `, including this season's ${windowYearOf(season)} rains` : ""
              }. Click a bar to open that season.`}
            >
              <SeasonContextChart
                data={series}
                selected={season}
                trigger={model.data.trigger}
                exit={model.data.exit}
                onSelect={(s) => select({ season: s })}
              />
            </Card>
          )}
        </>
      ) : (
        <Loading rows={3} />
      )}
    </div>
  );
}
