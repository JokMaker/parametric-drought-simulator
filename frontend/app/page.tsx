"use client";

import Link from "next/link";
import InfluenceChart from "@/components/charts/InfluenceChart";
import StatCard from "@/components/StatCard";
import { Card, ErrorNote, Loading, PageHeader } from "@/components/ui";
import ValidationTable from "@/components/ValidationTable";
import { getModel } from "@/lib/api";
import { pct } from "@/lib/payout";
import { useApi } from "@/lib/useApi";

export default function Overview() {
  const { data: m, error } = useApi("model", getModel);

  return (
    <>
      <PageHeader title="Overview">
        This tool simulates a drought insurance index for Season A maize in Eastern Rwanda&apos;s
        seven districts. It combines satellite rainfall (CHIRPS) and vegetation (MODIS NDVI) into
        a predicted yield change. When that prediction falls below the trigger, a payout begins,
        rising to the full payout at the exit. Every payout comes with the reason for it, and the
        gap between what the index pays and what farmers actually lost is reported openly.
      </PageHeader>

      {error ? (
        <ErrorNote message={error} />
      ) : !m ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Selected model" value={m.model} hint="Lowest leave-one-out error" />
            <StatCard label="Trigger" value={`${m.trigger}%`} hint="Payout starts below this" />
            <StatCard label="Exit" value={`${m.exit}%`} hint="Full payout at or below this" />
            <StatCard
              label="Hit rate"
              value={pct(m.hitRate)}
              hint={`Paid in seasons with yield ${m.lowYieldThreshold}% or worse`}
            />
            <StatCard
              label="False payout rate"
              value={pct(m.falsePayoutRate)}
              hint="Paid in the other seasons"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <Card title="How well the models predict yield">
              <ValidationTable rows={m.validation} selected={m.model} />
              <p className="mt-4 text-xs leading-5 text-muted">
                Leave-one-out holds back one district-season at a time; there Ridge explains about
                half the variation in yield. Leave-one-season-out holds back a whole year, which is
                closer to predicting a season the model has never seen. There every model has a
                negative R², meaning its predictions miss by more than the spread of the actual
                yields, although Ridge still beats the baseline. With only three years of yield
                data, the index is not yet reliable for a year unlike those it was calibrated on.
              </p>
            </Card>
            <Card title="What influences the index">
              <InfluenceChart rain={m.coefficients.rain_z} ndvi={m.coefficients.ndvi_z} />
            </Card>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href="/explorer?district=Rwamagana&season=2023"
              className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:opacity-90"
            >
              Open the District Explorer
            </Link>
            <Link href="/history" className="rounded-md border border-line bg-surface px-4 py-2 hover:border-ink/30">
              See drought history
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
