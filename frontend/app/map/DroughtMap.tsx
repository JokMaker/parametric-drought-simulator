"use client";

import { Pause, Play } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import ClassLegend, { IndexLegend } from "@/components/charts/ClassLegend";
import DistrictMap from "@/components/charts/DistrictMap";
import SeasonTimeline from "@/components/SeasonTimeline";
import { Card, ErrorNote, Loading, Tabs } from "@/components/ui";
import { getBasisRisk, getHistory, getModel, getSeasons, getShapes } from "@/lib/api";
import { FIRST_SEASON, isDroughtSeason, LAST_SEASON, SEASONS, windowYearOf, YIELD_RANGE, YIELD_SEASONS } from "@/lib/constants";
import { districtsInSeason } from "@/lib/districtSeason";
import { anomalyLabel, pct, signedPct } from "@/lib/payout";
import { indexClass, PAYOUT_CLASSES, payoutClass, RISK_CLASSES, riskClass } from "@/lib/scales";
import { useApi } from "@/lib/useApi";

export type Metric = "index" | "payout" | "risk";

const METRICS: { key: Metric; label: string }[] = [
  { key: "index", label: "Predicted yield change" },
  { key: "payout", label: "Payout" },
  { key: "risk", label: "Basis risk" },
];

export default function DroughtMap() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const metric = (METRICS.find((m) => m.key === params.get("metric"))?.key ?? "index") as Metric;
  const seasonParam = Number(params.get("season"));
  const season = SEASONS.includes(seasonParam) ? seasonParam : LAST_SEASON;

  const shapes = useApi("shapes", getShapes);
  const history = useApi("history", getHistory);
  const calibration = useApi("seasons", getSeasons);
  const risk = useApi("basis-risk", getBasisRisk);
  const model = useApi("model", getModel);
  const error = shapes.error ?? history.error ?? calibration.error ?? risk.error ?? model.error;

  function set(next: { season?: number; metric?: Metric }) {
    const q = new URLSearchParams({ metric: next.metric ?? metric, season: String(next.season ?? season) });
    router.replace(`${pathname}?${q}`, { scroll: false });
  }

  // Play steps through every season, so droughts can be watched spreading and clearing.
  const [playOn, setPlaying] = useState(false);
  // Playback stops by itself on the last season.
  const playing = playOn && season < LAST_SEASON;
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      const q = new URLSearchParams({ metric, season: String(season + 1) });
      router.replace(`${pathname}?${q}`, { scroll: false });
    }, 900);
    return () => clearTimeout(t);
  }, [playing, season, metric, pathname, router]);
  const togglePlay = () => {
    if (!playing && season >= LAST_SEASON) set({ season: FIRST_SEASON });
    setPlaying(!playing);
  };

  if (error) return <ErrorNote message={error} />;
  if (!shapes.data || !history.data || !calibration.data || !risk.data || !model.data) return <Loading />;

  const { trigger, exit } = model.data;
  const values = districtsInSeason(history.data, calibration.data, season);
  const riskOf = new Map(risk.data.map((r) => [r.district, r.basisRisk]));
  const districts = [...values.keys()];

  const classOf = (d: string) => {
    if (metric === "risk") return riskClass(riskOf.get(d) ?? 0);
    const v = values.get(d)!;
    return metric === "index" ? indexClass(v.index, trigger, exit) : payoutClass(v.payout);
  };
  const valueText = (d: string) => {
    if (metric === "risk") return pct(riskOf.get(d) ?? 0);
    const v = values.get(d)!;
    return metric === "index" ? signedPct(v.index) : pct(v.payout);
  };
  const order = (d: string) =>
    metric === "risk" ? -(riskOf.get(d) ?? 0) : metric === "index" ? values.get(d)!.index : -values.get(d)!.payout;
  const ranked = [...districts].sort((a, b) => order(a) - order(b));

  // The finding for this view, in one sentence.
  const paying = districts.filter((d) => values.get(d)!.index <= trigger);
  const full = districts.filter((d) => values.get(d)!.payout >= 1);
  const worst = ranked[0];
  let headline: string;
  if (metric === "risk") {
    const best = ranked[ranked.length - 1];
    headline = `${worst}'s payouts sit furthest from its harvests (${pct(riskOf.get(worst)!)}); ${best}'s match most closely (${pct(riskOf.get(best)!)})`;
  } else if (paying.length === 0) {
    headline = `No district reaches the ${trigger}% trigger in Season A ${season}`;
  } else if (metric === "index") {
    headline = `${paying.length} of ${districts.length} districts reach the trigger; ${worst} is hardest hit at ${signedPct(values.get(worst)!.index)}`;
  } else {
    headline = `${paying.length} of ${districts.length} districts would be paid${
      full.length ? `, ${full.length === 1 ? full[0] : `${full.length} of them`} in full` : ""
    }`;
  }

  const legend =
    metric === "index" ? (
      <IndexLegend trigger={trigger} exit={exit} />
    ) : metric === "payout" ? (
      <ClassLegend classes={PAYOUT_CLASSES} />
    ) : (
      <ClassLegend classes={RISK_CLASSES} />
    );

  const worstSeason = (d: string) =>
    calibration.data!
      .filter((s) => s.district === d)
      .sort((a, b) => Math.abs(b.payout - (b.payoutIfActual ?? 0)) - Math.abs(a.payout - (a.payoutIfActual ?? 0)))[0]
      ?.season ?? season;
  const open = (d: string) => router.push(`/explorer?district=${d}&season=${metric === "risk" ? worstSeason(d) : season}`);

  const label =
    metric === "risk"
      ? `Basis risk · ${YIELD_RANGE}`
      : `${METRICS.find((m) => m.key === metric)!.label} · Season A ${season}${
          isDroughtSeason(season) ? ` · documented drought (${windowYearOf(season)} rains)` : ""
        }`;

  return (
    <div className="space-y-5">
      <section className="card px-5 pt-2 pb-4 sm:px-6">
        <Tabs label="Map layer" value={metric} options={METRICS} onChange={(m) => set({ metric: m })} />
        {metric !== "risk" && (
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-surface"
              aria-label={playing ? "Pause" : "Play every season"}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
              {playing ? "Pause" : "Play"}
            </button>
            <div className="min-w-0 flex-1">
              <SeasonTimeline
                season={season}
                onSelect={(s) => {
                  setPlaying(false);
                  set({ season: s });
                }}
              />
            </div>
          </div>
        )}
      </section>

      <Card
        label={label}
        title={headline}
        source={
          metric === "risk"
            ? `Average over the ${YIELD_SEASONS.length} seasons with NISR harvest data. Click a district to open its worst-matched season.`
            : `${YIELD_SEASONS.includes(season) ? "Leave-one-out index (season with harvest data)" : "Satellite-only backtest"}. Click a district to open it in the Explorer.`
        }
      >
        <div className="mx-auto max-w-2xl">
          <DistrictMap
            shapes={shapes.data}
            fill={(d) => classOf(d).color}
            label={valueText}
            ariaLabel={`Eastern Province districts: ${label}`}
            onSelect={open}
            tooltip={(d) => {
              const v = values.get(d)!;
              return (
                <div className="tabular space-y-0.5">
                  <div className="font-semibold">{d}</div>
                  {metric === "risk" ? (
                    <Row k="Basis risk" v={pct(riskOf.get(d) ?? 0)} />
                  ) : (
                    <>
                      <Row k="Rainfall" v={anomalyLabel(v.rainZ)} />
                      <Row k="Crop greenness" v={anomalyLabel(v.ndviZ)} />
                      <Row k="Predicted yield" v={signedPct(v.index)} />
                      <Row k="Payout" v={pct(v.payout)} />
                      {v.actualYieldAnom !== null && <Row k="Actual harvest" v={signedPct(v.actualYieldAnom)} />}
                    </>
                  )}
                </div>
              );
            }}
          />
        </div>
        <div className="mt-4 border-t border-line pt-3">{legend}</div>
      </Card>

      <Card label="Districts, ranked" title={metric === "risk" ? "Largest mismatch first" : "Worst-hit district first"}>
        <table className="tabular w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2 font-medium">District</th>
              <th className="pb-2 font-medium">Class</th>
              <th className="pb-2 text-right font-medium">{metric === "risk" ? "Basis risk" : "Predicted yield"}</th>
              {metric !== "risk" && <th className="pb-2 text-right font-medium">Payout</th>}
            </tr>
          </thead>
          <tbody>
            {ranked.map((d) => {
              const c = classOf(d);
              const v = values.get(d)!;
              return (
                <tr key={d} className="cursor-pointer border-t border-line hover:bg-surface-2" onClick={() => open(d)}>
                  <td className="py-2 font-medium">{d}</td>
                  <td className="py-2">
                    <span className="flex items-center gap-2 text-muted">
                      <span className="h-3 w-4 border border-ink/10" style={{ background: c.color }} />
                      {c.label}
                    </span>
                  </td>
                  <td className="py-2 text-right">{metric === "risk" ? pct(riskOf.get(d) ?? 0) : signedPct(v.index)}</td>
                  {metric !== "risk" && <td className="py-2 text-right">{pct(v.payout)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
