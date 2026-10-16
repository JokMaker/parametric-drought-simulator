"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { FIRST_SEASON, isDroughtSeason, LAST_SEASON, SEASONS, YIELD_SEASONS } from "@/lib/constants";

/** Season A years as a scrollable strip; marks seasons with yield data and drought years. */
export default function SeasonTimeline({ season, onSelect }: { season: number; onSelect: (s: number) => void }) {
  const selected = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    // Jump straight to the season on first load; animate later changes.
    selected.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: mounted.current ? "smooth" : "instant",
    });
    mounted.current = true;
  }, [season]);

  const step = (d: number) => onSelect(Math.min(LAST_SEASON, Math.max(FIRST_SEASON, season + d)));

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => step(-1)}
        disabled={season <= FIRST_SEASON}
        className="rounded-sm border border-line p-1.5 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
        aria-label="Previous season"
      >
        <ChevronLeft size={16} />
      </button>
      <div className="no-scrollbar flex flex-1 gap-1 overflow-x-auto py-1">
        {SEASONS.map((y) => {
          const active = y === season;
          const drought = isDroughtSeason(y);
          const hasYield = YIELD_SEASONS.includes(y);
          return (
            <button
              key={y}
              ref={active ? selected : undefined}
              onClick={() => onSelect(y)}
              aria-pressed={active}
              title={`Season A ${y}${hasYield ? " · yield data" : ""}${drought ? " · documented drought" : ""}`}
              className={`relative flex min-w-[48px] flex-col items-center rounded-sm px-2 pt-2 pb-1.5 text-xs transition-colors ${
                active ? "bg-ink font-semibold text-surface" : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {drought && (
                <span className={`absolute inset-x-2 top-0.5 h-0.5 rounded-full ${active ? "bg-surface/70" : "bg-drought"}`} />
              )}
              <span className="tabular">{y}</span>
              <span
                className={`mt-1 h-1.5 w-1.5 rounded-full ${
                  hasYield ? (active ? "bg-surface" : "bg-ink/70") : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>
      <button
        onClick={() => step(1)}
        disabled={season >= LAST_SEASON}
        className="rounded-sm border border-line p-1.5 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
        aria-label="Next season"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
