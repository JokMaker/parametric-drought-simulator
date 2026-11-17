"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isApiUp, USE_MOCK } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";

// Two groups, so a farmer does not have to find their three pages among eleven
// (user testers found the single row of tabs confusing). Kinyarwanda labels are short
// names so the row still fits a laptop; each page title gives the full name.
const GROUPS = [
  {
    name: "Analysis",
    rw: "Isesengura",
    links: [
      { href: "/", label: "Overview", rw: "Incamake" },
      { href: "/season", label: "This Season", rw: "Iki gihembwe" },
      { href: "/map", label: "Drought Map", rw: "Ikarita" },
      { href: "/explorer", label: "District Explorer", rw: "Uturere" },
      { href: "/history", label: "Drought History", rw: "Amateka" },
      { href: "/basis-risk", label: "Basis Risk", rw: "Ikinyuranyo" },
      { href: "/field-checks", label: "Field Checks", rw: "Igenzura" },
      { href: "/pricing", label: "Pricing", rw: "Ibiciro" },
    ],
  },
  {
    name: "Farmers",
    rw: "Abahinzi",
    links: [
      { href: "/farmer", label: "Farmer View", rw: "Umuhinzi" },
      { href: "/ussd", label: "USSD Menu", rw: "USSD" },
      { href: "/policies", label: "Policies", rw: "Ubwishingizi" },
    ],
  },
];

const isActive = (href: string, pathname: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function DataStatus() {
  const { data: up, loading } = useApi("health", isApiUp);
  const { t } = useT();
  const [dot, text] = USE_MOCK
    ? ["bg-sev-watch", t("Saved results", "Ibisubizo byabitswe")]
    : loading
      ? ["bg-header-ink/40", t("Connecting", "Birahuza")]
      : up
        ? ["bg-[#5ad17a]", t("Live data", "Amakuru y'ako kanya")]
        : ["bg-drought", t("API offline", "API ntikora")];
  return (
    <span className="flex items-center gap-1.5 text-xs text-header-ink/80">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const { lang, t } = useT();
  const page = GROUPS.flatMap((g) => g.links).find((l) => isActive(l.href, pathname));
  const current = page ? (lang === "rw" ? page.rw : page.label) : "Menu";
  return (
    <nav className="mx-auto max-w-[1680px] px-4 pt-2 pb-2.5 sm:px-6 xl:hidden" aria-label="Main">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="flex w-full items-center justify-between rounded-sm border border-header-ink/20 px-3 py-2 text-sm text-header-ink"
      >
        <span>
          <span className="text-header-ink/60">{t("Page", "Paji")}: </span>
          <span className="font-medium">{current}</span>
        </span>
        <span className="flex items-center gap-1.5 text-header-ink/80">
          {open ? <X size={16} /> : <Menu size={16} />}
          {open ? t("Close", "Funga") : t("All pages", "Paji zose")}
        </span>
      </button>
      {open && (
        <div id="mobile-nav" className="mt-2 grid gap-x-6 gap-y-3 pb-1 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <div key={g.name}>
              <div className="px-3 pb-1 text-[10px] font-medium tracking-wider text-header-ink/50 uppercase" id={`mnav-${g.name}`}>
                {lang === "rw" ? g.rw : g.name}
              </div>
              <ul aria-labelledby={`mnav-${g.name}`}>
                {g.links.map(({ href, label, rw }) => {
                  const active = isActive(href, pathname);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`block rounded-sm border-l-[3px] px-3 py-2 text-sm ${
                          active ? "border-[#7fd19a] bg-header-ink/10 font-medium text-header-ink" : "border-transparent text-header-ink/80"
                        }`}
                      >
                        {lang === "rw" ? rw : label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}

export default function TopNav() {
  const pathname = usePathname();
  const { lang, t } = useT();
  return (
    <header className="bg-header text-header-ink print:hidden">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 pt-3 sm:px-6 lg:px-8">
        <Link href="/" className="leading-tight">
          <span className="block text-[15px] font-semibold tracking-tight">{t("Rwanda Drought Index", "Igipimo cy'amapfa mu Rwanda")}</span>
          <span className="block text-xs text-header-ink/70">
            {t("Season A maize · Eastern Province", "Ibigori by'Igihembwe A · Intara y'Iburasirazuba")}
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <DataStatus />
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
      {/* Laptops: both groups in one row, each under its own small heading. */}
      <nav className="mx-auto mt-1 hidden max-w-[1680px] px-4 xl:block xl:px-6" aria-label="Main">
        <div className="flex">
          {GROUPS.map((g, i) => (
            <div key={g.name} className={i ? "ml-3 border-l border-header-ink/15 pl-3" : ""}>
              <div className="px-2.5 text-[10px] font-medium tracking-wider text-header-ink/50 uppercase" id={`nav-${g.name}`}>
                {lang === "rw" ? g.rw : g.name}
              </div>
              <ul className="flex" aria-labelledby={`nav-${g.name}`}>
                {g.links.map(({ href, label, rw }) => {
                  const active = isActive(href, pathname);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={`block border-b-[3px] px-2.5 pt-1 pb-2.5 text-sm whitespace-nowrap transition-colors ${
                          active
                            ? "border-[#7fd19a] font-medium text-header-ink"
                            : "border-transparent text-header-ink/75 hover:text-header-ink"
                        }`}
                      >
                        {lang === "rw" ? rw : label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      {/* Phones and tablets: a menu button that opens the same two groups. */}
      <MobileNav pathname={pathname} />
    </header>
  );
}
