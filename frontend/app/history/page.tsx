"use client";

import { useState } from "react";
import { IndexChart, PayoutChart, type YearBar } from "@/components/charts/HistoryChart";
import StatCard from "@/components/StatCard";
import { Card, ErrorNote, Loading, PageHeader } from "@/components/ui";
import { getHistory, getModel, HAS_DISTRICT_HISTORY } from "@/lib/api";
import { DISTRICTS } from "@/lib/constants";
import { pct } from "@/lib/payout";
import type { HistoryPoint } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const ALL = "All districts";

function payoutShare(points: HistoryPoint[]) {
  return points.length ? points.filter((p) => p.pays).length / points.length : 0;
}

export default function HistoryPage() {
  const [district, setDistrict] = useState<string>(ALL);
  const history = useApi("history", getHistory);
  const model = useApi("model", getModel);
  const error = history.error ?? model.error;

  let body;
  if (error) body = <ErrorNote message={error} />;
  else if (!history.data || !model.data) body = <Loading />;
  else {
    const points = district === ALL ? history.data : history.data.filter((p) => p.district === district);
    const years = [...new Set(points.map((p) => p.windowYear))].sort((a, b) => a - b);
    const bars: YearBar[] = years.map((year) => {
      const ofYear = points.filter((p) => p.windowYear === year);
      return {
        year,
        index: ofYear.reduce((s, p) => s + p.index, 0) / ofYear.length,
        payout: ofYear.reduce((s, p) => s + p.payout, 0) / ofYear.length,
        paying: ofYear.filter((p) => p.pays).length,
        districts: ofYear.length,
        droughtYear: ofYear[0].droughtYear,
      };
    });
    const drought = points.filter((p) => p.droughtYear);
    const other = points.filter((p) => !p.droughtYear);

    body = (
      <div className="space-y-6">
        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-drought" /> Documented drought year
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-normal" /> Other year
              </span>
            </div>
            {HAS_DISTRICT_HISTORY ? (
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm"
                aria-label="District"
              >
                {[ALL, ...DISTRICTS].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-muted">
                District filter available once the backend supplies per-district history
              </span>
            )}
          </div>
          <h3 className="mt-2 text-xs font-semibold">Predicted yield change (the index)</h3>
          <IndexChart data={bars} trigger={model.data.trigger} exit={model.data.exit} />
          <h3 className="mt-6 text-xs font-semibold">
            {district === ALL ? "Average payout" : "Payout"}
          </h3>
          <PayoutChart data={bars} />
          <p className="mt-2 text-xs leading-5 text-muted">
            {district === ALL
              ? "Top: the average predicted yield change across the seven districts. Bottom: the average payout, where a year in which every district reaches the exit shows 100%."
              : `Top: ${district}'s predicted yield change. Bottom: its payout.`}{" "}
            A payout starts once the index falls below the dashed trigger line and reaches 100% at
            the exit. Darker payout bars are documented drought years. Hover a year for details. Years are the October–December rains; the Season A
            harvest follows early the next year.
          </p>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            label="Payouts in documented drought years"
            value={pct(payoutShare(drought))}
            hint={`${drought.filter((p) => p.pays).length} of ${drought.length} district-seasons`}
          />
          <StatCard
            label="Payouts in other years"
            value={pct(payoutShare(other))}
            hint={`${other.filter((p) => p.pays).length} of ${other.length} district-seasons`}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Drought History">
        The index run on satellite data for every season since 2000. Red bars mark 2003–2006 and
        2013–2017, the years Niyonsenga et al. (2024) identify as Rwanda&apos;s most severe
        droughts, especially in Eastern Province. A credible index should pay out far more often in
        those years.
      </PageHeader>
      {body}
    </>
  );
}
