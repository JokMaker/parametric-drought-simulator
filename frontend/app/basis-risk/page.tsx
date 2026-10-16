"use client";

import Link from "next/link";
import { useState } from "react";
import BasisRiskChart from "@/components/charts/BasisRiskChart";
import ClassLegend from "@/components/charts/ClassLegend";
import { Badge, Card, ErrorNote, Loading, PageHeader, StatStrip, Tabs, type Tone } from "@/components/ui";
import { getBasisRisk, getModel, getSeasons } from "@/lib/api";
import { classify, OUTCOME_LABEL, pct, signedPct, type Outcome } from "@/lib/payout";
import { RISK_CLASSES } from "@/lib/scales";
import { useApi } from "@/lib/useApi";

const OUTCOME_TONE: Record<Outcome, Tone> = {
  miss: "drought",
  "false-payout": "drought",
  hit: "good",
  "correct-no-payout": "neutral",
};

const FILTERS: { key: "all" | Outcome; label: string }[] = [
  { key: "all", label: "All seasons" },
  { key: "miss", label: "Missed" },
  { key: "false-payout", label: "False payouts" },
  { key: "hit", label: "Paid correctly" },
  { key: "correct-no-payout", label: "Correctly did not pay" },
];

export default function BasisRiskPage() {
  const [filter, setFilter] = useState<"all" | Outcome>("all");
  const risk = useApi("basis-risk", getBasisRisk);
  const seasons = useApi("seasons", getSeasons);
  const model = useApi("model", getModel);
  const error = risk.error ?? seasons.error ?? model.error;

  let body;
  if (error) body = <ErrorNote message={error} />;
  else if (!risk.data || !seasons.data || !model.data) body = <Loading />;
  else {
    const m = model.data;
    const rows = [...seasons.data]
      .sort((a, b) => a.district.localeCompare(b.district) || a.season - b.season)
      .map((s) => ({ s, outcome: classify(s, m) }));
    const count = (k: "all" | Outcome) => (k === "all" ? rows.length : rows.filter((r) => r.outcome === k).length);
    const shown = filter === "all" ? rows : rows.filter((r) => r.outcome === filter);
    const byRisk = [...risk.data].sort((a, b) => b.basisRisk - a.basisRisk);
    const highest = byRisk[0];
    const lowest = byRisk[byRisk.length - 1];
    const poorCount = count("hit") + count("miss");

    body = (
      <div className="space-y-5">
        <StatStrip
          items={[
            { value: pct(highest.basisRisk), label: "Highest basis risk", note: highest.district },
            { value: pct(lowest.basisRisk), label: "Lowest basis risk", note: lowest.district },
            { value: String(count("miss")), label: "Poor harvests the index missed", note: `of ${poorCount} poor seasons` },
            { value: String(count("false-payout")), label: "False payouts", note: `of ${rows.length - poorCount} normal seasons` },
          ]}
        />

        <Card
          label="Basis risk by district · 2022–2025"
          title={`${highest.district}'s payouts sit furthest from its harvests (${pct(highest.basisRisk)}); ${lowest.district}'s match most closely (${pct(lowest.basisRisk)})`}
          action={
            <Link href="/map?metric=risk" className="text-sm text-accent hover:underline">
              See on the map
            </Link>
          }
          source={`Average gap between the index payout and the payout the harvest called for (same ${m.trigger}% trigger and ${m.exit}% exit), over the four seasons with NISR harvest data.`}
        >
          <BasisRiskChart data={risk.data} />
          <div className="mt-3 border-t border-line pt-3">
            <ClassLegend title="Basis risk" classes={RISK_CLASSES} />
          </div>
        </Card>

        <Card
          label={`Season by season · ${rows.length} district-seasons`}
          title={`${count("hit") + count("correct-no-payout")} decisions matched the harvest; ${count("miss")} missed season and ${count("false-payout")} false payouts did not`}
          source={`A harvest ${Math.abs(m.lowYieldThreshold)}% or more below normal counts as poor. The index is the leave-one-out prediction. Click a district to open it in the Explorer.`}
        >
          <div className="mb-3">
            <Tabs
              label="Filter seasons"
              value={filter}
              options={FILTERS.map((f) => ({ key: f.key, label: `${f.label} (${count(f.key)})` }))}
              onChange={setFilter}
            />
          </div>
          <div className="-mx-2 overflow-x-auto">
            <table className="tabular w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="px-2 pb-2 font-medium">District</th>
                  <th className="px-2 pb-2 font-medium">Season</th>
                  <th className="px-2 pb-2 text-right font-medium">Index</th>
                  <th className="px-2 pb-2 text-right font-medium">Actual yield</th>
                  <th className="px-2 pb-2 text-right font-medium">Index payout</th>
                  <th className="px-2 pb-2 text-right font-medium">Harvest implies</th>
                  <th className="px-2 pb-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ s, outcome }) => (
                  <tr key={`${s.district}-${s.season}`} className="border-t border-line hover:bg-surface-2">
                    <td className="px-2 py-2.5">
                      <Link
                        href={`/explorer?district=${s.district}&season=${s.season}`}
                        className="font-medium hover:text-accent"
                      >
                        {s.district}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 text-muted">{s.season}</td>
                    <td className="px-2 py-2.5 text-right">{signedPct(s.index)}</td>
                    <td className="px-2 py-2.5 text-right">
                      {s.actualYieldAnom === null ? "–" : signedPct(s.actualYieldAnom)}
                    </td>
                    <td className="px-2 py-2.5 text-right">{pct(s.payout)}</td>
                    <td className="px-2 py-2.5 text-right">
                      {s.payoutIfActual === null ? "–" : pct(s.payoutIfActual)}
                    </td>
                    <td className="px-2 py-2.5">
                      {outcome && <Badge tone={OUTCOME_TONE[outcome]}>{OUTCOME_LABEL[outcome]}</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Basis Risk">
        The gap between what the index pays and what farmers actually lose, measured against four
        seasons of harvest surveys.
      </PageHeader>
      {body}
    </>
  );
}
