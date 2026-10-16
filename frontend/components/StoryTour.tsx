"use client";

import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IndexLegend } from "@/components/charts/ClassLegend";
import DistrictMap from "@/components/charts/DistrictMap";
import { Card, ErrorNote, Loading } from "@/components/ui";
import { getHistory, getModel, getSeasons, getShapes } from "@/lib/api";
import { isDroughtSeason, SEASONS } from "@/lib/constants";
import { districtsInSeason } from "@/lib/districtSeason";
import { classify, pct, signedPct } from "@/lib/payout";
import { indexClass } from "@/lib/scales";
import type { ModelSummary, Simulation } from "@/lib/types";
import { useApi } from "@/lib/useApi";

type Stop = {
  name: string;
  title: string;
  season: number;
  district?: string;
  facts: { k: string; v: string; tone?: "bad" | "good" }[];
};

/**
 * Five stops through the data, chosen from it rather than written by hand:
 * a quiet year, the worst year, a drought caught, a drought missed and a false alarm.
 * A guided tour lets a first-time reader learn the dashboard by example.
 */
function buildStops(history: Parameters<typeof districtsInSeason>[0], seasons: Simulation[], m: ModelSummary): Stop[] {
  const bySeason = SEASONS.map((s) => {
    const v = [...districtsInSeason(history, seasons, s).values()];
    return { s, v, paid: v.filter((x) => x.index <= m.trigger).length, mean: v.reduce((a, x) => a + x.index, 0) / v.length };
  });
  const quiet = [...bySeason].reverse().find((x) => x.paid === 0) ?? bySeason[bySeason.length - 1];
  const worst = [...bySeason].sort((a, b) => a.mean - b.mean)[0];

  const tagged = seasons.map((s) => ({ s, o: classify(s, m) }));
  const gap = (s: Simulation) => Math.abs(s.payout - (s.payoutIfActual ?? 0));
  const caught = tagged.filter((t) => t.o === "hit").sort((a, b) => b.s.payout - a.s.payout || gap(a.s) - gap(b.s))[0]?.s;
  const missed = tagged.filter((t) => t.o === "miss").sort((a, b) => gap(b.s) - gap(a.s))[0]?.s;
  const falseAlarm = tagged.filter((t) => t.o === "false-payout").sort((a, b) => b.s.payout - a.s.payout)[0]?.s;

  const seasonFacts = (x: (typeof bySeason)[number]) => [
    { k: "Districts paid", v: `${x.paid} of ${x.v.length}`, tone: x.paid ? ("bad" as const) : ("good" as const) },
    { k: "Average yield change", v: signedPct(x.mean) },
    { k: "Documented drought", v: isDroughtSeason(x.s) ? "Yes" : "No" },
    (() => {
      const w = [...x.v].sort((p, q) => p.index - q.index)[0];
      return { k: `${w.index < 0 ? "Worst" : "Lowest"}: ${w.district}`, v: signedPct(w.index) };
    })(),
  ];
  const districtFacts = (s: Simulation) => [
    { k: "Index predicted", v: signedPct(s.index) },
    { k: "Real harvest", v: signedPct(s.actualYieldAnom ?? 0) },
    { k: "Index paid", v: pct(s.payout) },
    { k: "Harvest called for", v: pct(s.payoutIfActual ?? 0) },
  ];

  const stops: Stop[] = [
    {
      name: "A normal year",
      title: `Season A ${quiet.s}: good rains everywhere, so no district is paid`,
      season: quiet.s,
      facts: seasonFacts(quiet),
    },
    {
      name: "The worst year",
      title: `Season A ${worst.s}: the worst on record; ${worst.paid} of ${worst.v.length} districts are paid`,
      season: worst.s,
      facts: seasonFacts(worst),
    },
  ];
  if (caught)
    stops.push({
      name: "A drought caught",
      title: `${caught.district} ${caught.season}: the harvest fell ${Math.abs(caught.actualYieldAnom ?? 0).toFixed(0)}% and the index paid ${pct(caught.payout)}`,
      season: caught.season,
      district: caught.district,
      facts: districtFacts(caught).map((f, i) => (i === 2 ? { ...f, tone: "good" as const } : f)),
    });
  if (missed)
    stops.push({
      name: "A drought missed",
      title: `${missed.district} ${missed.season}: the harvest fell ${Math.abs(missed.actualYieldAnom ?? 0).toFixed(0)}% but the satellites saw a normal season`,
      season: missed.season,
      district: missed.district,
      facts: districtFacts(missed).map((f, i) => (i === 2 ? { ...f, tone: "bad" as const } : f)),
    });
  if (falseAlarm)
    stops.push({
      name: "A false alarm",
      title: `${falseAlarm.district} ${falseAlarm.season}: the index paid ${pct(falseAlarm.payout)} in a season with a ${signedPct(falseAlarm.actualYieldAnom ?? 0)} harvest`,
      season: falseAlarm.season,
      district: falseAlarm.district,
      facts: districtFacts(falseAlarm).map((f, i) => (i === 2 ? { ...f, tone: "bad" as const } : f)),
    });
  return stops;
}

export default function StoryTour() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const shapes = useApi("shapes", getShapes);
  const history = useApi("history", getHistory);
  const seasons = useApi("seasons", getSeasons);
  const model = useApi("model", getModel);
  const error = shapes.error ?? history.error ?? seasons.error ?? model.error;

  if (error) return <ErrorNote message={error} />;
  if (!shapes.data || !history.data || !seasons.data || !model.data) return <Loading rows={1} />;

  const { trigger, exit } = model.data;
  const stops = buildStops(history.data, seasons.data, model.data);
  const stop = stops[Math.min(step, stops.length - 1)];
  const values = districtsInSeason(history.data, seasons.data, stop.season);
  const go = (i: number) => setStep(Math.max(0, Math.min(stops.length - 1, i)));
  const explorer = `/explorer?district=${stop.district ?? "Rwamagana"}&season=${stop.season}`;

  return (
    <Card
      label={`Guided tour · stop ${step + 1} of ${stops.length}`}
      title={stop.title}
      action={
        <Link href={`/map?season=${stop.season}`} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
          Full map <ArrowRight size={14} />
        </Link>
      }
      source="Stops are picked from the data: the latest season with no payout, the season with the lowest average index, and the clearest correct payout, missed season and false payout among the 28 district-seasons with harvest data."
    >
      <ol className="mb-4 grid grid-cols-5 gap-1" aria-label="Tour stops">
        {stops.map((s, i) => (
          <li key={s.name}>
            <button
              onClick={() => go(i)}
              aria-current={i === step ? "step" : undefined}
              className={`w-full border-t-[3px] pt-1.5 text-left text-xs transition-colors ${
                i === step ? "border-accent font-medium text-ink" : i < step ? "border-accent/40 text-muted" : "border-line text-muted hover:text-ink"
              }`}
            >
              <span className="tabular mr-1 text-faint">{i + 1}</span>
              <span className="hidden sm:inline">{s.name}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="grid gap-5 md:grid-cols-[1fr_1.15fr] md:items-center">
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-2">
            {stop.facts.map((f) => (
              <div key={f.k} className="rounded-sm bg-surface-2 px-3 py-2">
                <dt className="text-xs text-muted">{f.k}</dt>
                <dd
                  className="tabular text-xl font-semibold"
                  style={f.tone ? { color: f.tone === "bad" ? "var(--drought)" : "var(--other)" } : undefined}
                >
                  {f.v}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex items-center gap-2">
            <button
              onClick={() => go(step - 1)}
              disabled={step === 0}
              className="rounded-sm border border-line p-2 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
              aria-label="Previous stop"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => go(step + 1)}
              disabled={step === stops.length - 1}
              className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-2 text-sm font-medium text-surface disabled:opacity-40"
            >
              Next: {stops[step + 1]?.name ?? "end of tour"} <ChevronRight size={16} />
            </button>
            <Link href={explorer} className="ml-auto text-sm text-accent hover:underline">
              Open in Explorer
            </Link>
          </div>
        </div>
        <div>
          <DistrictMap
            shapes={shapes.data}
            height={440}
            highlight={stop.district}
            fill={(d) => (values.has(d) ? indexClass(values.get(d)!.index, trigger, exit).color : "var(--surface-2)")}
            label={(d) => (values.has(d) ? signedPct(values.get(d)!.index) : "")}
            ariaLabel={`Predicted yield change by district, Season A ${stop.season}`}
            onSelect={(d) => router.push(`/explorer?district=${d}&season=${stop.season}`)}
            tooltip={(d) => {
              const v = values.get(d);
              return v ? (
                <div className="tabular space-y-0.5">
                  <div className="font-semibold">{d}</div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Predicted yield</span>
                    <span>{signedPct(v.index)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Payout</span>
                    <span className="font-medium">{pct(v.payout)}</span>
                  </div>
                </div>
              ) : (
                d
              );
            }}
          />
        </div>
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <IndexLegend trigger={trigger} exit={exit} />
      </div>
    </Card>
  );
}
