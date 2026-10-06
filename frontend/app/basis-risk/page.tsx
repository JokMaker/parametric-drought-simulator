"use client";

import { ArrowDownRight, ArrowUpRight, CircleAlert, CircleOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import BasisRiskChart from "@/components/charts/BasisRiskChart";
import StatCard from "@/components/StatCard";
import { Badge, Card, ErrorNote, Loading, PageHeader, type Tone } from "@/components/ui";
import { getBasisRisk, getModel, getSeasons } from "@/lib/api";
import { classify, OUTCOME_LABEL, pct, signedPct, type Outcome } from "@/lib/payout";
import { useApi } from "@/lib/useApi";

const OUTCOME_TONE: Record<Outcome, Tone> = {
  miss: "drought",
  "false-payout": "pay",
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

    body = (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Highest basis risk" value={pct(highest.basisRisk)} hint={highest.district} icon={ArrowUpRight} />
          <StatCard label="Lowest basis risk" value={pct(lowest.basisRisk)} hint={lowest.district} icon={ArrowDownRight} />
          <StatCard
            label="Missed poor seasons"
            value={String(count("miss"))}
            hint={`Harvest fell ${m.lowYieldThreshold}% or more, index did not pay`}
            icon={CircleOff}
          />
          <StatCard
            label="False payouts"
            value={String(count("false-payout"))}
            hint="Index paid, harvest was not poor"
            icon={CircleAlert}
          />
        </div>

        <Card
          title="Basis risk by district"
          description={`For each season, the gap between the index payout and the payout the actual yield implies (same ${m.trigger}% trigger and ${m.exit}% exit), averaged over the four seasons with yield data (2022–2025). 0% means the index paid exactly what the harvest called for.`}
        >
          <BasisRiskChart data={risk.data} />
        </Card>

        <Card
          title="Season by season"
          description={`A season is poor when the actual yield change is ${m.lowYieldThreshold}% or worse. The index shown is the leave-one-out prediction, made without that season. Select a district to open it in the Explorer.`}
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  filter === f.key
                    ? "border-ink bg-ink text-surface"
                    : "border-line text-muted hover:border-ink/30 hover:text-ink"
                }`}
              >
                {f.label} <span className="tabular opacity-70">{count(f.key)}</span>
              </button>
            ))}
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
      <PageHeader eyebrow="Honest limits" title="Basis Risk">
        Basis risk is the gap between what the index pays and what farmers actually lose. The index
        only sees rainfall and vegetation from space, so it can pay when the harvest was fine, or
        miss a season when the harvest failed for another reason.
      </PageHeader>
      {body}
    </>
  );
}
