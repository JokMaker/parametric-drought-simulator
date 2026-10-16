import { AlertTriangle, Info } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>
      {children}
    </header>
  );
}

/**
 * One self-contained panel. `label` names the topic; `title` states the finding,
 * so the card tells its story before the reader looks at the chart. The method
 * note (`source`) stays folded away: the chart itself should be enough to read.
 */
export function Card({
  label,
  title,
  action,
  source,
  children,
  className = "",
}: {
  label?: string;
  title?: ReactNode;
  action?: ReactNode;
  source?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(label || title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 sm:px-6">
          <div className="min-w-0">
            {label && <div className="text-[13px] font-medium text-muted">{label}</div>}
            {title && <h2 className="mt-0.5 text-[17px] font-semibold leading-snug">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      <div className="px-5 py-4 sm:px-6">{children}</div>
      {source && (
        <details className="group border-t border-line px-5 py-2 text-xs text-muted sm:px-6">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-faint hover:text-ink [&::-webkit-details-marker]:hidden">
            <Info size={13} />
            Source &amp; method
          </summary>
          <p className="mt-1.5 max-w-3xl leading-5">{source}</p>
        </details>
      )}
    </section>
  );
}

/** A row of headline figures, divided like an instrument panel. `viz` shows the figure as a picture. */
export function StatStrip({
  items,
}: {
  items: { value: ReactNode; label: string; note?: ReactNode; viz?: ReactNode }[];
}) {
  return (
    <section
      className={`grid gap-px overflow-hidden rounded-md border border-line bg-line ${
        items.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 md:grid-cols-4"
      }`}
    >
      {items.map((it) => (
        <div key={it.label} className="bg-surface px-5 py-4">
          <div className="tabular text-[28px] font-semibold leading-none tracking-tight">{it.value}</div>
          <div className="mt-2 text-[13px] leading-snug text-ink">{it.label}</div>
          {it.viz && <div className="mt-2.5">{it.viz}</div>}
          {it.note && <div className="mt-1 text-xs text-muted">{it.note}</div>}
        </div>
      ))}
    </section>
  );
}

/** Underlined tabs, as used for map layers in drought portals. */
export function Tabs<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 border-b border-line">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
            value === o.key ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** `filled` of `total` as a row of dots: a count readers can see without reading. */
export function DotCount({ filled, total, color = "var(--ink)" }: { filled: number; total: number; color?: string }) {
  return (
    <div className="flex flex-wrap gap-[3px]" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full"
          style={i < filled ? { background: color } : { boxShadow: "inset 0 0 0 1px var(--faint)" }}
        />
      ))}
    </div>
  );
}

/** Two shares side by side as bars, e.g. drought years against other years. */
export function ShareBars({ rows }: { rows: { label: string; share: number; color: string }[] }) {
  return (
    <div className="space-y-1" aria-hidden>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[52px_1fr_30px] items-center gap-2 text-[11px] text-muted">
          <span>{r.label}</span>
          <div className="h-2 bg-surface-2">
            <div className="h-full" style={{ width: `${r.share * 100}%`, background: r.color }} />
          </div>
          <span className="tabular text-right text-ink">{Math.round(r.share * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

export type Tone = "neutral" | "accent" | "drought" | "pay" | "good" | "other";

const TAG = {
  neutral: "border-line text-muted",
  accent: "border-accent/40 text-accent",
  drought: "border-drought/40 text-drought",
  pay: "border-pay/40 text-ink",
  good: "border-good/40 text-ink",
  other: "border-other/40 text-ink",
} as const;

/** A small outlined tag. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-sm border px-1.5 py-px text-xs ${TAG[tone]}`}>
      {children}
    </span>
  );
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card h-28 animate-pulse bg-surface-2" />
      ))}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="card flex items-start gap-3 border-drought/40 p-5 text-sm">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-drought" />
      <div>
        <div className="font-medium">{message}</div>
        <div className="mt-1 text-muted">
          Check that the backend is running and NEXT_PUBLIC_API_URL points to it.
        </div>
      </div>
    </div>
  );
}
