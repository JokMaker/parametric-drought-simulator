import type { ColorClass } from "@/lib/scales";

/** Swatch legend for a class scale: every colour shown with its range and meaning. */
export default function ClassLegend({ title, classes }: { title: string; classes: ColorClass[] }) {
  return (
    <figure className="text-xs">
      <figcaption className="mb-2 font-medium text-muted">{title}</figcaption>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
        {classes.map((c) => (
          <li key={c.key} className="flex items-center gap-2">
            <span className="h-3 w-5 shrink-0 border border-ink/10" style={{ background: c.color }} />
            <span className="tabular text-ink">{c.range}</span>
            <span className="text-muted">{c.label}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
