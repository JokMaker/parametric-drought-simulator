"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n";

// Pages written for farmers, translated in full. The analysis pages are for insurers
// and analysts and stay in English; in Kinyarwanda they say so and point to these.
const TRANSLATED = ["/farmer", "/ussd", "/policies", "/privacy"];

export default function LanguageNote() {
  const lang = useLang();
  const pathname = usePathname();
  if (lang !== "rw" || TRANSLATED.some((p) => pathname.startsWith(p))) return null;
  return (
    <div lang="rw" className="border-b border-line bg-surface-2 px-4 py-1.5 text-center text-xs text-muted print:hidden">
      Iyi paji y&apos;isesengura iri mu Cyongereza. Paji z&apos;abahinzi ziri mu Kinyarwanda:{" "}
      <Link href="/farmer" className="font-medium text-accent hover:underline">Urupapuro rw&apos;umuhinzi</Link>,{" "}
      <Link href="/ussd" className="font-medium text-accent hover:underline">Menu ya USSD</Link>,{" "}
      <Link href="/policies" className="font-medium text-accent hover:underline">Ubwishingizi bwatanzwe</Link>.
    </div>
  );
}
