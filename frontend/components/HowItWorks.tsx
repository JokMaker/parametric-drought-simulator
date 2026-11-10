import { ArrowRight, Banknote, CloudRain, Leaf, Wheat } from "lucide-react";
import Term from "@/components/Term";
import type { GlossaryKey } from "@/lib/glossary";

/** The index in one line of pictures: two satellite inputs, one prediction, one payout. */
export default function HowItWorks({ trigger, exit }: { trigger: number; exit: number }) {
  const steps: { icon: typeof CloudRain; title: string; sub: string; info?: GlossaryKey }[] = [
    { icon: CloudRain, title: "Rainfall", sub: "CHIRPS, Oct–Dec" },
    { icon: Leaf, title: "Crop greenness", sub: "MODIS NDVI, Oct–Dec", info: "ndvi" },
    { icon: Wheat, title: "Predicted maize yield", sub: "change from normal", info: "index" },
    { icon: Banknote, title: "Payout", sub: `starts ${trigger}% · full ${exit}%`, info: "payoutRule" },
  ];
  return (
    <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4" aria-label="How the index works">
      {steps.map(({ icon: Icon, title, sub, info }, i) => (
        <li key={title} className="relative flex items-center gap-3 bg-surface px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent">
            <Icon size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm leading-snug font-medium sm:truncate">
              {title}
              {info && <Term k={info} />}
            </span>
            <span className="tabular block text-xs text-muted sm:truncate">{sub}</span>
          </span>
          {(i === 1 || i === 2) && (
            <ArrowRight size={14} className="absolute top-1/2 -right-[7px] z-10 hidden -translate-y-1/2 rounded-full bg-surface text-faint sm:block" />
          )}
        </li>
      ))}
    </ol>
  );
}
