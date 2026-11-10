"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

const WIDTH = 256;

/** A small ⓘ that explains a term in one plain sentence. Hover or focus shows it on a laptop,
 *  a tap shows it on a phone; Escape, a tap elsewhere or moving away hides it. The note is
 *  placed in the viewport, so it never widens the page. */
export default function Term({ k }: { k: GlossaryKey }) {
  const { term, text } = GLOSSARY[k];
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);

  function show() {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - 8);
    setAt({ top: r.bottom + 6, left });
  }
  const hide = () => setAt(null);

  useEffect(() => {
    if (!at) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "pointerdown" && button.current?.contains(e.target as Node)) return;
      hide();
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", hide, true);
    };
  }, [at]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={`What is ${term.toLowerCase()}?`}
        aria-describedby={at ? id : undefined}
        aria-expanded={!!at}
        onClick={show}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="ml-1 inline-flex translate-y-[2px] align-baseline text-faint hover:text-ink focus-visible:text-ink"
      >
        <Info size={13} />
      </button>
      {at && (
        <span
          id={id}
          role="tooltip"
          style={{ top: at.top, left: at.left, width: WIDTH }}
          className="card fixed z-50 block px-3 py-2 text-left text-xs font-normal leading-5 text-ink shadow-lg"
        >
          <span className="block font-semibold">{term}</span>
          {text}
        </span>
      )}
    </>
  );
}
