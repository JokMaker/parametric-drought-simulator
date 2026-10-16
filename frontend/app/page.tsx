"use client";

import IndexVsActualChart from "@/components/charts/IndexVsActualChart";
import InfluenceChart from "@/components/charts/InfluenceChart";
import StoryTour from "@/components/StoryTour";
import HowItWorks from "@/components/HowItWorks";
import { Card, DotCount, ErrorNote, Loading, PageHeader, ShareBars, StatStrip } from "@/components/ui";
import ValidationTable from "@/components/ValidationTable";
import { getHistory, getModel, getSeasons } from "@/lib/api";
import { classify, pct } from "@/lib/payout";
import { YIELD_RANGE } from "@/lib/constants";
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
            {
              value: pct(right / outcomes.length),
              label: "Right pay / no-pay decisions",
              viz: <DotCount filled={right} total={outcomes.length} />,
              note: `${right} of ${outcomes.length} district-seasons`,
            },
            {
              value: pct(hits / poor),
              label: "Poor harvests paid",
              viz: <DotCount filled={hits} total={poor} color="var(--sev-extreme)" />,
              note: `${hits} of ${poor}`,
            },
            {
              value: pct(falsePay / normal),
              label: "False payouts",
              viz: <DotCount filled={falsePay} total={normal} color="var(--risk-4)" />,
              note: `${falsePay} of ${normal} normal seasons`,
            },
            {
              value: `${ratio.toFixed(1)}×`,
              label: "Payouts in droughts vs other years",
              viz: (
                <ShareBars
                  rows={[
                    { label: "Drought", share: share(drought), color: "var(--drought)" },
                    { label: "Other", share: share(other), color: "var(--faint)" },
                  ]}
                />
              ),
            },
          ]}
        />

        <StoryTour />

        <Card
          label={`Index against real harvests · ${YIELD_RANGE}`}
          title={`The pay or no-pay decision matched the harvest in ${right} of ${outcomes.length} district-seasons`}
          source="NISR Seasonal Agricultural Survey yields against the leave-one-out index (each district-season predicted by a model that never saw it). The shaded band is the payout zone."
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
      <PageHeader title="Drought index insurance for Eastern Rwanda" />
      {m && (
        <div className="mb-5">
          <HowItWorks trigger={m.trigger} exit={m.exit} />
        </div>
      )}
      {body}
    </>
  );
}
