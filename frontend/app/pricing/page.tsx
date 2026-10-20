"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import LossRatioChart from "@/components/charts/LossRatioChart";
import { Card, ErrorNote, Loading, PageHeader, StatStrip } from "@/components/ui";
import { getHistory, getModel, getSeasons } from "@/lib/api";
import { pct } from "@/lib/payout";
import { defaultTerms, oneInTen, payoutHistory, priceDistricts, rwf, rwfShort, seasonBooks, type Terms } from "@/lib/pricing";
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

const share = (v: number) => Math.round(v * 100);

export default function PricingPage() {
  const history = useApi("history", getHistory);
  const model = useApi("model", getModel);
  const calibration = useApi("seasons", getSeasons);
  // Until the user edits a term, the defaults come from the model and the surveys.
  const [edited, setEdited] = useState<Terms | null>(null);
  const error = history.error ?? model.error ?? calibration.error;

  let body;
  if (error) body = <ErrorNote message={error} />;
  else if (!history.data || !model.data || !calibration.data) body = <Loading />;
  else {
    const m = model.data;
    const inputs = m.pricingInputs;
    const terms = edited ?? defaultTerms(m);
    const set = (k: keyof Terms) => (v: number) => setEdited({ ...terms, [k]: v });
    const record = payoutHistory(history.data, calibration.data);
    const prices = priceDistricts(record, m, terms);
    const books = seasonBooks(record, prices);
    const n = books.length;
    const premiums = books[0].premiums;
    const expected = books.reduce((s, b) => s + b.payouts, 0) / n;
    const tenth = oneInTen(books);
    const worst = books.reduce((a, b) => (b.payouts > a.payouts ? b : a));
    const losing = books.filter((b) => b.lossRatio > 1);
    const insuredHa = prices.reduce((s, p) => s + p.insuredHa, 0);
    const totalHa = Object.values(inputs.maizeAreaHa).reduce((s, v) => s + v, 0);
    const farm = inputs.farmSizeHa.p50;
    const avgFarmerPerHa = prices.reduce((s, p) => s + p.farmerPays * p.insuredHa, 0) / insuredHa;
    const byCost = [...prices].sort((a, b) => b.farmerPays - a.farmerPays);
    const years = Object.entries(inputs.priceByYear).map(([y, v]) => `${y}: ${Math.round(v)}`).join(", ");

    body = (
      <div className="space-y-5">
        <Card
          label="Contract terms"
          title="Cover is priced from what the maize is worth: area × expected yield × price"
          action={
            edited && (
              <button
                onClick={() => setEdited(null)}
                className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1 text-sm text-muted hover:bg-surface-2 hover:text-ink"
              >
                <RotateCcw size={14} /> Reset
              </button>
            )
          }
          source={`Maize price: the farm-gate selling price in the NISR surveys (question 2.27), median of ${years} RWF/kg. Expected yield: each district's trend-adjusted yield for Season A ${inputs.season}. Maize area: survey-weighted smallholder maize area, Season A ${inputs.season}. The cover level defaults to the ${m.exit}% exit, so a full payout matches a ${Math.abs(m.exit)}% loss instead of the whole crop. Loading and subsidy are the insurer's and government's choices.`}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field id="price" label="Maize price" value={terms.price} onChange={set("price")}
              unit="RWF/kg" step={10} min={50} max={1500} hint={`Survey median RWF ${Math.round(inputs.maizePriceRwfKg)}/kg`} />
            <Field id="cover" label="Cover level" value={share(terms.coverLevel)} onChange={(v) => set("coverLevel")(v / 100)}
              unit="% of value" step={1} min={5} max={100} hint={`Default: the ${m.exit}% exit`} />
            <Field id="loading" label="Loading" value={share(terms.loading)} onChange={(v) => set("loading")(v / 100)}
              unit="%" step={5} min={0} max={200} hint="Costs, reinsurance, margin" />
            <Field id="subsidy" label="Government subsidy" value={share(terms.subsidy)} onChange={(v) => set("subsidy")(v / 100)}
              unit="%" step={5} min={0} max={100} hint="Share of premium not paid by farmers" />
            <Field id="uptake" label="Maize area insured" value={share(terms.uptake)} onChange={(v) => set("uptake")(v / 100)}
              unit="%" step={5} min={1} max={100} hint={`${Math.round(insuredHa).toLocaleString("en-US")} of ${Math.round(totalHa).toLocaleString("en-US")} ha`} />
          </div>
        </Card>

        <StatStrip
          items={[
            { value: rwf(avgFarmerPerHa * farm), label: `A median farm (${Math.round(farm * 10_000)} m²) pays per season`, note: `${rwf(avgFarmerPerHa)} per hectare, after ${pct(terms.subsidy)} subsidy` },
            { value: rwfShort(premiums), label: "Premiums collected per season", note: `expected payouts ${rwfShort(expected)} (average of ${n} seasons)` },
            { value: rwfShort(tenth), label: "Payouts in a 1-in-10 season", note: `${Math.round((tenth / premiums) * 100)}% of a season's premiums` },
            { value: rwfShort(Math.max(0, worst.payouts - premiums)), label: "Reserve needed for the worst season", note: `${worst.season}: payouts ${rwfShort(worst.payouts)}, ${worst.districtsPaid} of 7 districts paid` },
          ]}
        />

        <Card
          label={`Premium by district · priced on ${n} seasons (2001–2025)`}
          title={`A hectare of maize costs a farmer ${rwf(byCost[0].farmerPays)} a season to insure in ${byCost[0].district}, ${rwf(byCost[byCost.length - 1].farmerPays)} in ${byCost[byCost.length - 1].district}`}
          source={`Fair premium = the cover × the average payout share over every season since 2001 (burning-cost pricing). Payouts use the ${m.model} index (leave-one-out for the seasons with harvest data, as on every other page) with the ${m.trigger}% trigger and ${m.exit}% exit. Farmer prices are after subsidy.`}
        >
          <div className="-mx-2 overflow-x-auto">
            <table className="tabular w-full min-w-[760px] whitespace-nowrap text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="px-2 pb-2 font-medium">District</th>
                  <th className="px-2 pb-2 text-right font-medium">Expected yield</th>
                  <th className="px-2 pb-2 text-right font-medium">Crop value / ha</th>
                  <th className="px-2 pb-2 text-right font-medium">Cover / ha</th>
                  <th className="px-2 pb-2 font-medium">Seasons with a payout</th>
                  <th className="px-2 pb-2 text-right font-medium">Farmer pays / ha</th>
                  <th className="px-2 pb-2 text-right font-medium">Median farm pays</th>
                </tr>
              </thead>
              <tbody>
                {byCost.map((p) => (
                  <tr key={p.district} className="border-t border-line">
                    <td className="px-2 py-2.5 font-medium">{p.district}</td>
                    <td className="px-2 py-2.5 text-right">{Math.round(p.yieldKg).toLocaleString("en-US")} kg</td>
                    <td className="px-2 py-2.5 text-right">{rwf(p.value)}</td>
                    <td className="px-2 py-2.5 text-right">{rwf(p.cover)}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 bg-surface-2" aria-hidden>
                          <div className="h-full" style={{ width: `${(p.paidSeasons / p.seasons) * 100}%`, background: "var(--sev-severe)" }} />
                        </div>
                        <span className="text-xs text-muted">{p.paidSeasons} of {p.seasons}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold">{rwf(p.farmerPays)}</td>
                    <td className="px-2 py-2.5 text-right">{rwf(p.farmerPays * farm)}</td>
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
              ? `Payouts would have exceeded premiums in ${losing.length} of ${n} seasons; the worst, ${worst.season}, cost ${Math.round(worst.lossRatio * 100)}% of a season's premiums`
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
