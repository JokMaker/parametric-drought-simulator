"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isApiUp, USE_MOCK } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/season", label: "This Season" },
  { href: "/map", label: "Drought Map" },
  { href: "/explorer", label: "District Explorer" },
  { href: "/history", label: "Drought History" },
  { href: "/basis-risk", label: "Basis Risk" },
  { href: "/field-checks", label: "Field Checks" },
  { href: "/pricing", label: "Pricing" },
  { href: "/farmer", label: "Farmer View" },
  { href: "/policies", label: "Policies" },
];

function DataStatus() {
  const { data: up, loading } = useApi("health", isApiUp);
  const [dot, text] = USE_MOCK
    ? ["bg-sev-watch", "Saved results"]
    : loading
      ? ["bg-header-ink/40", "Connecting"]
      : up
        ? ["bg-[#5ad17a]", "Live data"]
        : ["bg-drought", "API offline"];
  return (
    <span className="flex items-center gap-1.5 text-xs text-header-ink/80">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  );
}

export default function TopNav() {
  const pathname = usePathname();
  return (
    <header className="bg-header text-header-ink print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 pt-3 sm:px-6">
        <Link href="/" className="leading-tight">
          <span className="block text-[15px] font-semibold tracking-tight">Rwanda Drought Index</span>
          <span className="block text-xs text-header-ink/70">Season A maize · Eastern Province</span>
        </Link>
        <div className="flex items-center gap-4">
          <DataStatus />
          <ThemeToggle />
        </div>
      </div>
      <nav className="mx-auto mt-2 max-w-7xl overflow-x-auto px-2 sm:px-4" aria-label="Main">
        <ul className="flex min-w-max">
          {NAV.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`block border-b-[3px] px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "border-[#7fd19a] font-medium text-header-ink"
                      : "border-transparent text-header-ink/75 hover:text-header-ink"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
