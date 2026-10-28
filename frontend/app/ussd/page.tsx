"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import { USE_MOCK, ussdPreview } from "@/lib/api";
import { USSD_CODE } from "@/lib/constants";
import { DEMO_POLICIES } from "@/lib/policies";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
const NEW_FARMER = "new";
const WELCOME = `Kanda ${USSD_CODE}\nRDI Ubwishingizi bw'ibigori`;

/** A demo number in the reserved web range (+2507000 and five digits): not a real phone. */
const randomDemoPhone = () => `+2507000${String(Math.floor(Math.random() * 100_000)).padStart(5, "0")}`;

/** This browser's demo number, kept so that after signing up, dialling again opens the new policy. */
function storedDemoPhone() {
  try {
    const saved = localStorage.getItem("rdi-demo-phone");
    if (saved && /^\+2507000\d{5}$/.test(saved)) return saved;
  } catch {}
  return rememberDemoPhone(randomDemoPhone());
}

function rememberDemoPhone(phone: string) {
  try {
    localStorage.setItem("rdi-demo-phone", phone);
  } catch {}
  return phone;
}

/**
 * A basic phone running the real USSD menu. Every answer goes to the backend's
 * /api/ussd/preview, which serves the same menu Africa's Talking reaches when
 * USSD_CODE is dialled on their simulator, so the two always match.
 */
export default function UssdPage() {
  // Who is dialling: a demo policy's id, or NEW_FARMER for this browser's demo number.
  const [caller, setCaller] = useState<string>(DEMO_POLICIES[12].id);
  const [demoPhone, setDemoPhone] = useState("");
  // The answers so far, joined by "*" as Africa's Talking sends them; null when no session is open.
  const [session, setSession] = useState<string | null>(null);
  const [screen, setScreen] = useState(WELCOME);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const newFarmer = caller === NEW_FARMER;

  function hangUp() {
    setSession(null);
    setScreen(WELCOME);
  }

  async function ask(text: string) {
    setBusy(true);
    try {
      const reply = await ussdPreview(text, newFarmer ? { phone: demoPhone } : { policyId: caller });
      setScreen(reply.slice(4));
      setSession(reply.startsWith("CON") ? text : null);
    } catch (e) {
      setScreen((e as Error).message);
      setSession(null);
    } finally {
      setBusy(false);
    }
  }

  function send() {
    const input = typed.trim();
    setTyped("");
    if (session === null) {
      if (input === USSD_CODE) void ask("");
      else setScreen(`Kode ntizwi. Kanda ${USSD_CODE}.`);
      return;
    }
    if (input) void ask(session ? `${session}*${input}` : input);
  }

  return (
    <>
      <PageHeader title="USSD Menu" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
        <Card
          label="How a farmer on a basic phone reaches the cover"
          title="Dial a short code, answer with numbers: no smartphone, app or data bundle needed"
          source={`USSD menus run on any mobile phone over the network's signalling channel, so they work without internet. This phone runs the backend's real menu, the same one Africa's Talking serves when ${USSD_CODE} is dialled on their simulator. As a new farmer it signs up with a demo number in a reserved range (+2507000…), creating a real policy in the database without texting anyone. A live scheme would use a short code allocated through the operators. Reports go to the Field Checks page; "Send me this by SMS" sends to the demo phone in backend/.env.`}
        >
          <label className="text-sm text-muted">
            Dial as{" "}
            <select
              value={caller}
              onChange={(e) => {
                setCaller(e.target.value);
                // Read only when chosen: the page is also rendered on the server, where there is no storage.
                if (e.target.value === NEW_FARMER && !demoPhone) setDemoPhone(storedDemoPhone());
                hangUp();
              }}
              className="ml-1 max-w-full rounded-sm border border-line bg-surface px-2 py-1 text-sm text-ink"
            >
              <option value={NEW_FARMER}>A new farmer (sign up for cover)</option>
              {DEMO_POLICIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.district} · {p.areaM2.toLocaleString("en-US")} m²
                </option>
              ))}
            </select>
          </label>
          {newFarmer && (
            <p className="mt-2 text-xs text-muted">
              Demo number <span className="tabular text-ink">{demoPhone}</span>, not a real phone, so no SMS is sent.{" "}
              <button
                onClick={() => {
                  setDemoPhone(rememberDemoPhone(randomDemoPhone()));
                  hangUp();
                }}
                className="text-accent underline-offset-2 hover:underline"
              >
                Use a new number
              </button>
            </p>
          )}
          <ol className="mt-4 space-y-1.5 text-sm text-muted">
            <li><span className="font-medium text-ink">1.</span> Type <span className="tabular font-medium text-ink">{USSD_CODE}</span> and press Send.</li>
            {newFarmer ? (
              <>
                <li><span className="font-medium text-ink">2.</span> 1 buys cover: pick your district, type your maize field size in m², then 1 confirms. The menu opens in Kinyarwanda; 5 switches to English.</li>
                <li><span className="font-medium text-ink">3.</span> Dial again from the same number to open your new policy. It is listed on the <Link href="/policies" className="text-accent hover:underline">Policies</Link> page as a web demo.</li>
              </>
            ) : (
              <>
                <li><span className="font-medium text-ink">2.</span> Answer with a number: 1 your cover, 2 this season, 3 your payouts, 4 report a crop loss, 5 English. The menu opens in Kinyarwanda.</li>
                <li><span className="font-medium text-ink">3.</span> 0 goes back; on the main menu it exits.</li>
              </>
            )}
          </ol>
          {USE_MOCK && (
            <p className="mt-4 rounded-sm border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
              The menu runs on the backend, so it needs the live API (it is not in the saved results).
            </p>
          )}
        </Card>

        <div className="mx-auto w-full max-w-[300px] rounded-[28px] border-[6px] border-ink/85 bg-surface-2 p-4 shadow-sm">
          <div
            className="tabular min-h-[210px] whitespace-pre-line rounded-md bg-[#cfd8c4] px-3 py-2.5 font-mono text-[13px] leading-snug text-[#1d2a1a]"
            aria-live="polite"
          >
            {busy ? "USSD code running…" : screen}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              aria-label="Phone input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={session === null ? USSD_CODE : "Reply"}
              className="tabular min-w-0 flex-1 rounded-sm border border-line bg-surface px-2 py-1.5 font-mono text-sm outline-none focus:border-accent"
            />
            <button onClick={send} disabled={busy} className="rounded-sm bg-[#2f7d3a] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
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
