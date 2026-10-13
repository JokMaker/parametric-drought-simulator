"use client";

import { CloudRain, Sun } from "lucide-react";
import { useState } from "react";
import ColorLegend from "@/components/charts/ColorLegend";
import { IndexChart, PayoutChart, type YearBar } from "@/components/charts/HistoryChart";
import HistoryHeatmap from "@/components/charts/HistoryHeatmap";
import StatCard from "@/components/StatCard";
import { Card, ErrorNote, Loading, PageHeader } from "@/components/ui";
import { getHistory, getModel } from "@/lib/api";
import { DISTRICTS } from "@/lib/constants";
import { pct } from "@/lib/payout";
import { INDEX_GRADIENT, INDEX_RANGE } from "@/lib/scales";
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
            <ShareBar value={payoutShare(other)} colour="bg-drought" />
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
          }
        >
          <div className="mb-3 flex flex-wrap gap-4">
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2.5 w-4 rounded-sm" style={{ background: INDEX_GRADIENT }} />
              Bar colour: red = predicted loss or payout, green = predicted gain
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2.5 w-4 rounded-sm bg-drought/15" />
              Shaded years: documented droughts
            </span>
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

        <Card
          title="Every district, every year"
          description="Each square is one district in one season, coloured by the predicted yield change. Red columns above the years mark documented droughts; a dot means the index paid out."
        >
          <HistoryHeatmap points={history.data} trigger={model.data.trigger} />
          <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
            <ColorLegend
              title="Predicted yield change"
              gradient={INDEX_GRADIENT}
              ticks={[
                { at: 0, label: `≤ −${INDEX_RANGE}%` },
                { at: 0.5, label: "0" },
                { at: 1, label: `≥ +${INDEX_RANGE}%` },
              ]}
            />
            <div className="flex flex-wrap gap-4 pb-5 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-ink/80" /> Payout
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-drought" /> Documented drought year
              </span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Backtest" title="Drought History">
        The index run on satellite data for every season since 2000. Shaded bands mark 2003–2006
        and 2013–2017, the years Niyonsenga et al. (2024) identify as Rwanda&apos;s most severe
        droughts, especially in Eastern Province.
      </PageHeader>
      {body}
    </>
  );
}
