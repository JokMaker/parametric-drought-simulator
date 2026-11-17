"use client";

import { Languages } from "lucide-react";
import { setLang, useLang } from "@/lib/i18n";

/** English or Kinyarwanda for the whole site, remembered in this browser. */
export default function LanguageToggle() {
  const lang = useLang();
  return (
    <div className="flex items-center gap-1 text-xs" role="group" aria-label={lang === "rw" ? "Ururimi" : "Language"}>
      <Languages size={14} className="text-header-ink/70" aria-hidden />
      {(["en", "rw"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          lang={l}
          title={l === "en" ? "English" : "Kinyarwanda"}
          className={`rounded px-1.5 py-1 transition-colors ${
            lang === l ? "bg-header-ink/15 font-semibold text-header-ink" : "text-header-ink/70 hover:text-header-ink"
          }`}
        >
          {l === "en" ? "English" : "Kinyarwanda"}
        </button>
      ))}
    </div>
  );
}
