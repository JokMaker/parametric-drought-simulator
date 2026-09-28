"use client";

import { CloudRain, Sun } from "lucide-react";
import { useState } from "react";
import { IndexChart, PayoutChart, type YearBar } from "@/components/charts/HistoryChart";
import StatCard from "@/components/StatCard";
import { Card, ErrorNote, LegendDot, Loading, PageHeader } from "@/components/ui";
import { getHistory, getModel, HAS_DISTRICT_HISTORY } from "@/lib/api";
import { DISTRICTS } from "@/lib/constants";
import { pct } from "@/lib/payout";
import type { HistoryPoint } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const ALL = "All districts";

function payoutShare(points: HistoryPoint[]) {
  return points.length ? points.filter((p) => p.pays).length / points.length : 0;
}

function ShareBar({ value, colour }: { value: number; colour: string }) {
  return (
    <div className="mt-4 h-2 rounded-full bg-surface-2">
      <div className={`h-full rounded-full ${colour}`} style={{ width: `${value * 100}%` }} />
    </div>
  );
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
    const ratio = payoutShare(other) ? payoutShare(drought) / payoutShare(other) : 0;
    const scope = district === ALL ? "district-seasons" : "seasons";

    body = (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Payouts in documented drought years"
            value={pct(payoutShare(drought))}
            hint={`${drought.filter((p) => p.pays).length} of ${drought.length} ${scope}`}
            icon={Sun}
          >
            <ShareBar value={payoutShare(drought)} colour="bg-drought" />
          </StatCard>
          <StatCard
            label="Payouts in other years"
            value={pct(payoutShare(other))}
            hint={`${other.filter((p) => p.pays).length} of ${other.length} ${scope}`}
            icon={CloudRain}
          >
            <ShareBar value={payoutShare(other)} colour="bg-other" />
          </StatCard>
          <StatCard
            label="Drought years pay out"
            value={ratio ? `${ratio.toFixed(1)}×` : "–"}
            hint="as often as other years. A credible index should pay far more often in documented droughts."
          />
        </div>

        <Card
          title="Index and payout by year"
          description="Years are the October–December rains; the Season A harvest follows early the next year. Hover a year for details."
          action={
            HAS_DISTRICT_HISTORY ? (
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
                aria-label="District"
              >
                {[ALL, ...DISTRICTS].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-muted">District filter needs the backend</span>
            )
          }
        >
          <div className="mb-3 flex flex-wrap gap-4">
            <LegendDot color="bg-drought">Documented drought year</LegendDot>
            <LegendDot color="bg-other">Other year</LegendDot>
          </div>
          <h3 className="text-xs font-medium text-muted">
            Predicted yield change{district === ALL ? " (average of seven districts)" : ""}
          </h3>
          <IndexChart data={bars} trigger={model.data.trigger} exit={model.data.exit} />
          <h3 className="mt-6 text-xs font-medium text-muted">
            {district === ALL ? "Average payout" : "Payout"}
          </h3>
          <PayoutChart data={bars} />
          <p className="mt-3 text-xs leading-5 text-muted">
            A payout starts once the index falls below the dashed trigger line and reaches 100% at
            the exit.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Backtest" title="Drought History">
        The index run on satellite data for every season since 2000. Red marks 2003–2006 and
        2013–2017, the years Niyonsenga et al. (2024) identify as Rwanda&apos;s most severe
        droughts, especially in Eastern Province.
      </PageHeader>
      {body}
    </>
  );
}
