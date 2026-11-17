"use client";

import { ArrowRight, BarChart3, Sprout } from "lucide-react";
import Link from "next/link";
import { USSD_CODE } from "@/lib/constants";
import { useT } from "@/lib/i18n";

/** Two ways in, so a first-time visitor knows where to start. */
export default function StartHere() {
  const { t } = useT();
  const paths = [
    {
      icon: Sprout,
      who: t("Farmer", "Umuhinzi"),
      lead: t("See your cover and what the index paid you", "Reba ubwishingizi bwawe n'ingurane igipimo cyakwishyuye"),
      href: "/farmer",
      cta: t("Check a policy", "Reba ubwishingizi"),
      alt: { href: "/ussd", text: t(`or dial ${USSD_CODE} on a basic phone`, `cyangwa ukande ${USSD_CODE} kuri telefoni isanzwe`) },
    },
    {
      icon: BarChart3,
      who: t("Analyst or insurer", "Umusesenguzi cyangwa ikigo cy'ubwishingizi"),
      lead: t("See which districts the index pays, and how often it is wrong", "Reba uturere igipimo cyishyura, n'inshuro kibeshya"),
      href: "/map",
      cta: t("Open the drought map", "Fungura ikarita y'amapfa"),
      alt: { href: "/basis-risk", text: t("or check the basis risk", "cyangwa urebe ikinyuranyo cy'ingurane") },
    },
  ];
  return (
    <section aria-label={t("Start here", "Tangira hano")} className="grid gap-3 sm:grid-cols-2">
      {paths.map(({ icon: Icon, who, lead, href, cta, alt }) => (
        <div key={href} className="card flex items-start gap-3 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-muted">{who}</div>
            <p className="mt-0.5 text-[15px] font-semibold leading-snug">{lead}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              <Link href={href} className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-1.5 font-medium text-surface hover:opacity-90">
                {cta}
                <ArrowRight size={14} />
              </Link>
              <Link href={alt.href} className="tabular text-accent hover:underline">
                {alt.text}
              </Link>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
