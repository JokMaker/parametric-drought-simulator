"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ClassLegend from "@/components/charts/ClassLegend";
import DistrictMap from "@/components/charts/DistrictMap";
import { Card, ErrorNote, Loading } from "@/components/ui";
import { getHistory, getModel, getSeasons, getShapes } from "@/lib/api";
import { isDroughtSeason, LAST_SEASON, SEASONS } from "@/lib/constants";
import { districtsInSeason } from "@/lib/districtSeason";
import { anomalyLabel, pct, signedPct } from "@/lib/payout";
import { indexClass, indexClasses } from "@/lib/scales";
import { useApi } from "@/lib/useApi";

/** Drought map for the Overview: the index by district for one season. */
export default function MiniDroughtMap() {
  const router = useRouter();
  const [season, setSeason] = useState(LAST_SEASON);
  const shapes = useApi("shapes", getShapes);
  const history = useApi("history", getHistory);
  const calibration = useApi("seasons", getSeasons);
  const model = useApi("model", getModel);
  const error = shapes.error ?? history.error ?? calibration.error ?? model.error;

  if (error) return <ErrorNote message={error} />;
  if (!shapes.data || !history.data || !calibration.data || !model.data) return <Loading rows={1} />;

  const { trigger, exit } = model.data;
  const values = districtsInSeason(history.data, calibration.data, season);
  const all = [...values.values()];
  const paying = all.filter((v) => v.index <= trigger);
  const worst = [...all].sort((a, b) => a.index - b.index)[0];
  const title =
    paying.length === 0
      ? `Season A ${season}: no district reaches the payout trigger`
      : `Season A ${season}: ${paying.length} of ${all.length} districts reach the trigger, ${worst.district} worst at ${signedPct(worst.index)}`;

  return (
    <Card
      label={`Drought map${isDroughtSeason(season) ? " · documented drought year" : ""}`}
      title={title}
      action={
        <div className="flex items-center gap-3">
          <select
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="rounded-sm border border-line bg-surface px-2 py-1 text-sm"
            aria-label="Season"
          >
            {[...SEASONS].reverse().map((s) => (
              <option key={s} value={s}>
                Season A {s}
              </option>
            ))}
          </select>
          <Link href={`/map?season=${season}`} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
            Full map <ArrowRight size={14} />
          </Link>
        </div>
      }
      source="Predicted yield change by district. Click a district to open it in the Explorer."
    >
      <div className="mx-auto max-w-xl">
        <DistrictMap
          shapes={shapes.data}
          height={480}
          fill={(d) => (values.has(d) ? indexClass(values.get(d)!.index, trigger, exit).color : "var(--surface-2)")}
          label={(d) => (values.has(d) ? signedPct(values.get(d)!.index) : "")}
          ariaLabel={`Predicted yield change by district, Season A ${season}`}
          onSelect={(d) => router.push(`/explorer?district=${d}&season=${season}`)}
          tooltip={(d) => {
            const v = values.get(d);
            return v ? (
              <div className="tabular space-y-0.5">
                <div className="font-semibold">{d}</div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted">Rainfall</span>
                  <span>{anomalyLabel(v.rainZ)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted">Crop greenness</span>
                  <span>{anomalyLabel(v.ndviZ)}</span>
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
      <div className="mt-4 border-t border-line pt-3">
        <ClassLegend title="Predicted yield change" classes={indexClasses(trigger, exit)} />
      </div>
    </Card>
  );
}
