"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ColorLegend from "@/components/charts/ColorLegend";
import DistrictMap from "@/components/charts/DistrictMap";
import SeasonTimeline from "@/components/SeasonTimeline";
import { Badge, Card, ErrorNote, Loading } from "@/components/ui";
import { getBasisRisk, getHistory, getModel, getSeasons, getShapes } from "@/lib/api";
import { isDroughtSeason, LAST_SEASON, SEASONS, windowYearOf, YIELD_SEASONS } from "@/lib/constants";
import { districtsInSeason } from "@/lib/districtSeason";
import { anomalyLabel, pct, signedPct } from "@/lib/payout";
import {
  INDEX_GRADIENT,
  INDEX_RANGE,
  indexColor,
  PAYOUT_GRADIENT,
  payoutColor,
  RISK_GRADIENT,
  RISK_RANGE,
  riskColor,
} from "@/lib/scales";
import { useApi } from "@/lib/useApi";

export type Metric = "index" | "payout" | "risk";

export const METRICS: { key: Metric; label: string; explain: string }[] = [
  {
    key: "index",
    label: "Predicted yield change",
    explain: "The index: red districts are predicted to lose yield, green ones to gain.",
  },
  {
    key: "payout",
    label: "Payout",
    explain: "Share of the full payout each district would receive this season.",
  },
  {
    key: "risk",
    label: "Basis risk",
    explain: "Average gap between the index payout and what the harvest called for, 2022–2025.",
  },
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
    const q = new URLSearchParams({
      metric: next.metric ?? metric,
      season: String(next.season ?? season),
    });
    router.replace(`${pathname}?${q}`, { scroll: false });
  }

  if (error) return <ErrorNote message={error} />;
  if (!shapes.data || !history.data || !calibration.data || !risk.data || !model.data) return <Loading />;

  const m = model.data;
  const values = districtsInSeason(history.data, calibration.data, season);
  const riskOf = new Map(risk.data.map((r) => [r.district, r.basisRisk]));
  const current = METRICS.find((x) => x.key === metric)!;

  // For basis risk, open the district's worst-matched season, which explains its score.
  const worstSeason = (d: string) =>
    calibration
      .data!.filter((s) => s.district === d)
      .sort(
        (a, b) =>
          Math.abs(b.payout - (b.payoutIfActual ?? 0)) - Math.abs(a.payout - (a.payoutIfActual ?? 0)),
      )[0]?.season ?? season;
  const open = (d: string) =>
    router.push(`/explorer?district=${d}&season=${metric === "risk" ? worstSeason(d) : season}`);

  const fill = (d: string) => {
    if (metric === "risk") return riskColor(riskOf.get(d) ?? 0);
    const v = values.get(d);
    if (!v) return "var(--surface-2)";
    return metric === "index" ? indexColor(v.index) : payoutColor(v.payout);
  };
  const valueText = (d: string) => {
    if (metric === "risk") return pct(riskOf.get(d) ?? 0);
    const v = values.get(d);
    if (!v) return "no data";
    return metric === "index" ? signedPct(v.index) : pct(v.payout);
  };
  const sortValue = (d: string) =>
    metric === "risk" ? -(riskOf.get(d) ?? 0) : metric === "index" ? values.get(d)?.index ?? 0 : -(values.get(d)?.payout ?? 0);
  const ranked = [...values.keys()].sort((a, b) => sortValue(a) - sortValue(b));
  const paying = [...values.values()].filter((v) => v.index <= m.trigger).length;

  const legend =
    metric === "index" ? (
      <ColorLegend
        title="Predicted yield change"
        gradient={INDEX_GRADIENT}
        ticks={[
          { at: 0, label: `≤ −${INDEX_RANGE}%` },
          { at: (INDEX_RANGE + m.trigger) / (2 * INDEX_RANGE), label: `${m.trigger}% trigger` },
          { at: 1, label: `≥ +${INDEX_RANGE}%` },
        ]}
      />
    ) : metric === "payout" ? (
      <ColorLegend
        title="Payout"
        gradient={PAYOUT_GRADIENT}
        ticks={[
          { at: 0, label: "0% (no payout)" },
          { at: 1, label: "100%" },
        ]}
      />
    ) : (
      <ColorLegend
        title="Basis risk"
        gradient={RISK_GRADIENT}
        ticks={[
          { at: 0, label: "0% (index matched the harvest)" },
          { at: 1, label: `≥ ${pct(RISK_RANGE)}` },
        ]}
      />
    );

  return (
    <div className="space-y-6">
      <section className="card space-y-5 p-5 sm:p-6">
        <div>
          <div className="mb-2 text-xs font-medium text-muted">Show</div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Map value">
            {METRICS.map((x) => (
              <button
                key={x.key}
                role="radio"
                aria-checked={metric === x.key}
                onClick={() => set({ metric: x.key })}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  metric === x.key
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line text-ink/85 hover:border-ink/30 hover:bg-surface-2"
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
        {metric === "risk" ? (
          <p className="text-xs text-muted">
            Basis risk is measured over the four seasons with harvest data (2022–2025), so it has no
            season selector.
          </p>
        ) : (
          <div>
            <div className="mb-2 text-xs font-medium text-muted">Season A (harvest year)</div>
            <SeasonTimeline season={season} onSelect={(s) => set({ season: s })} />
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card
          title={
            metric === "risk"
              ? "Basis risk by district, 2022–2025"
              : `${current.label}, Season A ${season}`
          }
          description={`${current.explain} Hover a district for details; click it to open it in the Explorer.`}
          action={
            metric !== "risk" && (
              <div className="flex flex-wrap gap-2">
                {YIELD_SEASONS.includes(season) && <Badge tone="accent">Harvest data</Badge>}
                {isDroughtSeason(season) && (
                  <Badge tone="drought">Documented drought ({windowYearOf(season)} rains)</Badge>
                )}
              </div>
            )
          }
        >
          <DistrictMap
            shapes={shapes.data}
            fill={fill}
            label={valueText}
            ariaLabel={`Map of Eastern Province districts coloured by ${current.label.toLowerCase()}`}
            onSelect={open}
            tooltip={(d) => {
              const v = values.get(d);
              return (
                <div className="tabular space-y-1">
                  <div className="font-semibold">
                    {d}
                    {metric !== "risk" && <span className="font-normal text-muted"> · Season A {season}</span>}
                  </div>
                  {metric === "risk" ? (
                    <Row label="Basis risk" value={pct(riskOf.get(d) ?? 0)} />
                  ) : v ? (
                    <>
                      <Row label="Rainfall" value={anomalyLabel(v.rainZ)} />
                      <Row label="Greenness (NDVI)" value={anomalyLabel(v.ndviZ)} />
                      <Row label="Predicted yield change" value={signedPct(v.index)} />
                      <Row label="Payout" value={pct(v.payout)} />
                      {v.actualYieldAnom !== null && (
                        <Row label="Actual yield change" value={signedPct(v.actualYieldAnom)} />
                      )}
                    </>
                  ) : (
                    <div className="text-muted">No satellite data</div>
                  )}
                  <div className="pt-1 text-faint">
                    {metric === "risk" ? "Click to open its worst-matched season" : "Click to open in the Explorer"}
                  </div>
                </div>
              );
            }}
          />
          <div className="mt-4">{legend}</div>
        </Card>

        <Card
          title={metric === "risk" ? "Districts by basis risk" : "Districts this season"}
          description={
            metric === "risk"
              ? "Highest gap first."
              : `${paying} of ${values.size} districts reach the ${m.trigger}% trigger.`
          }
        >
          <ul className="space-y-1">
            {ranked.map((d) => (
              <li key={d}>
                <button
                  onClick={() => open(d)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2"
                >
                  <span className="h-4 w-4 shrink-0 rounded" style={{ background: fill(d) }} />
                  <span className="flex-1">{d}</span>
                  <span className="tabular font-medium">{valueText(d)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
