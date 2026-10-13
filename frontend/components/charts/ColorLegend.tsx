/** A continuous colour scale with labelled ticks (0 = left end, 1 = right end). */
export default function ColorLegend({
  title,
  gradient,
  ticks,
}: {
  title: string;
  gradient: string;
  ticks: { at: number; label: string }[];
}) {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-1.5 text-xs font-medium text-muted">{title}</div>
      <div className="h-2.5 rounded-full" style={{ background: gradient }} />
      <div className="tabular relative mt-1 h-4 text-[11px] text-muted">
        {ticks.map((t) => (
          <span
            key={t.label}
            className="absolute whitespace-nowrap"
            style={{
              left: `${t.at * 100}%`,
              transform: t.at <= 0 ? "none" : t.at >= 1 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}
