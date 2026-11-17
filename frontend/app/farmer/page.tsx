"use client";

import { CheckCircle2, MessageSquareText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import NumberInput from "@/components/NumberInput";
import Term from "@/components/Term";
import type { GlossaryKey } from "@/lib/glossary";
import SeasonTimeline from "@/components/SeasonTimeline";
import { Card, ErrorNote, Loading, PageHeader } from "@/components/ui";
import Link from "next/link";
import { getHistory, getModel, getPolicies, getSeasons, getSmsStatus, reportLoss, sendSms, USE_MOCK } from "@/lib/api";
import { districtsInSeason, type DistrictSeason } from "@/lib/districtSeason";
import { pct, changeWords, indexPct } from "@/lib/payout";
import { LAST_SEASON, USSD_CODE, YIELD_RANGE, YIELD_SEASONS } from "@/lib/constants";
import { smsParts } from "@/lib/sms";
import { DEMO_POLICIES, findPolicy, fromRegistered, type Policy } from "@/lib/policies";
import { defaultTerms, expectedPayout, payoutHistory, perHectare, rwf } from "@/lib/pricing";
import { useT, type Lang } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";

const word = (z: number) => (z <= -0.5 ? "below normal" : z >= 0.5 ? "above normal" : "about normal");
const wordRw = (z: number) => (z <= -0.5 ? "munsi y'isanzwe" : z >= 0.5 ? "hejuru y'isanzwe" : "isanzwe");

/** The predicted harvest in Kinyarwanda, matching changeWords: "about normal" or "X% below/above". */
function harvestRw(x: number, trigger: number) {
  const words = changeWords(x, trigger);
  if (words === "about normal") return "uri hafi y'uwitezwe";
  const [amount] = words.split(" ");
  return `uri ${amount} ${x < 0 ? "munsi" : "hejuru"} y'uwitezwe`;
}

/** The message a farmer would receive when the season's result is published. */
/** A survey plot size in hectares, as square metres rounded to 10, the same on the buttons and in the note. */
const toM2 = (ha: number) => Math.round((ha * 10_000) / 10) * 10;

function smsText(lang: Lang, p: Policy, v: DistrictSeason, amount: number) {
  // Kept to one SMS (160 plain GSM characters) in every case; checked in lib/sms.ts.
  const money = rwf(amount);
  if (lang === "rw") {
    return v.payout > 0
      ? `RDI: Ubwishingizi bw'ibigori, ${p.district}, Igihembwe A ${v.season}. Imyaka yahuye n'izuba. Uzahabwa ${money} kuri MoMo ${p.phone}. Kanda ${USSD_CODE}`
      : `RDI: Ubwishingizi bw'ibigori, ${p.district}, Igihembwe A ${v.season}. Ibipimo byari mu rugero, nta ngurane. Umusaruro warangiritse? Kanda ${USSD_CODE}`;
  }
  return v.payout > 0
    ? `RDI maize cover, ${p.district} Season A ${v.season}: satellites showed drought stress. You will get ${money} on MoMo ${p.phone}. Info: dial ${USSD_CODE}`
    : `RDI maize cover, ${p.district} Season A ${v.season}: satellite readings were normal, so no payout this season. Harvest failed? Dial ${USSD_CODE} to report.`;
}

function Phone({ text, lang, onLang }: { text: string; lang: Lang; onLang: (l: Lang) => void }) {
  const parts = smsParts(text);
  const { t } = useT();
  return (
    <div className="mx-auto w-full max-w-[290px]">
      <div className="mb-2 flex justify-center gap-1 text-xs" role="group" aria-label={t("SMS language", "Ururimi rwa SMS")}>
        {(["rw", "en"] as const).map((l) => (
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
        <div className="mt-2 flex justify-between gap-2 px-1 text-[10px] text-faint">
          <span>{t("Delivered when the season's index is published", "Yoherezwa igipimo cy'igihembwe kimaze gutangazwa")}</span>
          <span className={`tabular whitespace-nowrap ${parts.parts > 1 ? "font-medium text-drought" : ""}`}>
            {parts.parts} SMS · {parts.length} {t("chars", "inyuguti")}
          </span>
        </div>
      </div>
      <SendSms key={text} text={text} />
    </div>
  );
}

/** Sends the message for real through Africa's Talking when the backend is set up for it. */
function SendSms({ text }: { text: string }) {
  const status = useApi("sms-status", getSmsStatus);
  const [state, setState] = useState<{ ok: boolean; text: string } | "sending" | null>(null);
  const { t } = useT();
  if (!status.data?.configured) return null;
  const where = status.data.sandbox ? t("the Africa's Talking simulator", "simulator ya Africa's Talking") : status.data.phone;
  return (
    <div className="mt-2 text-center text-xs">
      {state && state !== "sending" ? (
        <p className={state.ok ? "text-accent" : "text-drought"}>{state.text}</p>
      ) : (
        <button
          disabled={state === "sending"}
          onClick={() => {
            setState("sending");
            sendSms(text).then(
              (r) =>
                setState({
                  ok: true,
                  text: (() => {
                    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                    return t(
                      `Sent at ${time} to ${r.phone}${r.sandbox ? " (sandbox simulator)" : ""}.`,
                      `Yoherejwe saa ${time} kuri ${r.phone}${r.sandbox ? " (simulator ya sandbox)" : ""}.`,
                    );
                  })(),
                }),
              (e: Error) => setState({ ok: false, text: e.message }),
            );
          }}
          className="rounded-sm border border-line px-3 py-1.5 font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
        >
          {state === "sending" ? t("Sending…", "Birimo koherezwa…") : t(`Send this SMS to ${status.data.phone}`, `Ohereza iyi SMS kuri ${status.data.phone}`)}
        </button>
      )}
      <div className="mt-1 text-[10px] text-faint">{t("via", "binyuze kuri")} {where}</div>
    </div>
  );
}

function Tile({ label, info, value, sub, tone }: { label: string; info?: GlossaryKey; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-sm bg-surface-2 px-3 py-2.5">
      <div className="text-xs text-muted">
        {label}
        {info && <Term k={info} />}
      </div>
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
  // Policies signed up for over USSD or the web phone; the demo policies still work without them.
  const registered = useApi("policies", getPolicies);
  const signedUp = useMemo(() => (registered.data ?? []).map(fromRegistered), [registered.data]);
  const [query, setQuery] = useState(DEFAULT_POLICY.id);
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [areaM2, setAreaM2] = useState(DEFAULT_POLICY.areaM2);
  const [season, setSeason] = useState(2023);
  const [lang, setLang] = useState<Lang>("rw");
  const { lang: siteLang, t } = useT();
  const rw = siteLang === "rw";
  // The latest report sent, keyed by policy and season so it clears when either changes.
  const [reported, setReported] = useState<{ key: string; text: string; ok: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const error = history.error ?? seasons.error ?? model.error;
  // While the signed-up policies load, an unknown number may still be one of them.
  const notFound = query.trim() !== "" && !findPolicy(query, signedUp) && !registered.loading;

  function select(p: Policy) {
    setPolicy(p);
    setAreaM2(p.areaM2);
    setReported(null);
    // A new cover's own season is still running, so open on the latest season with a final index.
    if (p.season) setSeason(LAST_SEASON);
  }

  function lookUp(id: string) {
    setQuery(id);
    const p = findPolicy(id, signedUp);
    if (p) select(p);
  }

  // A signed-up number typed before the list arrived opens once it does.
  const pending = findPolicy(query, signedUp);
  if (pending && pending.id !== policy.id) select(pending);

  let body;
  if (error) body = <ErrorNote message={error} />;
  else if (!history.data || !seasons.data || !model.data) body = <Loading />;
  // An unknown number shows nothing, rather than the last policy under a number it does not have.
  else if (notFound) body = null;
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
    // A farmer's own cover is for one season; the past seasons show what it would have paid.
    const before = !!policy.season && season < policy.season;
    // Reports go where Field Checks can weigh them: seasons with harvest data. A signed-up
    // policy reports for its own season, from the USSD menu.
    const canReport = !policy.season && YIELD_SEASONS.includes(season);
    const sizes = m.pricingInputs.farmSizeHa;

    body = (
      <div className="space-y-5">
        <Card
          label={t(
            `Policy ${policy.id} · ${policy.district} · ${areaM2.toLocaleString("en-US")} m² of maize`,
            `Ubwishingizi ${policy.id} · ${policy.district} · ${areaM2.toLocaleString("en-US")} m² by'ibigori`,
          )}
          title={
            paid
              ? t(
                  `Season A ${season}: ${before ? "this cover would have paid" : "you will be paid"} ${rwf(amount)}`,
                  `Igihembwe A ${season}: ${before ? "ubu bwishingizi bwari kwishyura" : "uzahabwa"} ${rwf(amount)}`,
                )
              : t(`Season A ${season}: no payout for ${policy.district} this season`, `Igihembwe A ${season}: nta ngurane muri ${policy.district} muri iki gihembwe`)
          }
          source={t(`Crop value = maize area × ${policy.district}'s expected yield (${Math.round(perHa.yieldKg).toLocaleString("en-US")} kg/ha, Season A ${m.pricingInputs.season} trend) × RWF ${Math.round(terms.price)}/kg (survey farm-gate price). Cover = ${Math.abs(exit)}% of the crop value, the loss at which the payout is full. Premium = cover × ${policy.district}'s average payout since 2001, plus a ${pct(terms.loading)} loading, less a ${pct(terms.subsidy)} subsidy. Every insured farmer in a district gets the same payout share: the index is per district, not per farm.`, `Agaciro k'imyaka = ubuso bw'ibigori × umusaruro witezwe muri ${policy.district} (${Math.round(perHa.yieldKg).toLocaleString("en-US")} kg/ha, uko umusaruro wagiye uzamuka kugeza ku Gihembwe A ${m.pricingInputs.season}) × RWF ${Math.round(terms.price)}/kg (igiciro cyo ku murima cyo mu ibarura). Agaciro kishingiwe = ${Math.abs(exit)}% by'agaciro k'imyaka, ari cyo gihombo ingurane yuzuriraho. Umusanzu = agaciro kishingiwe × impuzandengo y'ingurane ya ${policy.district} kuva 2001, hiyongereyeho ${pct(terms.loading)} y'ikigo cy'ubwishingizi, hakuweho inkunga ya ${pct(terms.subsidy)}. Abahinzi bose bishingiwe mu karere kamwe bahabwa igice kimwe cy'ingurane: igipimo kibarwa ku karere, si ku murima.`)}
        >
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Tile
                  label={t("Your maize is worth", "Agaciro k'ibigori byawe")}
                  value={rwf(value)}
                  sub={`${Math.round(perHa.yieldKg * ha).toLocaleString("en-US")} ${t("kg expected", "kg byitezwe")}`}
                />
                <Tile label={t("Your cover", "Agaciro kishingiwe")} info="cover" value={rwf(cover)} sub={t(`${Math.abs(exit)}% of the value`, `${Math.abs(exit)}% by'agaciro`)} />
                <Tile label={t("You pay per season", "Umusanzu ku gihembwe")} value={rwf(premium)} sub={t("after subsidy", "nyuma y'inkunga")} />
                <Tile
                  label={t("Payout this season", "Ingurane y'iki gihembwe")}
                  info="payoutRule"
                  value={rwf(amount)}
                  sub={t(`${pct(v.payout)} of cover · index ${indexPct(v.index, trigger)}`, `${pct(v.payout)} by'agaciro kishingiwe · igipimo ${indexPct(v.index, trigger)}`)}
                  tone={paid ? "var(--drought)" : undefined}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold">{t("Why", "Impamvu")}</h3>
                {rw ? (
                  <p className="mt-1 text-sm text-muted">
                    Kuva mu Ukwakira kugeza mu Ukuboza, imvura muri {policy.district} yari {wordRw(v.rainZ)}, n&apos;ubutoto
                    bw&apos;imyaka bwari {wordRw(v.ndviZ)}. Ibyo byerekana umusaruro {harvestRw(v.index, trigger)} mu karere,{" "}
                    {paid
                      ? v.payout >= 1
                        ? `urenze ${exit}%, bityo agaciro kishingiwe kose kakishyurwa.`
                        : `urenze ${trigger}% aho ingurane itangirira, bityo hakishyurwa ${pct(v.payout)} by'agaciro kishingiwe.`
                      : `utageze kuri ${trigger}% aho ingurane itangirira.`}
                  </p>
                ) : (
                <p className="mt-1 text-sm text-muted">
                  From October to December, rainfall in {policy.district} was {word(v.rainZ)} and crop greenness was{" "}
                  {word(v.ndviZ)}. That points to a harvest{" "}
                  {changeWords(v.index, trigger) === "about normal" ? "close to" : changeWords(v.index, trigger)} what is expected for
                  the district,{" "}
                  {paid
                    ? v.payout >= 1
                      ? `past the ${exit}% level, so the full cover is paid.`
                      : `past the ${trigger}% trigger, so ${pct(v.payout)} of the cover is paid.`
                    : `which does not reach the ${trigger}% trigger.`}
                </p>
                )}
              </div>

              {!paid && (
                <div className="rounded-sm border border-line px-4 py-3">
                  <div className="text-sm font-semibold">{t("Did your harvest fail anyway?", "Umusaruro wawe warapfuye n'ubundi?")}</div>
                  <p className="mt-1 text-sm text-muted">
                    {t(
                      "Satellites can miss losses from pests, disease or a dry spell on one hillside. Reports from farmers in the same district are counted, and a district with many reports gets a field check.",
                      "Ibyogajuru bishobora kutabona igihombo cyatewe n'udukoko, indwara cyangwa izuba ryibasiye umusozi umwe. Raporo z'abahinzi bo mu karere kamwe zirabarwa, kandi akarere gafite raporo nyinshi gakorerwamo igenzura mu murima.",
                    )}
                  </p>
                  {reported?.key === reportKey ? (
                    <p className={`mt-2 flex items-start gap-1.5 text-sm font-medium ${reported.ok ? "text-accent" : "text-drought"}`}>
                      {reported.ok && <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
                      <span>
                        {reported.text}{" "}
                        {reported.ok && <Link href={`/field-checks?season=${season}`} className="underline underline-offset-2">{t("See field checks", "Reba igenzura mu murima")}</Link>}
                      </span>
                    </p>
                  ) : !canReport ? (
                    <p className="mt-2 text-xs text-muted">
                      {policy.season
                        ? t(
                            `This cover is for Season A ${policy.season}, so a loss is reported for that season: dial ${USSD_CODE} and choose 4.`,
                            `Ubu bwishingizi ni ubw'Igihembwe A ${policy.season}, bityo igihombo kimenyeshwa kuri icyo gihembwe: kanda ${USSD_CODE} uhitemo 4.`,
                          )
                        : t(
                            `Reports are taken for the seasons with harvest data (${YIELD_RANGE}), where field checks can weigh them.`,
                            `Raporo zakirwa ku bihembwe bifite amakuru y'umusaruro (${YIELD_RANGE}), aho igenzura mu murima rishobora kuzisuzuma.`,
                          )}
                    </p>
                  ) : (
                    <button
                      disabled={sending}
                      onClick={() => {
                        setSending(true);
                        reportLoss(policy.id, policy.district, season).then(
                          (r) =>
                            setReported({
                              key: reportKey,
                              ok: true,
                              text: USE_MOCK
                                ? t("Report noted (saved-results mode: not stored).", "Raporo yanditswe (ibisubizo byabitswe: ntibikwa).")
                                : r.created
                                  ? t(
                                      `Report received: ${r.reports} ${r.reports === 1 ? "report" : "reports"} on file for ${policy.district}, Season A ${season}.`,
                                      `Raporo yakiriwe: raporo ${r.reports} zanditswe muri ${policy.district}, Igihembwe A ${season}.`,
                                    )
                                  : t(
                                      `You have already reported this season; ${r.reports} ${r.reports === 1 ? "report" : "reports"} on file for ${policy.district}.`,
                                      `Mwamaze kumenyesha muri iki gihembwe; raporo ${r.reports} zirahari muri ${policy.district}.`,
                                    ),
                            }),
                          (e: Error) => setReported({ key: reportKey, ok: false, text: e.message }),
                        ).finally(() => setSending(false));
                      }}
                      className="mt-2 rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-surface disabled:opacity-60"
                    >
                      {sending ? t("Sending…", "Birimo koherezwa…") : t("Report a crop loss", "Menyesha igihombo")}
                    </button>
                  )}
                  {harvestFell && (
                    <p className="mt-2 text-xs text-muted">
                      {t(
                        `The NISR survey later recorded a harvest ${Math.abs(v.actualYieldAnom!).toFixed(0)}% below expected in ${policy.district} this season: a case for a field check.`,
                        `Ibarura rya NISR ryaje kugaragaza umusaruro uri ${Math.abs(v.actualYieldAnom!).toFixed(0)}% munsi y'uwitezwe muri ${policy.district} muri iki gihembwe: impamvu yo gukora igenzura mu murima.`,
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>

            <Phone text={smsText(lang, policy, v, amount)} lang={lang} onLang={setLang} />
          </div>
        </Card>

        <section className="card px-5 py-4 sm:px-6">
          <label htmlFor="area" className="text-sm font-medium">{t("Your maize area", "Ubuso bw'ibigori byawe")}</label>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <div className="flex w-40 items-center rounded-sm border border-line focus-within:border-accent">
              <NumberInput
                id="area"
                min={50}
                max={100_000}
                step={50}
                value={areaM2}
                onChange={(n) => setAreaM2(Math.round(n))}
                className="w-full min-w-0 bg-transparent px-2.5 py-1.5 text-sm outline-none"
              />
              <span className="pr-2.5 text-xs text-muted">m²</span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {[
                { label: t("Small", "Buto"), ha: sizes.p25 },
                { label: t("Typical", "Busanzwe"), ha: sizes.p50 },
                { label: t("Large", "Bunini"), ha: sizes.p75 },
                { label: t("Very large", "Bunini cyane"), ha: sizes.p90 },
              ].map((s) => {
                const m2 = toM2(s.ha);
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
            {t(
              `Sizes are from the NISR survey: a quarter of Eastern maize farmers grow under about ${toM2(sizes.p25).toLocaleString("en-US")} m², half under ${toM2(sizes.p50).toLocaleString("en-US")} m², and one in ten over ${toM2(sizes.p90).toLocaleString("en-US")} m². One hectare is 10,000 m².`,
              `Ubuso buva mu ibarura rya NISR: kimwe cya kane cy'abahinzi b'ibigori bo mu Burasirazuba bahinga munsi ya ${toM2(sizes.p25).toLocaleString("en-US")} m², kimwe cya kabiri munsi ya ${toM2(sizes.p50).toLocaleString("en-US")} m², naho umwe mu icumi ahinga hejuru ya ${toM2(sizes.p90).toLocaleString("en-US")} m². Hegitari imwe ni 10,000 m².`,
            )}
          </p>
        </section>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={t("Farmer View", "Urupapuro rw'umuhinzi")} />
      <section className="card mb-5 space-y-4 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="policy" className="text-[13px] text-muted">{t("Policy number", "Nimero y'ubwishingizi")}</label>
            <div className="mt-1.5 flex items-center rounded-sm border border-line focus-within:border-accent">
              <Search size={15} className="ml-2.5 shrink-0 text-faint" />
              <input
                id="policy"
                list="demo-policies"
                value={query}
                onChange={(e) => lookUp(e.target.value)}
                placeholder={t("e.g. RDI-KAY-1085", "urugero: RDI-KAY-1085")}
                className="w-full min-w-0 bg-transparent px-2 py-1.5 text-sm uppercase outline-none"
              />
              <datalist id="demo-policies">
                {[...DEMO_POLICIES, ...signedUp].map((p) => (
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
                className={`rounded-sm border px-2 py-1 ${!notFound && p.district === policy.district ? "border-ink bg-ink text-surface" : "border-line text-muted hover:text-ink"}`}
              >
                {p.district}
              </button>
            ))}
          </div>
        </div>
        {notFound && (
          <p className="text-sm text-drought">
            {registered.error
              ? t(
                  `Policy ${query.toUpperCase()} not found: signed-up policies could not be loaded (${registered.error}). The demo policies still work.`,
                  `Ubwishingizi ${query.toUpperCase()} ntibwabonetse: urutonde rw'abiyandikishije ntirwabonetse (${registered.error}). Ubwishingizi bw'icyitegererezo burakora.`,
                )
              : t(
                  `No policy ${query.toUpperCase()}. Check the number, or try a demo policy.`,
                  `Nta bwishingizi ${query.toUpperCase()} buhari. Reba nimero, cyangwa ugerageze ubwishingizi bw'icyitegererezo.`,
                )}
          </p>
        )}
        <div>
          <div className="mb-1.5 text-[13px] text-muted">{t("Season A", "Igihembwe A")}</div>
          <SeasonTimeline season={season} onSelect={(s) => { setSeason(s); setReported(null); }} />
          {!notFound && policy.season && policy.season > LAST_SEASON && (
            <p className="mt-2 text-xs text-muted">
              {t(
                `This cover starts in Season A ${policy.season}, which is still under way; its provisional index is on`,
                `Ubu bwishingizi butangira mu Gihembwe A ${policy.season}, kigikomeza; igipimo cyacyo cy'agateganyo kiri kuri`,
              )}{" "}
              <Link href="/season" className="text-accent underline-offset-2 hover:underline">{t("This Season", "Iki gihembwe")}</Link>.{" "}
              {t(
                "The seasons above show what the same cover would have paid in past years.",
                "Ibihembwe biri hejuru byerekana icyo ubu bwishingizi bwari kwishyura mu myaka yashize.",
              )}
            </p>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-faint">
          <MessageSquareText size={13} />
          {t("Demo: policies and phone numbers are synthetic.", "Icyitegererezo: ubwishingizi na nimero za telefoni ni ibihimbano.")}{" "}
          <Link href="/ussd" className="text-accent underline-offset-2 hover:underline">
            {t("On a basic phone: try the USSD menu", "Kuri telefoni isanzwe: gerageza menu ya USSD")}
          </Link>
        </p>
      </section>
      {body}
    </>
  );
}
