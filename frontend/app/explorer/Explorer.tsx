"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PayoutPanel from "@/components/PayoutPanel";
import { ErrorNote, Loading } from "@/components/ui";
import { canSimulate, getModel, getSimulation } from "@/lib/api";
import {
  DISTRICTS,
  isDroughtSeason,
  LAST_SEASON,
  SEASONS,
  windowYearOf,
  YIELD_SEASONS,
} from "@/lib/constants";
import { useApi } from "@/lib/useApi";

const selectClass =
  "mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none";

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

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <div className="space-y-4">
        <label className="block text-xs font-medium text-muted">
          District
          <select className={selectClass} value={district} onChange={(e) => select({ district: e.target.value })}>
            {DISTRICTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-muted">
          Season A
          <select
            className={selectClass}
            value={season}
            onChange={(e) => select({ season: Number(e.target.value) })}
          >
            {[...SEASONS].reverse().map((y) => (
              <option key={y} value={y}>
                {y}
                {YIELD_SEASONS.includes(y) ? " · yield data" : ""}
                {isDroughtSeason(y) ? " · drought year" : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs leading-5 text-muted">
          Season A is named by its harvest year; its critical rains fall in October to December of
          the year before. Seasons marked &ldquo;yield data&rdquo; can be checked against actual
          harvests. Other seasons from 2001 to {LAST_SEASON} use satellite data only.
        </p>
      </div>

      <div>
        {model.error || sim.error ? (
          <ErrorNote message={model.error ?? sim.error ?? ""} />
        ) : !available ? (
          <div className="rounded-lg border border-line bg-surface p-5 text-sm leading-6 text-muted">
            <div className="font-semibold text-ink">
              {district}, Season A {season}
            </div>
            Results for seasons without yield data are calculated by the backend, which applies the
            saved model scaler. Start the backend and set NEXT_PUBLIC_USE_MOCK=false to see this
            season. Until then, choose 2022, 2023 or 2025.
          </div>
        ) : model.data && sim.data ? (
          <>
            <h2 className="mb-4 text-lg font-semibold">
              {sim.data.district}, Season A {sim.data.season}
              {isDroughtSeason(sim.data.season) && (
                <span className="ml-2 rounded bg-drought-soft px-2 py-0.5 align-middle text-xs font-medium text-drought">
                  Documented drought ({windowYearOf(sim.data.season)} rains)
                </span>
              )}
            </h2>
            <PayoutPanel sim={sim.data} model={model.data} />
          </>
        ) : (
          <Loading />
        )}
      </div>
    </div>
  );
}
