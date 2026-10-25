"use client";

import { CheckCircle2, MessageSquareText, Search } from "lucide-react";
import { useState } from "react";
import SeasonTimeline from "@/components/SeasonTimeline";
import { Card, ErrorNote, Loading, PageHeader } from "@/components/ui";
import Link from "next/link";
import { getHistory, getModel, getSeasons, reportLoss, USE_MOCK } from "@/lib/api";
import { districtsInSeason, type DistrictSeason } from "@/lib/districtSeason";
import { pct } from "@/lib/payout";
import { DEMO_POLICIES, findPolicy, type Policy } from "@/lib/policies";
import { defaultTerms, expectedPayout, payoutHistory, perHectare, rwf } from "@/lib/pricing";
import { useApi } from "@/lib/useApi";

type Lang = "en" | "rw";

const word = (z: number) => (z <= -0.5 ? "below normal" : z >= 0.5 ? "above normal" : "about normal");

/** The message a farmer would receive when the season's result is published. */
function smsText(lang: Lang, p: Policy, v: DistrictSeason, amount: number) {
  const money = rwf(amount);
  if (lang === "rw") {
    return v.payout > 0
      ? `RDI: Ubwishingizi bw'ibigori, ${p.district}, Igihembwe A ${v.season}. Ibyogajuru byerekanye ko imyaka yahuye n'izuba. Uzahabwa ingurane ya ${money} kuri MoMo ${p.phone}. Ibibazo: kanda *xxx#`
      : `RDI: Ubwishingizi bw'ibigori, ${p.district}, Igihembwe A ${v.season}. Ibipimo by'ibyogajuru byari mu rugero, nta ngurane muri iki gihembwe. Niba umusaruro wawe warangiritse, kanda *xxx# ubimenyeshe.`;
  }
  return v.payout > 0
    ? `RDI maize cover, ${p.district}, Season A ${v.season}: satellites showed crops under drought stress. You will receive ${money} on MoMo ${p.phone}. Questions: dial *xxx#`
    : `RDI maize cover, ${p.district}, Season A ${v.season}: satellite readings were in the normal range, so there is no payout this season. If your harvest failed, dial *xxx# to report it.`;
}

function Phone({ text, lang, onLang }: { text: string; lang: Lang; onLang: (l: Lang) => void }) {
  return (
    <div className="mx-auto w-full max-w-[290px]">
      <div className="mb-2 flex justify-center gap-1 text-xs" role="group" aria-label="SMS language">
        {(["en", "rw"] as const).map((l) => (
          <button
            key={l}
            onClick={() => onLang(l)}
            aria-pressed={lang === l}
            className={`rounded-sm px-2.5 py-1 ${lang === l ? "bg-ink text-surface" : "text-muted hover:bg-surface-2"}`}
          >
            {l === "en" ? "English" : "Kinyarwanda"}
          </button>
        ))}
      </div>
      <div className="rounded-[28px] border-[6px] border-ink/85 bg-surface-2 p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between px-1 text-[10px] text-muted">
          <span>RDI Insurance</span>
          <span>SMS</span>
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-surface px-3 py-2.5 text-[13px] leading-snug shadow-sm">{text}</div>
        <div className="mt-2 px-1 text-[10px] text-faint">Delivered when the season&apos;s index is published</div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-sm bg-surface-2 px-3 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular text-xl font-semibold" style={tone ? { color: tone } : undefined}>{value}</div>
      {sub && <div className="tabular text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

const DEFAULT_POLICY = DEMO_POLICIES[12];

export default function FarmerPage() {
  const history = useApi("history", getHistory);
  const seasons = useApi("seasons", getSeasons);
  const model = useApi("model", getModel);
  const [query, setQuery] = useState(DEFAULT_POLICY.id);
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [areaM2, setAreaM2] = useState(DEFAULT_POLICY.areaM2);
  const [season, setSeason] = useState(2023);
  const [lang, setLang] = useState<Lang>("en");
  // The latest report sent, keyed by policy and season so it clears when either changes.
  const [reported, setReported] = useState<{ key: string; text: string; ok: boolean } | null>(null);
  const error = history.error ?? seasons.error ?? model.error;
  const notFound = query.trim() !== "" && !findPolicy(query);

  function lookUp(id: string) {
    setQuery(id);
    const p = findPolicy(id);
    if (p) {
      setPolicy(p);
      setAreaM2(p.areaM2);
      setReported(null);
    }
  }

  let body;
  if (error) body = <ErrorNote message={error} />;
  else if (!history.data || !seasons.data || !model.data) body = <Loading />;
  else {
    const m = model.data;
    const { trigger, exit } = m;
    const terms = defaultTerms(m);
    const record = payoutHistory(history.data, seasons.data);
    const v = districtsInSeason(history.data, seasons.data, season).get(policy.district)!;
    const ha = areaM2 / 10_000;
    const perHa = perHectare(policy.district, m, terms, expectedPayout(record, policy.district));
    const value = perHa.value * ha;
    const cover = perHa.cover * ha;
    const premium = perHa.farmerPays * ha;
    const amount = v.payout * cover;
    const paid = v.payout > 0;
    const reportKey = `${policy.id}:${season}`;
    const harvestFell = v.actualYieldAnom !== null && v.actualYieldAnom <= m.lowYieldThreshold;
    const sizes = m.pricingInputs.farmSizeHa;

    body = (
      <div className="space-y-5">
        <Card
          label={`Policy ${policy.id} · ${policy.district} · ${areaM2.toLocaleString("en-US")} m² of maize`}
          title={paid ? `Season A ${season}: you will be paid ${rwf(amount)}` : `Season A ${season}: no payout for ${policy.district} this season`}
          source={`Crop value = maize area × ${policy.district}'s expected yield (${Math.round(perHa.yieldKg).toLocaleString("en-US")} kg/ha, Season A ${m.pricingInputs.season} trend) × RWF ${Math.round(terms.price)}/kg (survey farm-gate price). Cover = ${Math.abs(exit)}% of the crop value, the loss at which the payout is full. Premium = cover × ${policy.district}'s average payout since 2001, plus a ${pct(terms.loading)} loading, less a ${pct(terms.subsidy)} subsidy. Every insured farmer in a district gets the same payout share: the index is per district, not per farm.`}
        >
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Tile label="Your maize is worth" value={rwf(value)} sub={`${Math.round(perHa.yieldKg * ha)} kg expected`} />
                <Tile label="Your cover" value={rwf(cover)} sub={`${Math.abs(exit)}% of the value`} />
                <Tile label="You pay per season" value={rwf(premium)} sub="after subsidy" />
                <Tile label="Payout this season" value={rwf(amount)} sub={`${pct(v.payout)} of cover · index ${v.index > 0 ? "+" : ""}${v.index.toFixed(1)}%`} tone={paid ? "var(--drought)" : undefined} />
              </div>

              <div>
                <h3 className="text-sm font-semibold">Why</h3>
                <p className="mt-1 text-sm text-muted">
                  From October to December, rainfall in {policy.district} was {word(v.rainZ)} and crop greenness was{" "}
                  {word(v.ndviZ)}. That points to a harvest {Math.abs(v.index).toFixed(0)}% {v.index < 0 ? "below" : "above"} what is
                  expected for the district,{" "}
                  {paid
                    ? v.payout >= 1
                      ? `past the ${exit}% level, so the full cover is paid.`
                      : `past the ${trigger}% trigger, so ${pct(v.payout)} of the cover is paid.`
                    : `which does not reach the ${trigger}% trigger.`}
                </p>
              </div>

              {!paid && (
                <div className="rounded-sm border border-line px-4 py-3">
                  <div className="text-sm font-semibold">Did your harvest fail anyway?</div>
                  <p className="mt-1 text-sm text-muted">
                    Satellites can miss losses from pests, disease or a dry spell on one hillside. Reports from farmers in
                    the same district are counted, and a district with many reports gets a field check.
                  </p>
                  {reported?.key === reportKey ? (
                    <p className={`mt-2 flex items-start gap-1.5 text-sm font-medium ${reported.ok ? "text-accent" : "text-drought"}`}>
                      {reported.ok && <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
                      <span>
                        {reported.text}{" "}
                        {reported.ok && <Link href="/field-checks" className="underline underline-offset-2">See field checks</Link>}
                      </span>
                    </p>
                  ) : (
                    <button
                      onClick={() =>
                        reportLoss(policy.id, policy.district, season).then(
                          (r) =>
                            setReported({
                              key: reportKey,
                              ok: true,
                              text: USE_MOCK
                                ? "Report noted (saved-results mode: not stored)."
                                : r.created
                                  ? `Report received: ${r.reports} ${r.reports === 1 ? "report" : "reports"} on file for ${policy.district}, Season A ${season}.`
                                  : `You have already reported this season; ${r.reports} on file for ${policy.district}.`,
                            }),
                          (e: Error) => setReported({ key: reportKey, ok: false, text: e.message }),
                        )
                      }
                      className="mt-2 rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-surface"
                    >
                      Report a crop loss
                    </button>
                  )}
                  {harvestFell && (
                    <p className="mt-2 text-xs text-muted">
                      The NISR survey later recorded a harvest {Math.abs(v.actualYieldAnom!).toFixed(0)}% below expected in{" "}
                      {policy.district} this season: a case for a field check.
                    </p>
                  )}
                </div>
              )}
            </div>

            <Phone text={smsText(lang, policy, v, amount)} lang={lang} onLang={setLang} />
          </div>
        </Card>

        <section className="card px-5 py-4 sm:px-6">
          <label htmlFor="area" className="text-sm font-medium">Your maize area</label>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <div className="flex w-40 items-center rounded-sm border border-line focus-within:border-accent">
              <input
                id="area"
                type="number"
                inputMode="numeric"
                min={50}
                max={50_000}
                step={50}
                value={areaM2}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) setAreaM2(Math.min(50_000, Math.max(50, Math.round(n))));
                }}
                className="tabular w-full min-w-0 bg-transparent px-2.5 py-1.5 text-sm outline-none"
              />
              <span className="pr-2.5 text-xs text-muted">m²</span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {[
                { label: "Small", ha: sizes.p25 },
                { label: "Typical", ha: sizes.p50 },
                { label: "Large", ha: sizes.p75 },
                { label: "Very large", ha: sizes.p90 },
              ].map((s) => {
                const m2 = Math.round((s.ha * 10_000) / 10) * 10;
                return (
                  <button
                    key={s.label}
                    onClick={() => setAreaM2(m2)}
                    className={`rounded-sm border px-2 py-1 ${areaM2 === m2 ? "border-ink bg-ink text-surface" : "border-line text-muted hover:text-ink"}`}
                  >
                    {s.label} · {m2.toLocaleString("en-US")} m²
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-faint">
            Sizes are from the NISR survey: a quarter of Eastern maize farmers grow under {Math.round(sizes.p25 * 10_000)} m², half
            under {Math.round(sizes.p50 * 10_000)} m², and one in ten over {Math.round(sizes.p90 * 10_000)} m². One hectare is 10,000 m².
          </p>
        </section>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Farmer View" />
      <section className="card mb-5 space-y-4 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="policy" className="text-[13px] text-muted">Policy number</label>
            <div className="mt-1.5 flex items-center rounded-sm border border-line focus-within:border-accent">
              <Search size={15} className="ml-2.5 shrink-0 text-faint" />
              <input
                id="policy"
                list="demo-policies"
                value={query}
                onChange={(e) => lookUp(e.target.value)}
                placeholder="e.g. RDI-KAY-1085"
                className="w-full min-w-0 bg-transparent px-2 py-1.5 text-sm uppercase outline-none"
              />
              <datalist id="demo-policies">
                {DEMO_POLICIES.map((p) => (
                  <option key={p.id} value={p.id}>{p.district}</option>
                ))}
              </datalist>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {DEMO_POLICIES.filter((_, i) => i % 2 === 0).map((p) => (
              <button
                key={p.id}
                onClick={() => lookUp(p.id)}
                className={`rounded-sm border px-2 py-1 ${p.district === policy.district ? "border-ink bg-ink text-surface" : "border-line text-muted hover:text-ink"}`}
              >
                {p.district}
              </button>
            ))}
          </div>
        </div>
        {notFound && <p className="text-sm text-drought">No policy {query.toUpperCase()}. Try one of the demo policies.</p>}
        <div>
          <div className="mb-1.5 text-[13px] text-muted">Season A</div>
          <SeasonTimeline season={season} onSelect={(s) => { setSeason(s); setReported(null); }} />
        </div>
        <p className="flex items-center gap-1.5 text-xs text-faint">
          <MessageSquareText size={13} />
          Demo: policies and phone numbers are synthetic. The Kinyarwanda text is a draft for a native speaker to check.{" "}
          <Link href="/ussd" className="text-accent underline-offset-2 hover:underline">On a basic phone: try the USSD menu</Link>
        </p>
      </section>
      {body}
    </>
  );
}
