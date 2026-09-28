"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef } from "react";
import PayoutPanel from "@/components/PayoutPanel";
import { Badge, ErrorNote, Loading } from "@/components/ui";
import { canSimulate, getModel, getSimulation } from "@/lib/api";
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

function SeasonTimeline({ season, onSelect }: { season: number; onSelect: (s: number) => void }) {
  const selected = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selected.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [season]);

  const step = (d: number) => onSelect(Math.min(LAST_SEASON, Math.max(FIRST_SEASON, season + d)));

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => step(-1)}
        disabled={season <= FIRST_SEASON}
        className="rounded-lg border border-line p-2 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
        aria-label="Previous season"
      >
        <ChevronLeft size={16} />
      </button>
      <div className="no-scrollbar flex flex-1 gap-1 overflow-x-auto py-1">
        {SEASONS.map((y) => {
          const active = y === season;
          const drought = isDroughtSeason(y);
          const hasYield = YIELD_SEASONS.includes(y);
          return (
            <button
              key={y}
              ref={active ? selected : undefined}
              onClick={() => onSelect(y)}
              aria-pressed={active}
              title={`Season A ${y}${hasYield ? " · yield data" : ""}${drought ? " · documented drought" : ""}`}
              className={`relative flex min-w-[52px] flex-col items-center rounded-lg px-2 pt-2 pb-1.5 text-xs transition-colors ${
                active ? "bg-accent font-semibold text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {drought && (
                <span className={`absolute inset-x-2 top-0.5 h-0.5 rounded-full ${active ? "bg-accent-ink/70" : "bg-drought"}`} />
              )}
              <span className="tabular">{y}</span>
              <span
                className={`mt-1 h-1.5 w-1.5 rounded-full ${
                  hasYield ? (active ? "bg-accent-ink" : "bg-accent") : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>
      <button
        onClick={() => step(1)}
        disabled={season >= LAST_SEASON}
        className="rounded-lg border border-line p-2 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
        aria-label="Next season"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

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
  const available = canSimulate(season);
  const sim = useApi(`${district}:${season}`, () =>
    available ? getSimulation(district, season) : Promise.resolve(null),
  );

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
      ) : !available ? (
        <div className="card p-6 text-sm leading-6 text-muted">
          Results for seasons without yield data are calculated by the backend, which applies the
          saved model scaler. Start the backend and set NEXT_PUBLIC_USE_MOCK=false to see this
          season. Until then, choose 2022, 2023 or 2025.
        </div>
      ) : model.data && sim.data ? (
        <PayoutPanel sim={sim.data} model={model.data} />
      ) : (
        <Loading rows={2} />
      )}
    </div>
  );
}
