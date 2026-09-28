"use client";

import Link from "next/link";
import BasisRiskChart from "@/components/charts/BasisRiskChart";
import { Card, ErrorNote, Loading, PageHeader } from "@/components/ui";
import { getBasisRisk, getModel, getSeasons } from "@/lib/api";
import { classify, OUTCOME_LABEL, pct, signedPct } from "@/lib/payout";
import { useApi } from "@/lib/useApi";

const ROW_STYLE = {
  miss: "bg-drought-soft",
  "false-payout": "bg-pay-soft",
  hit: "",
  "correct-no-payout": "",
} as const;

const BADGE_STYLE = {
  miss: "bg-drought text-white",
  "false-payout": "bg-pay text-white",
  hit: "bg-accent-soft text-accent",
  "correct-no-payout": "bg-canvas text-muted",
} as const;

export default function BasisRiskPage() {
  const risk = useApi("basis-risk", getBasisRisk);
  const seasons = useApi("seasons", getSeasons);
  const model = useApi("model", getModel);
  const error = risk.error ?? seasons.error ?? model.error;

  let body;
  if (error) body = <ErrorNote message={error} />;
  else if (!risk.data || !seasons.data || !model.data) body = <Loading />;
  else {
    const m = model.data;
    const rows = [...seasons.data].sort(
      (a, b) => a.district.localeCompare(b.district) || a.season - b.season,
    );
    body = (
      <div className="space-y-6">
        <Card title="Basis risk by district">
          <BasisRiskChart data={risk.data} />
          <p className="mt-2 text-xs text-muted">
            For each season, the gap between the index payout and the payout the actual yield
            implies (same {m.trigger}% trigger and {m.exit}% exit), averaged over 2022, 2023 and
            2025. 0% means the index paid exactly what the harvest called for; 100% means it paid
            nothing when a full payout was due, or the reverse.
          </p>
        </Card>

        <Card title="Season by season: index payout against actual yield">
          <div className="overflow-x-auto">
            <table className="tabular w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-2 pr-4 font-medium">District</th>
                  <th className="py-2 pr-4 font-medium">Season</th>
                  <th className="py-2 pr-4 text-right font-medium">Index</th>
                  <th className="py-2 pr-4 text-right font-medium">Actual yield</th>
                  <th className="py-2 pr-4 text-right font-medium">Index payout</th>
                  <th className="py-2 pr-4 text-right font-medium">Actual implies</th>
                  <th className="py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const outcome = classify(s, m);
                  return (
                    <tr key={`${s.district}-${s.season}`} className={`border-b border-line last:border-0 ${outcome ? ROW_STYLE[outcome] : ""}`}>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/explorer?district=${s.district}&season=${s.season}`}
                          className="underline decoration-line underline-offset-2 hover:decoration-ink"
                        >
                          {s.district}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{s.season}</td>
                      <td className="py-2 pr-4 text-right">{signedPct(s.index)}</td>
                      <td className="py-2 pr-4 text-right">
                        {s.actualYieldAnom === null ? "–" : signedPct(s.actualYieldAnom)}
                      </td>
                      <td className="py-2 pr-4 text-right">{pct(s.payout)}</td>
                      <td className="py-2 pr-4 text-right">
                        {s.payoutIfActual === null ? "–" : pct(s.payoutIfActual)}
                      </td>
                      <td className="py-2">
                        {outcome && (
                          <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${BADGE_STYLE[outcome]}`}>
                            {OUTCOME_LABEL[outcome]}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            A season counts as poor when the actual yield change is {m.lowYieldThreshold}% or worse.
            The index pays when its predicted yield change is at or below the {m.trigger}% trigger.
            The index shown is the leave-one-out prediction, made without that season.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Basis Risk">
        Basis risk is the gap between what the index pays and what farmers actually lose. The index
        only sees rainfall and vegetation from space, so it can pay when the harvest was fine, or
        miss a season when the harvest failed for another reason.
      </PageHeader>
      {body}
    </>
  );
}
