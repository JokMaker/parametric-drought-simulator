"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import LossRatioChart from "@/components/charts/LossRatioChart";
import { Card, DotCount, ErrorNote, Loading, PageHeader, StatStrip } from "@/components/ui";
import { getHistory, getModel, getSeasons } from "@/lib/api";
import { pct } from "@/lib/payout";
import { DEFAULT_TERMS, payoutHistory, priceDistricts, rwf, rwfShort, seasonBooks, type Terms } from "@/lib/pricing";
import { useApi } from "@/lib/useApi";

function Field({ id, label, value, onChange, unit, step, min, max, hint }: {
  id: string; label: string; value: number; onChange: (v: number) => void;
  unit: string; step: number; min: number; max: number; hint: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="mt-1 flex items-center rounded-sm border border-line bg-surface focus-within:border-accent">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
          className="tabular w-full min-w-0 bg-transparent px-2.5 py-1.5 text-sm outline-none"
        />
        <span className="shrink-0 pr-2.5 text-xs text-muted">{unit}</span>
      </div>
      <p className="mt-1 text-xs text-faint">{hint}</p>
    </div>
  );
}

export default function PricingPage() {
  const history = useApi("history", getHistory);
  const model = useApi("model", getModel);
  const calibration = useApi("seasons", getSeasons);
  // Percentages are edited as whole numbers and stored as shares.
  const [terms, setTerms] = useState<Terms>(DEFAULT_TERMS);
  const set = (k: keyof Terms) => (v: number) => setTerms((t) => ({ ...t, [k]: v }));
  const changed = JSON.stringify(terms) !== JSON.stringify(DEFAULT_TERMS);
  const error = history.error ?? model.error ?? calibration.error;

  let body;
  if (error) body = <ErrorNote message={error} />;
  else if (!history.data || !model.data || !calibration.data) body = <Loading />;
  else {
    const record = payoutHistory(history.data, calibration.data);
    const prices = priceDistricts(record, terms);
    const books = seasonBooks(record, prices, terms);
    const n = books.length;
    const premiumTotal = books[0].premiums;
    const expectedPayouts = books.reduce((s, b) => s + b.payouts, 0) / n;
    const worst = books.reduce((a, b) => (b.payouts > a.payouts ? b : a));
    const losing = books.filter((b) => b.lossRatio > 1);
    const avgFarmer = prices.reduce((s, p) => s + p.farmerPays, 0) / prices.length;
    const byCost = [...prices].sort((a, b) => b.premium - a.premium);
    const dearest = byCost[0];
    const cheapest = byCost[byCost.length - 1];

    body = (
      <div className="space-y-5">
        <Card
          label="Contract terms"
          title="Set the cover and see what it costs"
          action={
            changed && (
              <button
                onClick={() => setTerms(DEFAULT_TERMS)}
                className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1 text-sm text-muted hover:bg-surface-2 hover:text-ink"
              >
                <RotateCcw size={14} /> Reset
              </button>
            )
          }
          source="Illustrative defaults, all editable. The loading covers administration, reinsurance and a risk margin; the subsidy is the share of the premium paid by government."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="sum" label="Sum insured per farmer" value={terms.sumInsured} onChange={set("sumInsured")}
              unit="RWF" step={5000} min={5000} max={1_000_000} hint="Paid in full when the index reaches the exit" />
            <Field id="loading" label="Loading" value={Math.round(terms.loading * 100)} onChange={(v) => set("loading")(v / 100)}
              unit="%" step={5} min={0} max={200} hint="Added to the fair premium" />
            <Field id="subsidy" label="Government subsidy" value={Math.round(terms.subsidy * 100)} onChange={(v) => set("subsidy")(v / 100)}
              unit="%" step={5} min={0} max={100} hint="Share of the premium the farmer does not pay" />
            <Field id="farmers" label="Farmers per district" value={terms.farmers} onChange={set("farmers")}
              unit="farmers" step={1000} min={100} max={1_000_000} hint={`${(terms.farmers * 7).toLocaleString("en-US")} farmers in total`} />
          </div>
        </Card>

        <StatStrip
          items={[
            { value: rwf(avgFarmer), label: "A farmer pays per season", note: `average of 7 districts, after ${pct(terms.subsidy)} subsidy` },
            { value: rwfShort(premiumTotal), label: "Premiums collected per season", note: `${rwf(premiumTotal)}, all districts, before subsidy` },
            { value: rwfShort(expectedPayouts), label: "Expected payouts per season", note: `${rwf(expectedPayouts)}, average over ${n} seasons` },
            { value: rwfShort(worst.payouts), label: `Worst season: ${worst.season}`, note: `${worst.districtsPaid} of 7 districts paid · ${Math.round(worst.lossRatio * 100)}% of premiums` },
          ]}
        />

        <Card
          label={`Premium by district · priced on ${n} seasons (2001–2025)`}
          title={`${dearest.district} costs most to insure (${pct(dearest.rate, 1)} of the cover); ${cheapest.district} least (${pct(cheapest.rate, 1)})`}
          source={`Fair premium = average payout share over every season since 2001 × the sum insured (burning-cost pricing). Payouts use the ${model.data.model} index (leave-one-out for the seasons with harvest data, as on every other page) with the ${model.data.trigger}% trigger and ${model.data.exit}% exit.`}
        >
          <div className="-mx-2 overflow-x-auto">
            <table className="tabular w-full min-w-[680px] text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="px-2 pb-2 font-medium">District</th>
                  <th className="px-2 pb-2 font-medium">Seasons with a payout</th>
                  <th className="px-2 pb-2 text-right font-medium">Average payout</th>
                  <th className="px-2 pb-2 text-right font-medium">Fair premium</th>
                  <th className="px-2 pb-2 text-right font-medium">With loading</th>
                  <th className="px-2 pb-2 text-right font-medium">Farmer pays</th>
                  <th className="px-2 pb-2 text-right font-medium">Worst season</th>
                </tr>
              </thead>
              <tbody>
                {byCost.map((p) => (
                  <tr key={p.district} className="border-t border-line">
                    <td className="px-2 py-2.5 font-medium">{p.district}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <DotCount filled={p.paidSeasons} total={p.seasons} color="var(--sev-severe)" />
                        <span className="text-xs text-muted">{p.paidSeasons}/{p.seasons}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right">{pct(p.expectedPayout, 1)}</td>
                    <td className="px-2 py-2.5 text-right">{rwf(p.fairPremium)}</td>
                    <td className="px-2 py-2.5 text-right">{rwf(p.premium)}</td>
                    <td className="px-2 py-2.5 text-right font-semibold">{rwf(p.farmerPays)}</td>
                    <td className="px-2 py-2.5 text-right text-muted">{p.worst.season} · {pct(p.worst.payout)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          label="The insurer's books, season by season"
          title={
            losing.length
              ? `Payouts would have exceeded premiums in ${losing.length} of ${n} seasons; the worst, ${worst.season}, cost ${Math.round(worst.lossRatio * 100)}% of a year's premiums`
              : `Premiums would have covered payouts in every one of the ${n} seasons`
          }
          source="Loss ratio = the season's payouts ÷ the premiums collected that season (before subsidy). Priced on the same seasons it is tested on, so this shows how payouts swing from year to year, not how a new season would turn out."
        >
          <LossRatioChart data={books} />
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--sev-severe)" }} /> Payouts above premiums ({losing.length})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--other)" }} /> Premiums cover payouts ({n - losing.length})
            </span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Premium Pricing" />
      {body}
    </>
  );
}
