"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { ErrorNote, Loading } from "@/components/ui";
import { getBasisRisk, getHistory, getModel, getSeasons } from "@/lib/api";
import { DISTRICTS } from "@/lib/constants";
import { classify, modelError, pct, signedPct } from "@/lib/payout";
import { defaultTerms, expectedPayout, payoutHistory, perHectare, rwf } from "@/lib/pricing";
import { DEFAULT_RULE } from "@/lib/fieldChecks";
import { useApi } from "@/lib/useApi";

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <tr className="border-t border-line align-top">
      <th className="w-52 py-2 pr-4 text-left text-sm font-medium text-muted">{k}</th>
      <td className="py-2 text-sm">{children}</td>
    </tr>
  );
}

/** One page per district that an insurer, a regulator or a cooperative could read and sign. */
export default function TermSheetPage() {
  const model = useApi("model", getModel);
  const history = useApi("history", getHistory);
  const seasons = useApi("seasons", getSeasons);
  const risk = useApi("basis-risk", getBasisRisk);
  const [district, setDistrict] = useState<string>("Rwamagana");
  const error = model.error ?? history.error ?? seasons.error ?? risk.error;

  if (error) return <ErrorNote message={error} />;
  if (!model.data || !history.data || !seasons.data || !risk.data) return <Loading />;

  const m = model.data;
  const inputs = m.pricingInputs;
  const terms = defaultTerms(m);
  const record = payoutHistory(history.data, seasons.data).filter((p) => p.district === district);
  const rate = expectedPayout(record, district);
  const ha = perHectare(district, m, terms, rate);
  const paid = record.filter((p) => p.payout > 0);
  const worst = record.reduce((a, b) => (b.payout > a.payout ? b : a));
  const basis = risk.data.find((r) => r.district === district)?.basisRisk ?? 0;
  const outcomes = seasons.data.map((s) => classify(s, m));
  const accuracy = outcomes.filter((o) => o === "hit" || o === "correct-no-payout").length / outcomes.length;
  const [bRain, bNdvi] = [m.coefficients.rain_z, m.coefficients.ndvi_z];
  const schedule = [0, -5, -10, -15, -20, Math.round(m.exit), -30].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b - a);
  const payoutAt = (idx: number) => Math.min(1, Math.max(0, (m.trigger - idx) / (m.trigger - m.exit)));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <label className="text-sm text-muted">
          District{" "}
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="ml-1 rounded-sm border border-line bg-surface px-2 py-1 text-sm text-ink"
          >
            {DISTRICTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-surface"
        >
          <Download size={15} /> Download PDF
        </button>
      </div>

      <article className="card px-8 py-7 print:border-0 print:p-0">
        <header className="border-b-2 border-ink pb-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Term sheet · illustrative, not a binding contract</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Drought index cover for Season A maize, {district} District</h1>
          <p className="mt-1 text-sm text-muted">
            Eastern Province, Rwanda · season covered: Season A {inputs.season + 2} (rains October–December {inputs.season + 1})
          </p>
        </header>

        <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide">1. Cover</h2>
        <table className="tabular mt-1 w-full">
          <tbody>
            <Row k="Insured crop">Maize grown by smallholders in {district}, Season A</Row>
            <Row k="Value of the crop">
              {rwf(ha.value)} per hectare: expected yield {Math.round(ha.yieldKg).toLocaleString("en-US")} kg/ha × RWF {Math.round(terms.price)}/kg
            </Row>
            <Row k="Sum insured">{rwf(ha.cover)} per hectare ({pct(terms.coverLevel)} of the crop&apos;s value), in proportion to the maize area insured</Row>
            <Row k="Premium">
              {rwf(ha.premium)} per hectare, of which the farmer pays {rwf(ha.farmerPays)} and the government {rwf(ha.premium - ha.farmerPays)} ({pct(terms.subsidy)} subsidy).
              For a typical {Math.round(inputs.farmSizeHa.p50 * 10_000)} m² maize plot the farmer pays {rwf(ha.farmerPays * inputs.farmSizeHa.p50)}.
            </Row>
          </tbody>
        </table>

        <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide">2. The index</h2>
        <table className="tabular mt-1 w-full">
          <tbody>
            <Row k="Measured">Predicted change in {district}&apos;s maize yield from the expected level, in %</Row>
            <Row k="Inputs">
              October–December rainfall total (CHIRPS) and mean crop greenness (MODIS MOD13Q1 NDVI) over cropland in {district},
              each as a z-score against the district&apos;s own record
            </Row>
            <Row k="Formula">
              Index = {bRain.toFixed(2)} × rain + {bNdvi.toFixed(2)} × greenness, in percentage points per standard deviation
              ({m.model} regression fitted on {seasons.data.length} district-seasons with harvest data, 2018–2025)
            </Row>
            <Row k="Accuracy">
              Typical error ± {modelError(m).toFixed(0)} points on a district-season the model has not seen; the payout decision matched the
              harvest in {pct(accuracy)} of the {outcomes.length} district-seasons with harvest data. Basis risk in {district}: {pct(basis)}.
            </Row>
          </tbody>
        </table>

        <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide">3. Payout</h2>
        <p className="mt-1 text-sm">
          Nothing is paid while the index is above the trigger of {m.trigger}%. Below it, the payout rises in a straight line to the full
          sum insured at the exit of {m.exit}%.
        </p>
        <table className="tabular mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1.5 font-medium">Index</th>
              <th className="py-1.5 text-right font-medium">Share of sum insured</th>
              <th className="py-1.5 text-right font-medium">Per hectare</th>
              <th className="py-1.5 text-right font-medium">Typical plot</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((idx) => (
              <tr key={idx} className="border-t border-line">
                <td className="py-1.5">{signedPct(idx, 0)}</td>
                <td className="py-1.5 text-right">{pct(payoutAt(idx))}</td>
                <td className="py-1.5 text-right">{rwf(payoutAt(idx) * ha.cover)}</td>
                <td className="py-1.5 text-right">{rwf(payoutAt(idx) * ha.cover * inputs.farmSizeHa.p50)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide">4. Settlement</h2>
        <table className="tabular mt-1 w-full">
          <tbody>
            <Row k="Data">Final CHIRPS and MODIS MOD13Q1 data for 1 October – 31 December, published 3–6 weeks after the window closes</Row>
            <Row k="Calculation">The index is calculated for the district as a whole; every insured farmer in {district} receives the same share</Row>
            <Row k="Payment">To the farmer&apos;s mobile money account, with an SMS stating the index and the amount</Row>
            <Row k="Monitoring">A provisional index from near-real-time data is published during the window; it is not used to settle</Row>
            <Row k="Field check">
              If the index pays less than {pct(DEFAULT_RULE.paidEnough)} but farmers report losses or the NISR survey shows widespread crop failure, the insurer sends
              a field team to assess the district (losses the satellites cannot see, such as Season A 2019)
            </Row>
          </tbody>
        </table>

        <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide">5. Record, 2001–2025</h2>
        <p className="mt-1 text-sm">
          Applied to every season since 2001, the index would have paid in {district} in {paid.length} of {record.length} seasons, an
          average payout of {pct(rate, 1)} of the sum insured a season. The largest was {pct(worst.payout)} in Season A {worst.windowYear + 1}.
        </p>

        <footer className="mt-6 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
          Prepared from the Rwanda Drought Index simulator (BSc capstone, African Leadership University). Price, yields and areas from the
          NISR Seasonal Agricultural Survey; satellite data via Google Earth Engine. Loading {pct(terms.loading)} and subsidy {pct(terms.subsidy)} are
          illustrative. Figures are a simulation for research and teaching, not an offer of insurance.
        </footer>
      </article>
    </div>
  );
}
