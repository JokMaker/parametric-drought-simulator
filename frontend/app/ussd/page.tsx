"use client";

import { Phone, PhoneOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import { USE_MOCK, ussdPreview } from "@/lib/api";
import { USSD_CODE } from "@/lib/constants";
import { DEMO_POLICIES } from "@/lib/policies";

const KEYS: [string, string][] = [
  ["1", ""], ["2", "abc"], ["3", "def"], ["4", "ghi"], ["5", "jkl"], ["6", "mno"],
  ["7", "pqrs"], ["8", "tuv"], ["9", "wxyz"], ["*", "+"], ["0", "␣"], ["#", "⇧"],
];
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
            <li><span className="font-medium text-ink">1.</span> Type <span className="tabular font-medium text-ink">{USSD_CODE}</span> and press the green call key (or Send).</li>
            {newFarmer ? (
              <>
                <li><span className="font-medium text-ink">2.</span> 1 buys cover: pick your district, type your maize field size in m², then 1 confirms. The menu opens in Kinyarwanda; 5 switches to English.</li>
                <li><span className="font-medium text-ink">3.</span> The screen shows your policy number and your menu straight away, so you can check your cover or report a loss (4) without dialling again. The policy is listed on the <Link href="/policies" className="text-accent hover:underline">Policies</Link> page as a web demo.</li>
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

        <FeaturePhone
          screen={busy ? "USSD code running…" : screen}
          typed={typed}
          placeholder={session === null ? USSD_CODE : "Reply"}
          busy={busy}
          onType={setTyped}
          onKey={(k) => setTyped((t) => t + k)}
          onSend={send}
          onDelete={() => setTyped((t) => t.slice(0, -1))}
          onEnd={() => {
            setTyped("");
            hangUp();
          }}
        />
      </div>
    </>
  );
}

type PhoneProps = {
  screen: string;
  typed: string;
  placeholder: string;
  busy: boolean;
  onType: (text: string) => void;
  onKey: (key: string) => void;
  onSend: () => void;
  onDelete: () => void;
  onEnd: () => void;
};

/**
 * A basic keypad phone, the kind most farmers in Eastern Rwanda carry. The body stays
 * dark in both themes, as a real handset would; the screen is an LCD with a text field
 * so the keyboard works as well as the keypad.
 */
function FeaturePhone({ screen, typed, placeholder, busy, onType, onKey, onSend, onDelete, onEnd }: PhoneProps) {
  // Soft keys are blank, as on a real handset: the screen labels them.
  const softKey = "h-2.5 w-12 rounded-full bg-gradient-to-b from-[#4a4e53] to-[#2c2f33] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_2px_rgba(0,0,0,0.5)] active:translate-y-px disabled:opacity-60";
  return (
    <div className="mx-auto w-full max-w-[280px] select-none rounded-[38px] ring-1 ring-white/10 bg-gradient-to-b from-[#34383c] via-[#24272a] to-[#1a1c1e] p-3 pb-5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]">
      <div className="mx-auto mt-1 mb-2.5 h-1.5 w-14 rounded-full bg-[#0d0e0f] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />

      <div className="rounded-[14px] bg-[#0d0e0f] p-2 shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)]">
        <div className="rounded-[6px] bg-gradient-to-b from-[#d3dcc6] to-[#c2ccb4] px-2.5 pt-1.5 pb-2 font-mono text-[#1d2a1a] shadow-[inset_0_0_12px_rgba(40,55,30,0.25)]">
          <div className="flex items-center justify-between text-[10px] font-semibold">
            <span className="flex items-end gap-[2px]" aria-hidden>
              {[4, 6, 8, 10].map((h) => (
                <span key={h} className="w-[3px] rounded-[1px] bg-[#1d2a1a]" style={{ height: h }} />
              ))}
            </span>
            <span>MTN RW</span>
            <span className="flex items-center" aria-hidden>
              <span className="flex h-[9px] w-[18px] gap-[1px] rounded-[2px] border border-[#1d2a1a] p-[1px]">
                <span className="flex-1 bg-[#1d2a1a]" />
                <span className="flex-1 bg-[#1d2a1a]" />
                <span className="flex-1 bg-[#1d2a1a]" />
              </span>
              <span className="h-[4px] w-[2px] bg-[#1d2a1a]" />
            </span>
          </div>
          <div className="my-1 border-t border-[#1d2a1a]/30" />
          <div className="tabular h-[200px] overflow-y-auto whitespace-pre-line text-[12.5px] leading-snug" aria-live="polite">
            {screen}
          </div>
          <input
            aria-label="Phone input"
            value={typed}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            placeholder={placeholder}
            className="tabular mt-1 w-full border-b border-dashed border-[#1d2a1a]/50 bg-transparent px-0.5 py-0.5 text-[13px] text-[#1d2a1a] outline-none placeholder:text-[#1d2a1a]/45 focus:border-solid focus:border-[#1d2a1a]"
          />
          <div className="mt-1.5 flex justify-between text-[10px] font-bold uppercase">
            <span>Send</span>
            <span>Clear</span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-1">
        <div className="flex flex-col items-start gap-2">
          <button onClick={onSend} disabled={busy} className={softKey}>
            <span className="sr-only">Send</span>
          </button>
          <button
            onClick={onSend}
            disabled={busy}
            aria-label="Call"
            className="flex h-8 w-12 items-center justify-center rounded-full bg-gradient-to-b from-[#3fa34d] to-[#2a7a36] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] active:translate-y-px disabled:opacity-60"
          >
            <Phone size={15} fill="currentColor" />
          </button>
        </div>
        <button
          onClick={onSend}
          disabled={busy}
          aria-label="OK"
          className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-gradient-to-b from-[#45494d] to-[#2a2d30] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_4px_rgba(0,0,0,0.5)] active:translate-y-px disabled:opacity-60"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1f2124] text-[10px] font-bold text-[#c9ccd0] shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
            OK
          </span>
        </button>
        <div className="flex flex-col items-end gap-2">
          <button onClick={onDelete} className={softKey}>
            <span className="sr-only">Clear</span>
          </button>
          <button
            onClick={onEnd}
            aria-label="End call"
            className="flex h-8 w-12 items-center justify-center rounded-full bg-gradient-to-b from-[#d24a40] to-[#a1302a] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] active:translate-y-px"
          >
            <PhoneOff size={15} />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-x-2.5 gap-y-2 px-1">
        {KEYS.map(([k, letters]) => (
          <button
            key={k}
            onClick={() => onKey(k)}
            aria-label={k}
            className="flex h-10 flex-col items-center justify-center rounded-[12px] bg-gradient-to-b from-[#40444a] to-[#2c2f33] leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_2px_3px_rgba(0,0,0,0.5)] hover:from-[#4a4f55] active:translate-y-px"
          >
            <span className="tabular text-[17px] font-semibold">{k}</span>
            <span className="mt-0.5 h-[9px] text-[8.5px] uppercase tracking-wider text-[#9aa0a6]">{letters}</span>
          </button>
        ))}
      </div>

      <div className="mx-auto mt-4 flex w-10 justify-between" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1 w-1 rounded-full bg-[#0d0e0f]" />
        ))}
      </div>
    </div>
  );
}
