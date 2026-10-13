"use client";

import {
  ArrowRight,
  Banknote,
  CircleAlert,
  CloudRain,
  Crosshair,
  Sigma,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import IndexVsActualChart from "@/components/charts/IndexVsActualChart";
import InfluenceChart from "@/components/charts/InfluenceChart";
import MiniDroughtMap from "@/components/MiniDroughtMap";
import StatCard from "@/components/StatCard";
import { Card, ErrorNote, Loading, PageHeader } from "@/components/ui";
import ValidationTable from "@/components/ValidationTable";
import { getModel, getSeasons } from "@/lib/api";
import { pct } from "@/lib/payout";
import { useApi } from "@/lib/useApi";

function Step({ n, icon: Icon, title, children }: { n: number; icon: LucideIcon; title: string; children: string }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon size={18} />
      </span>
      <div>
        <div className="text-xs text-faint">Step {n}</div>
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-1 text-xs leading-5 text-muted">{children}</p>
      </div>
    </div>
  );
}

const DEMOS = [
  {
    href: "/explorer?district=Rwamagana&season=2023",
    title: "A good catch",
    detail: "Rwamagana 2023: a dry season, the index pays 100% and the harvest fell 26%.",
    dot: "bg-good",
  },
  {
    href: "/explorer?district=Gatsibo&season=2022",
    title: "A missed season",
    detail: "Gatsibo 2022: the harvest fell 16%, but rainfall looked normal and the index paid nothing.",
    dot: "bg-drought",
  },
  {
    href: "/history",
    title: "The drought-year check",
    detail: "Payouts in 68% of documented drought seasons against 38% of other years.",
    dot: "bg-other",
  },
];

export default function Overview() {
  const { data: m, error } = useApi("model", getModel);
  const seasons = useApi("seasons", getSeasons);

  return (
    <>
      <PageHeader
        eyebrow="Eastern Province · Season A maize"
        title="Drought index insurance simulator"
        actions={
          <>
            <Link
              href="/explorer"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
            >
              Open District Explorer <ArrowRight size={15} />
            </Link>
            <Link
              href="/history"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm hover:bg-surface-2"
            >
              Drought history
            </Link>
          </>
        }
      >
        Satellite rainfall and vegetation data, calibrated against district maize yields, decide
        when a payout starts and how large it is. Every payout comes with its reason, and the gap
        between what the index pays and what farmers actually lost is reported openly.
      </PageHeader>

      {error ? (
        <ErrorNote message={error} />
      ) : !m ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
            <MiniDroughtMap />
            <Card
              title="How well the index tracks real harvests"
              description={`Each dot is one district-season with harvest data (${seasons.data?.length ?? 28} in all). Dots below the dashed line triggered a payout; dots left of the red line had a poor harvest.`}
            >
              {seasons.data ? <IndexVsActualChart seasons={seasons.data} model={m} /> : <Loading rows={1} />}
            </Card>
          </div>

          <section className="card grid gap-6 p-6 md:grid-cols-3">
            <Step n={1} icon={CloudRain} title="Read the satellites">
              October–December rainfall (CHIRPS) and vegetation greenness (MODIS NDVI) for each
              district, compared with its own long-term average.
            </Step>
            <Step n={2} icon={TrendingDown} title="Predict the yield change">
              {`A ${m.model} model trained on 28 district-seasons (2022–2025) turns the two anomalies into a predicted change in maize yield.`}
            </Step>
            <Step n={3} icon={Banknote} title="Set the payout">
              {`Below the ${m.trigger}% trigger a payout starts, rising in a straight line to the full payout at ${m.exit}%.`}
            </Step>
          </section>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Selected model" value={m.model} hint="Best on unseen years" icon={Sigma} />
            <StatCard label="Trigger" value={`${m.trigger}%`} hint="Payout starts below this" icon={TrendingDown} />
            <StatCard label="Exit" value={`${m.exit}%`} hint="Full payout at or below this" icon={Banknote} />
            <StatCard
              label="Hit rate"
              value={pct(m.hitRate)}
              hint={`Paid in seasons with yield ${m.lowYieldThreshold}% or worse`}
              icon={Crosshair}
            />
            <StatCard
              label="False payout rate"
              value={pct(m.falsePayoutRate)}
              hint="Paid in the other seasons"
              icon={CircleAlert}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <Card
              title="How well the models predict yield"
              description="Held-out prediction error. Lower RMSE and MAE are better; R² below zero is worse than predicting the average."
            >
              <ValidationTable rows={m.validation} selected={m.model} />
              <p className="mt-5 rounded-lg bg-surface-2 p-3 text-xs leading-5 text-muted">
                Leave-one-out holds back one district-season at a time; there Ridge and Lasso are
                tied, each explaining about half the variation in yield. Leave-one-season-out holds
                back a whole year, closer to predicting a season the model has never seen. There
                Ridge is the only model that clearly beats the baseline, which is why it is
                selected. With four years of yield data, predictions for an unseen year are still
                much weaker than for an unseen district-season.
              </p>
            </Card>
            <div className="space-y-6">
              <Card title="What influences the index" description="Share of the model's weight on each input.">
                <InfluenceChart rain={m.coefficients.rain_z} ndvi={m.coefficients.ndvi_z} />
              </Card>
              <Card title="Start here">
                <ul className="-mx-2 space-y-1">
                  {DEMOS.map((d) => (
                    <li key={d.title}>
                      <Link href={d.href} className="group flex items-start gap-3 rounded-lg p-2 hover:bg-surface-2">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${d.dot}`} />
                        <span className="flex-1">
                          <span className="block text-sm font-medium">{d.title}</span>
                          <span className="block text-xs leading-5 text-muted">{d.detail}</span>
                        </span>
                        <ArrowRight size={15} className="mt-1 text-faint group-hover:text-ink" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
