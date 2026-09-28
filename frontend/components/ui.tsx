import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        {eyebrow && (
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-accent">{eyebrow}</div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {children && <p className="mt-2 text-sm leading-6 text-muted">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="mt-1 text-xs leading-5 text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  neutral: "bg-surface-2",
  accent: "bg-accent-soft",
  drought: "bg-drought-soft",
  pay: "bg-pay-soft",
  good: "bg-good-soft",
  other: "bg-other-soft",
} as const;
const DOTS = {
  neutral: "bg-faint",
  accent: "bg-accent",
  drought: "bg-drought",
  pay: "bg-pay",
  good: "bg-good",
  other: "bg-other",
} as const;
export type Tone = keyof typeof TONES;

/** A label with a coloured dot; the text stays in ink so colour never carries meaning alone. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium text-ink ${TONES[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[tone]}`} />
      {children}
    </span>
  );
}

export function LegendDot({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
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
