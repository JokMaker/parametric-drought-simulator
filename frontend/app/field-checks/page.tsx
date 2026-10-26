"use client";

import Link from "next/link";
import NumberInput from "@/components/NumberInput";
import { useState } from "react";
import { Card, ErrorNote, Loading, PageHeader, StatStrip } from "@/components/ui";
import { getCurrentSeason, getPlotLosses, getReportCounts, getSeasons, USE_MOCK } from "@/lib/api";
import { DISTRICTS, YIELD_SEASONS } from "@/lib/constants";
import { checkStatus, DEFAULT_RULE, STATUS_LABEL, type CheckRule, type CheckStatus } from "@/lib/fieldChecks";
import { pct, signedPct } from "@/lib/payout";
import { useApi } from "@/lib/useApi";

const TONE: Record<CheckStatus, string> = {
  paid: "border-other/50 text-ink",
  check: "border-drought bg-drought text-white",
  watch: "border-sev-moderate text-ink",
  clear: "border-line text-muted",
};

type Row = {
  district: string;
  index: number;
  payout: number;
  reports: number;
  lossShare: number | null;
  plots: number | null;
  actual: number | null;
  status: CheckStatus;
};

export default function FieldChecksPage() {
  const seasons = useApi("seasons", getSeasons);
  const losses = useApi("plot-losses", getPlotLosses);
  const reports = useApi("report-counts", getReportCounts);
  const current = useApi("current-season", getCurrentSeason);
  const [season, setSeason] = useState(2019);
  const [rule, setRule] = useState<CheckRule>(DEFAULT_RULE);
  const error = seasons.error ?? losses.error ?? reports.error ?? current.error;

  let body;
  if (error) body = <ErrorNote message={error} />;
  else if (!seasons.data || !losses.data || !reports.data || !current.data) body = <Loading />;
  else {
    const live = season === current.data.season;
    const entry = (d: string) => reports.data!.find((r) => r.district === d && r.season === season);
    const count = (d: string) => entry(d)?.reports ?? 0;
    const CAUSE: Record<string, string> = { drought: "drought", pests: "pests", flood: "flood", other: "other" };
    const causeText = (d: string) =>
      Object.entries(entry(d)?.causes ?? {}).map(([c, n]) => `${CAUSE[c] ?? c} ${n}`).join(", ");
    const rows: Row[] = DISTRICTS.map((district) => {
      const loss = losses.data!.find((l) => l.district === district && l.season === season);
      const v = live
        ? current.data!.districts.find((x) => x.district === district)!
        : seasons.data!.find((s) => s.district === district && s.season === season)!;
      const actual = live ? null : (v as { actualYieldAnom: number | null }).actualYieldAnom;
      const n = count(district);
      return {
        district,
        index: v.index,
        payout: v.payout,
        reports: n,
        lossShare: loss?.severeLossShare ?? null,
        plots: loss?.plots ?? null,
        actual,
        status: checkStatus(v.payout, n, loss?.severeLossShare ?? null, rule),
      };
    });
    const order: CheckStatus[] = ["check", "watch", "paid", "clear"];
    rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || (b.lossShare ?? 0) - (a.lossShare ?? 0));
    const checks = rows.filter((r) => r.status === "check");
    const paid = rows.filter((r) => r.status === "paid");
    const totalReports = rows.reduce((s, r) => s + r.reports, 0);
    const title = checks.length
      ? `Season A ${season}: ${checks.length} of 7 districts need a field check: ${checks.map((r) => r.district).join(", ")}`
      : `Season A ${season}: no district needs a field check`;

    body = (
      <div className="space-y-5">
        <StatStrip
          items={[
            { value: String(checks.length), label: "Districts needing a field check", note: `paid under ${pct(rule.paidEnough)}, but evidence of loss` },
            { value: String(paid.length), label: "Districts the index paid", note: `Season A ${season}` },
            { value: String(totalReports), label: "Farmer loss reports on file", note: USE_MOCK ? "reports need the live API" : "one per policy per season" },
            {
              value: live ? "—" : pct(Math.max(...rows.map((r) => r.lossShare ?? 0))),
              label: "Highest share of farms that lost half their harvest",
              note: live ? "survey results arrive after the harvest" : "NISR survey",
            },
          ]}
        />

        <Card
          label={`Field checks · Season A ${season}${live ? " · window in progress, provisional index" : ""}`}
          title={title}
          source={`A district needs a field check when the index paid less than ${pct(rule.paidEnough)} but there is evidence of loss: at least ${rule.reports} farmer reports, or at least ${pct(rule.lossShare)} of the farms in the NISR survey harvesting less than half the district's expected yield. A token payout does not settle such a case. "Watch" means some evidence below that level (a report, or a loss share within 10 points of it). In ordinary seasons 10–40% of surveyed farms harvest under half the expected yield, because small plots vary a lot; in Season A 2019 it was 47–59% in every district. ${live ? "For the season in progress the index is provisional (This Season page) and survey results come only after the harvest, so reports are the only evidence." : "The index is the leave-one-out prediction, as on every other page."}`}
        >
          <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <div className="mb-1.5 text-[13px] text-muted">Season A</div>
              <div className="flex flex-wrap overflow-hidden rounded-sm border border-line">
                {[...YIELD_SEASONS, current.data.season].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeason(s)}
                    aria-pressed={s === season}
                    className={`border-r border-line px-2.5 py-1.5 text-sm last:border-r-0 ${s === season ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
                  >
                    {s}
                    {s === current.data!.season ? " · now" : ""}
                  </button>
                ))}
              </div>
            </div>
            <label className="text-[13px] text-muted">
              Reports needed
              <NumberInput
                min={1}
                max={1000}
                value={rule.reports}
                onChange={(n) => setRule({ ...rule, reports: Math.round(n) })}
                className="mt-1.5 block w-24 rounded-sm border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="text-[13px] text-muted">
              Survey loss share needed
              <div className="mt-1.5 flex w-28 items-center rounded-sm border border-line bg-surface">
                <NumberInput
                  min={5}
                  max={100}
                  step={5}
                  value={Math.round(rule.lossShare * 100)}
                  onChange={(n) => setRule({ ...rule, lossShare: n / 100 })}
                  className="w-full min-w-0 bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
                />
                <span className="pr-2 text-xs">%</span>
              </div>
            </label>
          </div>

          <div className="-mx-2 overflow-x-auto">
            <table className="tabular w-full min-w-[760px] whitespace-nowrap text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="px-2 pb-2 font-medium">District</th>
                  <th className="px-2 pb-2 font-medium">Status</th>
                  <th className="px-2 pb-2 text-right font-medium">Index</th>
                  <th className="px-2 pb-2 text-right font-medium">Payout</th>
                  <th className="px-2 pb-2 font-medium">Farms that lost half their harvest</th>
                  <th className="px-2 pb-2 text-right font-medium">Farmer reports</th>
                  <th className="px-2 pb-2 text-right font-medium">Real harvest</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.district} className="border-t border-line">
                    <td className="px-2 py-2.5 font-medium">
                      {live ? r.district : (
                        <Link href={`/explorer?district=${r.district}&season=${season}`} className="hover:text-accent">{r.district}</Link>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={`inline-block rounded-sm border px-1.5 py-px text-xs font-medium ${TONE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right">{signedPct(r.index)}</td>
                    <td className="px-2 py-2.5 text-right">{pct(r.payout)}</td>
                    <td className="px-2 py-2.5">
                      {r.lossShare === null ? (
                        <span className="text-xs text-faint">{live ? "after the harvest" : "no survey"}</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="relative h-2 w-28 bg-surface-2">
                            <div className="h-full" style={{ width: `${Math.min(1, r.lossShare) * 100}%`, background: r.lossShare >= rule.lossShare ? "var(--drought)" : "var(--faint)" }} />
                            <span className="absolute -inset-y-1 w-px bg-ink/60" style={{ left: `${rule.lossShare * 100}%` }} />
                          </div>
                          <span>{pct(r.lossShare)}</span>
                          <span className="text-xs text-faint">of {r.plots} farms</span>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      {r.reports}
                      {causeText(r.district) && <span className="ml-1.5 text-xs text-muted">({causeText(r.district)})</span>}
                    </td>
                    <td className="px-2 py-2.5 text-right">{r.actual === null ? "–" : signedPct(r.actual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            The line on each bar marks the {pct(rule.lossShare)} level. Farmers report losses from the Farmer View.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Field Checks" />
      {body}
    </>
  );
}
