"use client";

import { useState } from "react";
import { Card, ErrorNote, Loading, PageHeader } from "@/components/ui";
import { getCurrentSeason, getHistory, getModel, getSeasons, reportLoss, USE_MOCK } from "@/lib/api";
import { LAST_SEASON, USSD_CODE } from "@/lib/constants";
import { districtsInSeason } from "@/lib/districtSeason";
import { pct, signedPct } from "@/lib/payout";
import { DEMO_POLICIES, type Policy } from "@/lib/policies";
import { defaultTerms, expectedPayout, payoutHistory, perHectare, rwf } from "@/lib/pricing";
import { useApi } from "@/lib/useApi";

type Screen = "idle" | "menu" | "cover" | "season" | "last" | "report" | "reported";

const CODE = USSD_CODE;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

/**
 * A USSD menu as a basic phone shows it. USSD works on any handset without data,
 * which is how most smallholders would reach their cover.
 */
export default function UssdPage() {
  const model = useApi("model", getModel);
  const history = useApi("history", getHistory);
  const seasons = useApi("seasons", getSeasons);
  const current = useApi("current-season", getCurrentSeason);
  const [policy, setPolicy] = useState<Policy>(DEMO_POLICIES[12]);
  const [screen, setScreen] = useState<Screen>("idle");
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState("");
  const error = model.error ?? history.error ?? seasons.error ?? current.error;

  if (error) return <ErrorNote message={error} />;
  if (!model.data || !history.data || !seasons.data || !current.data) return <Loading />;

  const m = model.data;
  const terms = defaultTerms(m);
  const record = payoutHistory(history.data, seasons.data);
  const ha = policy.areaM2 / 10_000;
  const perHa = perHectare(policy.district, m, terms, expectedPayout(record, policy.district));
  const now = current.data.districts.find((d) => d.district === policy.district)!;
  const last = districtsInSeason(history.data, seasons.data, LAST_SEASON).get(policy.district)!;

  const text: Record<Screen, string> = {
    idle: `Dial ${CODE} to open\nRDI Maize Insurance`,
    menu: `RDI Maize Insurance\n${policy.district} · ${policy.id}\n1. My cover\n2. This season\n3. Last result\n4. Report a crop loss\n0. Exit`,
    cover: `Maize area ${policy.areaM2.toLocaleString("en-US")} m2\nCover ${rwf(perHa.cover * ha)}\nYou pay ${rwf(perHa.farmerPays * ha)}/season\nPaid when the district index\nfalls below ${m.trigger}%\n0. Back`,
    season: `Season A ${current.data.season}\nDay ${current.data.daysElapsed} of ${current.data.windowDays}\nRain ${Math.round((now.rainMm / now.rainNormalMm) * 100)}% of normal\nIndex ${signedPct(now.index)} (provisional)\nFinal result after 31 Dec\n0. Back`,
    last: `Season A ${LAST_SEASON}\n${policy.district} index ${signedPct(last.index)}\n${last.payout > 0 ? `Paid ${pct(last.payout)}: ${rwf(last.payout * perHa.cover * ha)}` : "No payout"}\n0. Back`,
    report: `Report a crop loss for\nSeason A ${current.data.season}?\n1. Yes\n0. Back`,
    reported: `${message}\n0. Menu`,
  };

  function send() {
    const input = typed.trim();
    setTyped("");
    if (screen === "idle") {
      if (input === CODE) setScreen("menu");
      return;
    }
    if (screen === "menu") {
      const next: Record<string, Screen> = { "1": "cover", "2": "season", "3": "last", "4": "report" };
      if (input === "0") setScreen("idle");
      else if (next[input]) setScreen(next[input]);
      return;
    }
    if (screen === "report" && input === "1") {
      reportLoss(policy.id, policy.district, current.data!.season).then(
        (r) => {
          setMessage(
            USE_MOCK
              ? "Thank you. Report noted\n(saved-results mode,\nnot stored)."
              : r.created
                ? `Thank you. Report received.\n${r.reports} report${r.reports === 1 ? "" : "s"} for ${policy.district}.`
                : `You have already reported\nthis season. ${r.reports} on file.`,
          );
          setScreen("reported");
        },
        () => {
          setMessage("Sorry, try again later.");
          setScreen("reported");
        },
      );
      return;
    }
    if (input === "0") setScreen("menu");
  }

  return (
    <>
      <PageHeader title="USSD Menu" />
      <div className="grid gap-5 md:grid-cols-[1fr_320px] md:items-start">
        <Card
          label="How a farmer on a basic phone reaches the cover"
          title="Dial a short code, answer with numbers: no smartphone, app or data bundle needed"
          source={`USSD menus run on any mobile phone over the network's signalling channel, so they work without internet. ${CODE} is the Africa's Talking sandbox channel: dial it on their phone simulator to use this menu for real. A live scheme would use a short code allocated through the operators. The figures come from the same data as the Farmer View; reports go to the Field Checks page.`}
        >
          <label className="text-sm text-muted">
            Demo policy{" "}
            <select
              value={policy.id}
              onChange={(e) => {
                setPolicy(DEMO_POLICIES.find((p) => p.id === e.target.value)!);
                setScreen("idle");
              }}
              className="ml-1 rounded-sm border border-line bg-surface px-2 py-1 text-sm text-ink"
            >
              {DEMO_POLICIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.district} · {p.areaM2.toLocaleString("en-US")} m²
                </option>
              ))}
            </select>
          </label>
          <ol className="mt-4 space-y-1.5 text-sm text-muted">
            <li><span className="font-medium text-ink">1.</span> Type <span className="tabular font-medium text-ink">{CODE}</span> and press Send.</li>
            <li><span className="font-medium text-ink">2.</span> Answer each menu with a number: 1 for your cover, 2 for this season, 3 for the last result, 4 to report a crop loss.</li>
            <li><span className="font-medium text-ink">3.</span> 0 goes back.</li>
          </ol>
        </Card>

        <div className="mx-auto w-full max-w-[300px] rounded-[28px] border-[6px] border-ink/85 bg-surface-2 p-4 shadow-sm">
          <div className="tabular min-h-[190px] whitespace-pre-line rounded-md bg-[#cfd8c4] px-3 py-2.5 font-mono text-[13px] leading-snug text-[#1d2a1a]">
            {text[screen]}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              aria-label="Phone input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={screen === "idle" ? CODE : "Reply"}
              className="tabular min-w-0 flex-1 rounded-sm border border-line bg-surface px-2 py-1.5 font-mono text-sm outline-none focus:border-accent"
            />
            <button onClick={send} className="rounded-sm bg-[#2f7d3a] px-3 py-1.5 text-sm font-medium text-white">
              Send
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {KEYS.map((k) => (
              <button
                key={k}
                onClick={() => setTyped((t) => t + k)}
                className="tabular rounded-md border border-line bg-surface py-2 text-base hover:bg-surface-2"
              >
                {k}
              </button>
            ))}
          </div>
          <button onClick={() => setTyped((t) => t.slice(0, -1))} className="mt-1.5 w-full rounded-md border border-line bg-surface py-1.5 text-sm text-muted hover:bg-surface-2">
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
