"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent } from "react";
import PayoutPanel from "@/components/PayoutPanel";
import SeasonTimeline from "@/components/SeasonTimeline";
import { Badge, ErrorNote, Loading } from "@/components/ui";
import { getModel, getSimulation } from "@/lib/api";
import {
  DISTRICTS,
  FIRST_SEASON,
  isDroughtSeason,
  LAST_SEASON,
  SEASONS,
  windowYearOf,
  YIELD_SEASONS,
} from "@/lib/constants";
import { useApi } from "@/lib/useApi";

export default function Explorer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // The selection lives in the URL so demo links like ?district=Kirehe&season=2022 work.
  const districtParam = params.get("district");
  const district = DISTRICTS.find((d) => d === districtParam) ?? "Rwamagana";
  const seasonParam = Number(params.get("season"));
  const season = SEASONS.includes(seasonParam) ? seasonParam : 2023;

  const model = useApi("model", getModel);
  const sim = useApi(`${district}:${season}`, () => getSimulation(district, season));

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

  return (
    <div className="space-y-6">
      <section className="card space-y-5 p-5 sm:p-6">
        <div>
          <div className="mb-2 text-xs font-medium text-muted">District</div>
          <div className="flex flex-wrap gap-2">
            {DISTRICTS.map((d) => (
              <button
                key={d}
                onClick={() => select({ district: d })}
                aria-pressed={d === district}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  d === district
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line text-ink/85 hover:border-ink/30 hover:bg-surface-2"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted">Season A (harvest year)</span>
            <span className="flex items-center gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Yield data
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full bg-drought" /> Documented drought
              </span>
              <span className="hidden sm:inline">Use ← → to step</span>
            </span>
          </div>
          <SeasonTimeline season={season} onSelect={(s) => select({ season: s })} />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold tracking-tight">
          {district}, Season A {season}
        </h2>
        {YIELD_SEASONS.includes(season) && <Badge tone="accent">Yield data</Badge>}
        {isDroughtSeason(season) && (
          <Badge tone="drought">Documented drought ({windowYearOf(season)} rains)</Badge>
        )}
      </div>

      {model.error || sim.error ? (
        <ErrorNote message={model.error ?? sim.error ?? ""} />
      ) : model.data && sim.data ? (
        <PayoutPanel sim={sim.data} model={model.data} />
      ) : (
        <Loading rows={2} />
      )}
    </div>
  );
}
