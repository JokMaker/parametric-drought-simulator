"use client";

import { useT } from "@/lib/i18n";

/** A short piece of text in the reader's language, for places that are not client components themselves. */
export default function Say({ en, rw }: { en: string; rw: string }) {
  return useT().t(en, rw);
}
