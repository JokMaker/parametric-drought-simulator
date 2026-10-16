import { type ColorClass, indexClasses } from "@/lib/scales";

/**
 * Stepped colour ramp, read like a ruler: each class sits in order with its name
 * and range under it. `bracket` marks a run of classes, e.g. the payout zone.
 */
export default function ClassLegend({
  classes,
  reverse = false,
  bracket,
}: {
  classes: ColorClass[];
  reverse?: boolean;
  bracket?: { keys: string[]; label: string };
}) {
  const list = reverse ? [...classes].reverse() : classes;
  const inBracket = (c: ColorClass) => bracket?.keys.includes(c.key);
  const first = list.findIndex((c) => inBracket(c));
  const span = list.filter((c) => inBracket(c)).length;
  return (
    <figure className="text-[11px]" aria-label="Colour key">
      {bracket && first >= 0 && (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${list.length}, 1fr)` }}>
          <div
            className="mb-1 border-x border-t border-ink/50 pt-0.5 text-center font-medium text-ink"
            style={{ gridColumn: `${first + 1} / span ${span}` }}
          >
            {bracket.label}
          </div>
        </div>
      )}
      <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${list.length}, 1fr)` }}>
        {list.map((c) => (
          <div key={c.key} className="min-w-0">
            <div className="h-3" style={{ background: c.color, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.06)" }} />
            <div className="mt-1 truncate pr-1 text-ink" title={c.label}>{c.label}</div>
            <div className="tabular truncate pr-1 text-faint">{c.range}</div>
          </div>
        ))}
      </div>
    </figure>
  );
}

/** The predicted-yield ramp, worst on the left, with the payout zone bracketed. */
export function IndexLegend({ trigger, exit }: { trigger: number; exit: number }) {
  return (
    <ClassLegend
      classes={indexClasses(trigger, exit)}
      reverse
      bracket={{ keys: ["watch", "moderate", "severe", "extreme"], label: "Payout zone" }}
    />
  );
}
