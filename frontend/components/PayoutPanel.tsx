import { CheckCircle2, CircleAlert, CloudRain, Leaf, TrendingDown } from "lucide-react";
import { anomalyLabel, classify, OUTCOME_LABEL, pct, reason, signedPct } from "@/lib/payout";
import { indexColor, payoutColor } from "@/lib/scales";
import type { ModelSummary, Simulation } from "@/lib/types";

// Yield-change range drawn on the payout scale: better on the left, worse on the right.
const BEST = 30;
const WORST = -40;
const pos = (x: number) => ((BEST - Math.min(BEST, Math.max(WORST, x))) / (BEST - WORST)) * 100;

/** Half-circle gauge for the payout share. */
function Gauge({ value }: { value: number }) {
  const r = 80;
  const len = Math.PI * r;
  return (
    <svg viewBox="0 0 200 112" className="w-full max-w-[240px]" role="img" aria-label={`Payout ${pct(value)}`}>
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--surface-2)" strokeWidth="16" strokeLinecap="round" />
      {value > 0 && (
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--pay)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${len * value} ${len}`}
        />
      )}
      <text x="100" y="88" textAnchor="middle" className="tabular" fontSize="36" fontWeight="600" fill="var(--ink)">
        {pct(value)}
      </text>
      <text x="100" y="108" textAnchor="middle" fontSize="11" fill="var(--muted)">
        of the full payout
      </text>
    </svg>
  );
}

/** Anomaly as a bar growing left (below normal) or right (above) from a centre line. */
function AnomalyRow({ label, z, icon: Icon }: { label: string; z: number; icon: typeof CloudRain }) {
  const LIMIT = 2.5;
  const w = (Math.min(LIMIT, Math.abs(z)) / LIMIT) * 50;
  const below = z < 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-muted">
          <Icon size={15} />
          {label}
        </span>
        <span className="font-medium">{anomalyLabel(z)}</span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-surface-2">
        <div className="absolute inset-y-[-3px] left-1/2 w-px bg-line" />
        <div
          className={`absolute inset-y-0 rounded-full ${below ? "bg-drought" : "bg-other"}`}
          style={below ? { right: "50%", width: `${w}%` } : { left: "50%", width: `${w}%` }}
        />
      </div>
      <div className="tabular mt-1 flex justify-between text-[11px] text-faint">
        <span>Drier / less green</span>
        <span>z = {z.toFixed(2)}</span>
        <span>Wetter / greener</span>
      </div>
    </div>
  );
}

function Marker({ x, label, className, above }: { x: number; label: string; className: string; above?: boolean }) {
  const p = pos(x);
  // Keep labels near either end of the scale inside the card.
  const align = p > 85 ? "-translate-x-full" : p < 15 ? "translate-x-0" : "-translate-x-1/2";
  return (
    <div className="absolute top-1/2" style={{ left: `${p}%` }}>
      <div className={`h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow ${className}`} />
      <span
        className={`tabular absolute whitespace-nowrap text-xs font-medium ${align} ${above ? "-top-7" : "top-9"}`}
      >
        {label}
      </span>
    </div>
  );
}

function PayoutScale({ index, actual, trigger, exit }: { index: number; actual: number | null; trigger: number; exit: number }) {
  return (
    <div className="px-1 pt-8 pb-2">
      <div className="relative h-2.5 rounded-full">
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-good-soft" style={{ width: `${pos(trigger)}%` }} />
        <div
          className="absolute inset-y-0 bg-pay-soft"
          style={{ left: `${pos(trigger)}%`, width: `${pos(exit) - pos(trigger)}%` }}
        />
        <div className="absolute inset-y-0 right-0 rounded-r-full bg-drought-soft" style={{ left: `${pos(exit)}%` }} />
        {[
          { x: trigger, label: `Trigger ${trigger}%` },
          { x: exit, label: `Exit ${exit}%` },
        ].map((t) => (
          <div key={t.label} className="absolute -top-1.5 h-5 border-l border-dashed border-ink/40" style={{ left: `${pos(t.x)}%` }}>
            <span className="absolute top-6 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted">{t.label}</span>
          </div>
        ))}
        <Marker x={index} label={`Index ${index.toFixed(1)}%`} className="bg-ink" above />
        {actual !== null && <Marker x={actual} label={`Actual ${actual.toFixed(1)}%`} className="bg-drought" />}
      </div>
      <div className="mt-14 grid grid-cols-3 text-[11px] text-muted">
        <span>No payout</span>
        <span className="text-center">Partial payout</span>
        <span className="text-right">Full payout</span>
      </div>
    </div>
  );
}

/** Two values side by side on one scale, centred on zero when the scale has a negative side. */
function CompareBars({
  title,
  rows,
  min,
  max,
  color,
  format,
}: {
  title: string;
  rows: { label: string; value: number }[];
  min: number;
  max: number;
  color: (v: number) => string;
  format: (v: number) => string;
}) {
  const span = max - min;
  const zero = ((0 - min) / span) * 100;
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-muted">{title}</div>
      <div className="space-y-2">
        {rows.map((r) => {
          const v = Math.min(max, Math.max(min, r.value));
          const at = ((v - min) / span) * 100;
          return (
            <div key={r.label} className="grid grid-cols-[120px_1fr_64px] items-center gap-3 text-sm">
              <span className="text-muted">{r.label}</span>
              <div className="relative h-3.5 rounded bg-surface-2">
                {min < 0 && <div className="absolute inset-y-[-3px] w-px bg-line" style={{ left: `${zero}%` }} />}
                <div
                  className="absolute inset-y-0 rounded"
                  style={{
                    left: `${Math.min(zero, at)}%`,
                    width: `${Math.abs(at - zero)}%`,
                    background: color(r.value),
                  }}
                />
              </div>
              <span className="tabular text-right font-medium">{format(r.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PayoutPanel({ sim, model }: { sim: Simulation; model: ModelSummary }) {
  const { trigger, exit } = model;
  const outcome = classify(sim, model);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="card flex flex-col items-center p-6 text-center">
          <div className="self-start text-sm font-semibold">Simulated payout</div>
          <div className="mt-4 w-full">
            <div className="mx-auto w-fit">
              <Gauge value={sim.payout} />
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted">{reason(sim, trigger, exit)}</p>
        </section>

        <section className="card space-y-5 p-6">
          <div className="text-sm font-semibold">What the satellites saw</div>
          <AnomalyRow label="Rainfall (Oct–Dec)" z={sim.rainZ} icon={CloudRain} />
          <AnomalyRow label="Vegetation (NDVI)" z={sim.ndviZ} icon={Leaf} />
          <div className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-muted">
              <TrendingDown size={15} />
              Predicted yield change
            </span>
            <span className="tabular text-xl font-semibold">{signedPct(sim.index)}</span>
          </div>
          <p className="text-xs leading-5 text-faint">
            Anomalies are in standard deviations from the district&apos;s own long-term average.
            Predicted by the {model.model} model.
          </p>
        </section>
      </div>

      <section className="card p-6">
        <div className="text-sm font-semibold">Where the index sits</div>
        <PayoutScale index={sim.index} actual={sim.actualYieldAnom} trigger={trigger} exit={exit} />
      </section>

      {sim.actualYieldAnom !== null && sim.payoutIfActual !== null && outcome ? (
        <section className="card p-6">
          <div className="flex flex-wrap items-center gap-3">
            {outcome === "miss" || outcome === "false-payout" ? (
              <CircleAlert size={18} className="text-drought" />
            ) : (
              <CheckCircle2 size={18} className="text-good" />
            )}
            <div className="text-sm font-semibold">Check against the actual harvest</div>
            <span className="text-sm text-muted">· {OUTCOME_LABEL[outcome]}</span>
          </div>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <CompareBars
              title="Yield change: index against the harvest"
              rows={[
                { label: "Predicted (index)", value: sim.index },
                { label: "Actual harvest", value: sim.actualYieldAnom },
              ]}
              min={-50}
              max={50}
              color={indexColor}
              format={signedPct}
            />
            <CompareBars
              title="Payout: what the index paid against what the harvest called for"
              rows={[
                { label: "Index paid", value: sim.payout },
                { label: "Harvest called for", value: sim.payoutIfActual },
              ]}
              min={0}
              max={1}
              color={payoutColor}
              format={(v) => pct(v)}
            />
          </div>
          <div className="tabular mt-5 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Actual yield change", value: signedPct(sim.actualYieldAnom) },
              { label: "Payout the harvest implies", value: pct(sim.payoutIfActual) },
              { label: "Gap (basis risk)", value: pct(Math.abs(sim.payout - sim.payoutIfActual)) },
            ].map((m) => (
              <div key={m.label} className="rounded-lg bg-surface-2 px-4 py-3">
                <div className="text-xs text-muted">{m.label}</div>
                <div className="mt-1 text-xl font-semibold">{m.value}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-faint">
            A season counts as poor when the actual yield change is {model.lowYieldThreshold}% or worse.
          </p>
        </section>
      ) : (
        <p className="px-1 text-sm text-muted">
          No NISR yield record for this season. This is a satellite-only backtest, so the payout
          cannot be compared with actual losses.
        </p>
      )}
    </div>
  );
}
