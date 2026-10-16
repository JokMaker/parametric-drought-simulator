"use client";

import IndexVsActualChart from "@/components/charts/IndexVsActualChart";
import InfluenceChart from "@/components/charts/InfluenceChart";
import MiniDroughtMap from "@/components/MiniDroughtMap";
import { Card, ErrorNote, Loading, PageHeader, StatStrip } from "@/components/ui";
import ValidationTable from "@/components/ValidationTable";
import { getHistory, getModel, getSeasons } from "@/lib/api";
import { classify, pct } from "@/lib/payout";
import { useApi } from "@/lib/useApi";

export default function Overview() {
  const model = useApi("model", getModel);
  const seasons = useApi("seasons", getSeasons);
  const history = useApi("history", getHistory);
  const error = model.error ?? seasons.error ?? history.error;
  const m = model.data;

  let body;
  if (error) body = <ErrorNote message={error} />;
  else if (!m || !seasons.data || !history.data) body = <Loading />;
  else {
    const outcomes = seasons.data.map((s) => classify(s, m));
    const right = outcomes.filter((o) => o === "hit" || o === "correct-no-payout").length;
    const poor = outcomes.filter((o) => o === "hit" || o === "miss").length;
    const hits = outcomes.filter((o) => o === "hit").length;
    const normal = outcomes.length - poor;
    const falsePay = outcomes.filter((o) => o === "false-payout").length;
    const share = (pts: typeof history.data) => pts.filter((p) => p.pays).length / pts.length;
    const drought = history.data.filter((p) => p.droughtYear);
    const other = history.data.filter((p) => !p.droughtYear);
    const ratio = share(drought) / share(other);

    const rain = Math.abs(m.coefficients.rain_z);
    const ndvi = Math.abs(m.coefficients.ndvi_z);
    const rainShare = rain / (rain + ndvi);
    const r2 = (scheme: string) => m.validation.find((v) => v.scheme === scheme && v.model === m.model)?.r2 ?? 0;

    body = (
      <div className="space-y-5">
        <StatStrip
          items={[
            { value: pct(right / outcomes.length), label: "Pay / no-pay decisions correct", note: `${right} of ${outcomes.length} district-seasons` },
            { value: pct(hits / poor), label: "Poor harvests that were paid", note: `${hits} of ${poor}` },
            { value: pct(falsePay / normal), label: "False payouts in normal seasons", note: `${falsePay} of ${normal}` },
            { value: `${ratio.toFixed(1)}×`, label: "More payouts in documented droughts", note: `${pct(share(drought))} against ${pct(share(other))}` },
          ]}
        />

        <MiniDroughtMap />

        <Card
          label="Index against real harvests · 2022–2025"
          title={`The pay or no-pay decision matched the harvest in ${right} of ${outcomes.length} district-seasons`}
          source="Each dot is one district-season: NISR harvest survey against the leave-one-out index. Dots in the shaded band triggered a payout."
        >
          <IndexVsActualChart seasons={seasons.data} model={m} />
        </Card>

        <Card
          label="What drives the index"
          title={`Rainfall carries ${pct(rainShare)} of the index's weight; crop greenness ${pct(1 - rainShare)}`}
          source={`${m.model} regression on standardised October–December rainfall (CHIRPS) and greenness (MODIS NDVI).`}
        >
          <InfluenceChart rain={m.coefficients.rain_z} ndvi={m.coefficients.ndvi_z} />
        </Card>

        <Card
          label="How reliable the model is"
          title={`${m.model} explains ${pct(r2("Leave-one-out"))} of yield variation in unseen district-seasons, but only ${pct(Math.max(0, r2("Leave-one-season-out")))} for an unseen year`}
          source="Held-out errors. Leave-one-out hides one district-season at a time; leave-one-season-out hides a whole year. R² below zero is worse than guessing the average."
        >
          <ValidationTable rows={m.validation} selected={m.model} />
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Drought index insurance for Eastern Rwanda">
        Satellite rainfall and crop greenness predict each district&apos;s maize harvest.
        {m && ` A payout starts at a ${m.trigger}% predicted yield change and is full at ${m.exit}%.`}
      </PageHeader>
      {body}
    </>
  );
}
