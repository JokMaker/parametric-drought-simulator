import { anomalyLabel, classify, OUTCOME_LABEL, pct, reason, signedPct } from "@/lib/payout";
import type { ModelSummary, Simulation } from "@/lib/types";

// Yield-change range drawn on the payout scale: better on the left, worse on the right.
const BEST = 30;
const WORST = -40;
const pos = (x: number) => ((BEST - Math.min(BEST, Math.max(WORST, x))) / (BEST - WORST)) * 100;

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-line p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="tabular mt-1 text-lg font-semibold">{value}</div>
      <div className="tabular text-xs text-muted">{sub}</div>
    </div>
  );
}

function PayoutScale({
  index,
  actual,
  trigger,
  exit,
}: {
  index: number;
  actual: number | null;
  trigger: number;
  exit: number;
}) {
  return (
    <div className="pt-8 pb-10">
      <div className="relative h-3 rounded-full">
        <div
          className="absolute inset-y-0 left-0 rounded-l-full bg-accent-soft"
          style={{ width: `${pos(trigger)}%` }}
        />
        <div
          className="absolute inset-y-0 bg-pay-soft"
          style={{ left: `${pos(trigger)}%`, width: `${pos(exit) - pos(trigger)}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-full bg-drought-soft"
          style={{ left: `${pos(exit)}%` }}
        />
        {[
          { x: trigger, label: `Trigger ${trigger}%` },
          { x: exit, label: `Exit ${exit}%` },
        ].map((t) => (
          <div key={t.label} className="absolute -top-1 h-5 border-l border-dashed border-ink/50" style={{ left: `${pos(t.x)}%` }}>
            <span className="absolute top-6 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted">
              {t.label}
            </span>
          </div>
        ))}
        <Marker x={index} label={`Index ${index.toFixed(1)}%`} className="bg-ink" above />
        {actual !== null && (
          <Marker x={actual} label={`Actual ${actual.toFixed(1)}%`} className="bg-drought" />
        )}
      </div>
      <div className="mt-14 flex justify-between text-[11px] text-muted">
        <span>No payout</span>
        <span>Partial payout</span>
        <span>Full payout</span>
      </div>
    </div>
  );
}

function Marker({
  x,
  label,
  className,
  above,
}: {
  x: number;
  label: string;
  className: string;
  above?: boolean;
}) {
  // Keep labels near either end of the scale inside the card.
  const p = pos(x);
  const align = p > 85 ? "-translate-x-full" : p < 15 ? "translate-x-0" : "-translate-x-1/2";
  return (
    <div className="absolute top-1/2" style={{ left: `${p}%` }}>
      <div className={`h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface ${className}`} />
      <span
        className={`tabular absolute whitespace-nowrap text-xs font-medium ${align} ${
          above ? "-top-7" : "top-9"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export default function PayoutPanel({ sim, model }: { sim: Simulation; model: ModelSummary }) {
  const { trigger, exit } = model;
  const outcome = classify(sim, model);
  const paid = sim.payout > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Rainfall" value={anomalyLabel(sim.rainZ)} sub={`z = ${sim.rainZ.toFixed(2)}`} />
        <Tile label="Vegetation (NDVI)" value={anomalyLabel(sim.ndviZ)} sub={`z = ${sim.ndviZ.toFixed(2)}`} />
        <Tile label="Predicted yield change (index)" value={signedPct(sim.index)} sub={`${model.model} model`} />
      </div>
      <p className="text-xs text-muted">
        Anomalies are measured in standard deviations from the district&apos;s own long-term average.
      </p>

      <div
        className={`rounded-lg border p-5 ${
          paid ? "border-pay/30 bg-pay-soft" : "border-line bg-surface"
        }`}
      >
        <div className="text-xs font-medium text-muted">Simulated payout</div>
        <div className={`tabular text-5xl font-semibold tracking-tight ${paid ? "text-pay" : ""}`}>
          {pct(sim.payout)}
        </div>
        <div className="text-xs text-muted">of the full payout</div>
        <p className="mt-3 max-w-2xl text-sm leading-6">{reason(sim, trigger, exit)}</p>
      </div>

      <div className="rounded-lg border border-line bg-surface px-5">
        <PayoutScale index={sim.index} actual={sim.actualYieldAnom} trigger={trigger} exit={exit} />
      </div>

      {sim.actualYieldAnom !== null && sim.payoutIfActual !== null && outcome ? (
        <div
          className={`rounded-lg border p-5 ${
            outcome === "miss" || outcome === "false-payout"
              ? "border-drought/30 bg-drought-soft"
              : "border-accent/30 bg-accent-soft"
          }`}
        >
          <div className="text-sm font-semibold">Check against actual yield: {OUTCOME_LABEL[outcome]}</div>
          <p className="mt-1 text-xs text-muted">
            A season counts as poor when the actual yield change is {model.lowYieldThreshold}% or
            worse.
          </p>
          <div className="tabular mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted">Actual yield change</div>
              <div className="font-semibold">{signedPct(sim.actualYieldAnom)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Payout the actual yield implies</div>
              <div className="font-semibold">{pct(sim.payoutIfActual)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Gap (basis risk this season)</div>
              <div className="font-semibold">{pct(Math.abs(sim.payout - sim.payoutIfActual))}</div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">
          No NISR yield record for this season. This is a satellite-only backtest, so the payout
          cannot be compared with actual losses.
        </p>
      )}
    </div>
  );
}
