import { useSyncExternalStore } from "react";
import { LANG_KEY as KEY } from "./langScript";

// The site language. Kept like the theme: on <html data-lang>, set before first paint
// from localStorage (see layout.tsx), and changed by the switch in the header.
// The farmer pages, navigation and privacy notice are translated; the analysis
// pages stay in English and say so.

export type Lang = "en" | "rw";

const EVENT = "langchange";

function current(): Lang {
  return document.documentElement.dataset.lang === "rw" ? "rw" : "en";
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function setLang(lang: Lang) {
  const html = document.documentElement;
  html.dataset.lang = lang;
  html.lang = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** The server always renders English; the browser switches after loading if Kinyarwanda was chosen. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, current, () => "en" as Lang);
}

/** `t(english, kinyarwanda)` picks the text for the current language. */
export function useT() {
  const lang = useLang();
  return { lang, t: (en: string, rw: string) => (lang === "rw" ? rw : en) };
}
