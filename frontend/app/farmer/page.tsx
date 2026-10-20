"use client";

import { CheckCircle2, MessageSquareText, Search } from "lucide-react";
import { useState } from "react";
import SeasonTimeline from "@/components/SeasonTimeline";
import { Card, ErrorNote, Loading, PageHeader } from "@/components/ui";
import { getHistory, getModel, getSeasons } from "@/lib/api";
import { districtsInSeason, type DistrictSeason } from "@/lib/districtSeason";
import { pct } from "@/lib/payout";
import { DEMO_POLICIES, findPolicy, type Policy } from "@/lib/policies";
import { rwf } from "@/lib/pricing";
import { useApi } from "@/lib/useApi";

type Lang = "en" | "rw";

const word = (z: number) => (z <= -0.5 ? "below normal" : z >= 0.5 ? "above normal" : "about normal");

/** The message a farmer would receive when the season's result is published. */
function smsText(lang: Lang, p: Policy, v: DistrictSeason) {
  const amount = rwf(v.payout * p.cover);
  if (lang === "rw") {
    return v.payout > 0
      ? `RDI: Ubwishingizi bw'ibigori, ${p.district}, Igihembwe A ${v.season}. Ibyogajuru byerekanye ko imyaka yahuye n'izuba. Uzahabwa ingurane ya ${amount} (${pct(v.payout)}) kuri MoMo ${p.phone}. Ibibazo: kanda *xxx#`
      : `RDI: Ubwishingizi bw'ibigori, ${p.district}, Igihembwe A ${v.season}. Ibipimo by'ibyogajuru byari mu rugero, nta ngurane muri iki gihembwe. Niba umusaruro wawe warangiritse, kanda *xxx# ubimenyeshe.`;
  }
  return v.payout > 0
    ? `RDI maize cover, ${p.district}, Season A ${v.season}: satellites showed crops under drought stress. You will receive ${amount} (${pct(v.payout)} of your cover) on MoMo ${p.phone}. Questions: dial *xxx#`
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

export default function FarmerPage() {
  const history = useApi("history", getHistory);
  const seasons = useApi("seasons", getSeasons);
  const model = useApi("model", getModel);
  const [query, setQuery] = useState(DEMO_POLICIES[12].id);
  const [policy, setPolicy] = useState<Policy>(DEMO_POLICIES[12]);
  const [season, setSeason] = useState(2023);
  const [lang, setLang] = useState<Lang>("en");
  const [reported, setReported] = useState<string | null>(null);
  const error = history.error ?? seasons.error ?? model.error;
  const notFound = query.trim() !== "" && !findPolicy(query);

  function lookUp(id: string) {
    setQuery(id);
    const p = findPolicy(id);
    if (p) {
      setPolicy(p);
      setReported(null);
    }
  }

  let body;
  if (error) body = <ErrorNote message={error} />;
  else if (!history.data || !seasons.data || !model.data) body = <Loading />;
  else {
    const v = districtsInSeason(history.data, seasons.data, season).get(policy.district)!;
    const { trigger, exit } = model.data;
    const paid = v.payout > 0;
    const amount = v.payout * policy.cover;
    const reportKey = `${policy.id}:${season}`;
    const harvestFell = v.actualYieldAnom !== null && v.actualYieldAnom <= model.data.lowYieldThreshold;

    body = (
      <div className="space-y-5">
        <Card
          label={`Policy ${policy.id} · ${policy.district} · cover ${rwf(policy.cover)}`}
          title={
            paid
              ? `Season A ${season}: you will be paid ${rwf(amount)}`
              : `Season A ${season}: no payout for ${policy.district} this season`
          }
          source={`Every insured farmer in a district gets the same result: the index is calculated per district, not per farm. Payout starts when the predicted yield change reaches ${trigger}% and is full at ${exit}%.`}
        >
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-sm bg-surface-2 px-3 py-2.5">
                  <div className="text-xs text-muted">Your payout</div>
                  <div className="tabular text-xl font-semibold" style={{ color: paid ? "var(--drought)" : undefined }}>
                    {rwf(amount)}
                  </div>
                </div>
                <div className="rounded-sm bg-surface-2 px-3 py-2.5">
                  <div className="text-xs text-muted">Share of your cover</div>
                  <div className="tabular text-xl font-semibold">{pct(v.payout)}</div>
                </div>
                <div className="rounded-sm bg-surface-2 px-3 py-2.5">
                  <div className="text-xs text-muted">District index</div>
                  <div className="tabular text-xl font-semibold">{v.index > 0 ? "+" : ""}{v.index.toFixed(1)}%</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Why</h3>
                <p className="mt-1 text-sm text-muted">
                  From October to December, rainfall in {policy.district} was {word(v.rainZ)} and crop greenness was{" "}
                  {word(v.ndviZ)}. That points to a harvest {Math.abs(v.index).toFixed(0)}% {v.index < 0 ? "below" : "above"} what is
                  normal for the district,{" "}
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
                  {reported === reportKey ? (
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-accent">
                      <CheckCircle2 size={16} /> Loss reported for {policy.district}, Season A {season} (demo, not saved)
                    </p>
                  ) : (
                    <button
                      onClick={() => setReported(reportKey)}
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

            <Phone text={smsText(lang, policy, v)} lang={lang} onLang={setLang} />
          </div>
        </Card>
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
                className={`rounded-sm border px-2 py-1 ${p.id === policy.id ? "border-ink bg-ink text-surface" : "border-line text-muted hover:text-ink"}`}
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
          Demo: policies and phone numbers are synthetic. The Kinyarwanda text is a draft for a native speaker to check.
        </p>
      </section>
      {body}
    </>
  );
}

