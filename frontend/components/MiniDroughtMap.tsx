"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ColorLegend from "@/components/charts/ColorLegend";
import DistrictMap from "@/components/charts/DistrictMap";
import { Card, ErrorNote, Loading } from "@/components/ui";
import { getHistory, getModel, getSeasons, getShapes } from "@/lib/api";
import { isDroughtSeason, LAST_SEASON, SEASONS } from "@/lib/constants";
import { districtsInSeason } from "@/lib/districtSeason";
import { anomalyLabel, pct, signedPct } from "@/lib/payout";
import { INDEX_GRADIENT, INDEX_RANGE, indexColor } from "@/lib/scales";
import { useApi } from "@/lib/useApi";

/** Compact drought map for the Overview: the index by district for one season. */
export default function MiniDroughtMap() {
  const router = useRouter();
  const [season, setSeason] = useState(LAST_SEASON);
  const shapes = useApi("shapes", getShapes);
  const history = useApi("history", getHistory);
  const calibration = useApi("seasons", getSeasons);
  const model = useApi("model", getModel);
  const error = shapes.error ?? history.error ?? calibration.error ?? model.error;

  let body;
  if (error) body = <ErrorNote message={error} />;
  else if (!shapes.data || !history.data || !calibration.data || !model.data) body = <Loading rows={1} />;
  else {
    const values = districtsInSeason(history.data, calibration.data, season);
    const trigger = model.data.trigger;
    const paying = [...values.values()].filter((v) => v.index <= trigger).length;
    body = (
      <>
        <DistrictMap
          shapes={shapes.data}
          height={460}
          fill={(d) => (values.has(d) ? indexColor(values.get(d)!.index) : "var(--surface-2)")}
          ariaLabel={`Predicted yield change by district, Season A ${season}`}
          onSelect={(d) => router.push(`/explorer?district=${d}&season=${season}`)}
          tooltip={(d) => {
            const v = values.get(d);
            return v ? (
              <div className="tabular space-y-0.5">
                <div className="font-semibold">
                  {d} <span className="font-normal text-muted">· Season A {season}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted">Rainfall</span>
                  <span>{anomalyLabel(v.rainZ)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted">Greenness</span>
                  <span>{anomalyLabel(v.ndviZ)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted">Predicted yield change</span>
                  <span className="font-medium">{signedPct(v.index)}</span>
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
        <p className="mb-3 text-xs text-muted">
          {paying} of {values.size} districts reach the {trigger}% trigger
          {isDroughtSeason(season) ? " · documented drought year" : ""}.
        </p>
        <ColorLegend
          title="Predicted yield change"
          gradient={INDEX_GRADIENT}
          ticks={[
            { at: 0, label: `≤ −${INDEX_RANGE}%` },
            { at: 0.5, label: "0" },
            { at: 1, label: `≥ +${INDEX_RANGE}%` },
          ]}
        />
      </>
    );
  }

  return (
    <Card
      title="Drought map"
      description="Red districts are predicted to lose yield, green ones to gain. Click a district to open it."
      action={
        <div className="flex items-center gap-2">
          <select
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="rounded-lg border border-line bg-surface px-2 py-1 text-sm"
            aria-label="Season"
          >
            {[...SEASONS].reverse().map((s) => (
              <option key={s} value={s}>
                Season A {s}
              </option>
            ))}
          </select>
          <Link
            href={`/map?season=${season}`}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-accent hover:bg-accent-soft"
          >
            Full map <ArrowRight size={14} />
          </Link>
        </div>
      }
    >
      {body}
    </Card>
  );
}
