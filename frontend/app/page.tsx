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
import InfluenceChart from "@/components/charts/InfluenceChart";
import StatCard from "@/components/StatCard";
import { Card, ErrorNote, Loading, PageHeader } from "@/components/ui";
import ValidationTable from "@/components/ValidationTable";
import { getModel } from "@/lib/api";
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
    detail: "Rwamagana 2023: dry season, 84% payout, harvest fell 22%.",
    dot: "bg-good",
  },
  {
    href: "/explorer?district=Kirehe&season=2022",
    title: "The big miss",
    detail: "Kirehe 2022: rainfall looked normal, harvest fell 41%, no payout.",
    dot: "bg-drought",
  },
  {
    href: "/history",
    title: "The drought-year check",
    detail: "Payouts in 67% of documented drought seasons against 35% of other years.",
    dot: "bg-other",
  },
];

export default function Overview() {
  const { data: m, error } = useApi("model", getModel);

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
          <section className="card grid gap-6 p-6 md:grid-cols-3">
            <Step n={1} icon={CloudRain} title="Read the satellites">
              October–December rainfall (CHIRPS) and vegetation greenness (MODIS NDVI) for each
              district, compared with its own long-term average.
            </Step>
            <Step n={2} icon={TrendingDown} title="Predict the yield change">
              {`A ${m.model} model trained on 21 district-seasons turns the two anomalies into a predicted change in maize yield.`}
            </Step>
            <Step n={3} icon={Banknote} title="Set the payout">
              {`Below the ${m.trigger}% trigger a payout starts, rising in a straight line to the full payout at ${m.exit}%.`}
            </Step>
          </section>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Selected model" value={m.model} hint="Lowest leave-one-out error" icon={Sigma} />
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
                Leave-one-out holds back one district-season at a time; there Ridge explains about
                half the variation in yield. Leave-one-season-out holds back a whole year, closer to
                predicting a season the model has never seen. There every model has a negative R²,
                although Ridge still beats the baseline. With only three years of yield data, the
                index is not yet reliable for a year unlike those it was calibrated on.
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
