"use client";

import { useState } from "react";
import ClassLegend, { IndexLegend } from "@/components/charts/ClassLegend";
import { IndexChart, PayoutChart, type YearBar } from "@/components/charts/HistoryChart";
import HistoryHeatmap from "@/components/charts/HistoryHeatmap";
import { Card, ErrorNote, Loading, PageHeader, ShareBars, StatStrip } from "@/components/ui";
import { getHistory, getModel } from "@/lib/api";
import { DISTRICTS } from "@/lib/constants";
import { pct } from "@/lib/payout";
import { PAYOUT_CLASSES } from "@/lib/scales";
import type { HistoryPoint } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const ALL = "All districts";

const share = (pts: HistoryPoint[]) => (pts.length ? pts.filter((p) => p.pays).length / pts.length : 0);

export default function HistoryPage() {
  const [district, setDistrict] = useState<string>(ALL);
  const history = useApi("history", getHistory);
  const model = useApi("model", getModel);
  const error = history.error ?? model.error;

  let body;
  if (error) body = <ErrorNote message={error} />;
  else if (!history.data || !model.data) body = <Loading />;
  else {
    const { trigger, exit } = model.data;
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
    const unit = district === ALL ? "district-seasons" : "seasons";
    const where = district === ALL ? "" : ` in ${district}`;

    const topPayouts = [...bars].sort((a, b) => b.payout - a.payout).slice(0, 2);
    // For the heatmap headline, use all districts regardless of the filter.
    const allYears = [...new Set(history.data.map((p) => p.windowYear))].map((y) => {
      const ofYear = history.data!.filter((p) => p.windowYear === y);
      return { y, paid: ofYear.filter((p) => p.pays).length, mean: ofYear.reduce((s, p) => s + p.index, 0) / ofYear.length };
    });
    const allPaid = allYears.filter((x) => x.paid === DISTRICTS.length).map((x) => x.y);
    const worstYear = [...allYears].sort((a, b) => a.mean - b.mean)[0];

    const filter = (
      <select
        value={district}
        onChange={(e) => setDistrict(e.target.value)}
        className="rounded-sm border border-line bg-surface px-2 py-1 text-sm"
        aria-label="District"
      >
        {[ALL, ...DISTRICTS].map((d) => (
          <option key={d}>{d}</option>
        ))}
      </select>
    );

    body = (
      <div className="space-y-5">
        <StatStrip
          items={[
            { value: pct(share(drought)), label: "Seasons paid in documented droughts", note: `${drought.filter((p) => p.pays).length} of ${drought.length} ${unit}` },
            { value: pct(share(other)), label: "Seasons paid in other years", note: `${other.filter((p) => p.pays).length} of ${other.length} ${unit}` },
            {
              value: `${(share(drought) / share(other)).toFixed(1)}×`,
              label: "More often in documented droughts",
              viz: (
                <ShareBars
                  rows={[
                    { label: "Drought", share: share(drought), color: "var(--drought)" },
                    { label: "Other", share: share(other), color: "var(--faint)" },
                  ]}
                />
              ),
            },
          ]}
        />

        <Card
          label={`Predicted yield change · ${district === ALL ? "average of seven districts" : district}, 2000–2024 rains`}
          title={`Payouts cluster in documented droughts${where}: ${pct(share(drought))} of drought seasons against ${pct(share(other))} of others`}
          action={filter}
          source="The index run on satellite data for every season since 2000. Documented droughts: 2003–2006 and 2013–2017 (Niyonsenga et al., 2024). Years are the October–December rains; Season A is harvested the following year."
        >
          <IndexChart data={bars} trigger={trigger} exit={exit} />
          <div className="mt-3 border-t border-line pt-3">
            <IndexLegend trigger={trigger} exit={exit} />
          </div>
        </Card>

        <Card
          label={`Payout · ${district === ALL ? "average of seven districts" : district}`}
          title={`Largest ${district === ALL ? "average " : ""}payouts${where}: ${topPayouts.map((b) => `${b.year} rains (${pct(b.payout)})`).join(" and ")}`}
          action={filter}
          source="Share of the full payout; the average across districts when all are shown."
        >
          <PayoutChart data={bars} />
          <div className="mt-3 border-t border-line pt-3">
            <ClassLegend classes={PAYOUT_CLASSES} />
          </div>
        </Card>

        <Card
          label="Every district, every year"
          title={
            allPaid.length
              ? `All seven districts would have been paid in ${allPaid.length} years; the worst was ${worstYear.y} (average ${worstYear.mean.toFixed(0)}%)`
              : `The worst year was ${worstYear.y}, with an average predicted change of ${worstYear.mean.toFixed(0)}%`
          }
          source="Rows: districts. Columns: October–December rains (red line: documented drought). A dot marks a payout. Click a square to open it in the Explorer."
        >
          <HistoryHeatmap points={history.data} trigger={trigger} exit={exit} />
          <div className="mt-3 border-t border-line pt-3">
            <IndexLegend trigger={trigger} exit={exit} />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Drought History" />
      {body}
    </>
  );
}
