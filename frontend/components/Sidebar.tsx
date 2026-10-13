"use client";

import {
  CloudRain,
  LayoutDashboard,
  Map as MapIcon,
  MapPin,
  Menu,
  Scale,
  Sprout,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { isApiUp, USE_MOCK } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import ThemeToggle from "./ThemeToggle";

const NAV: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
  { href: "/", label: "Overview", hint: "Model and validation", icon: LayoutDashboard },
  { href: "/map", label: "Drought Map", hint: "Districts on the map by season", icon: MapIcon },
  { href: "/explorer", label: "District Explorer", hint: "Payout by district and season", icon: MapPin },
  { href: "/history", label: "Drought History", hint: "Backtest since 2000", icon: CloudRain },
  { href: "/basis-risk", label: "Basis Risk", hint: "Index against actual losses", icon: Scale },
];

const DEMOS = [
  { label: "Good catch", detail: "Rwamagana 2023", district: "Rwamagana", season: 2023, tone: "bg-good" },
  { label: "Missed season", detail: "Gatsibo 2022", district: "Gatsibo", season: 2022, tone: "bg-drought" },
  { label: "Drought year", detail: "Kirehe 2017", district: "Kirehe", season: 2017, tone: "bg-pay" },
];

function DataStatus() {
  const { data: up, loading } = useApi("health", isApiUp);
  const [dot, text] = USE_MOCK
    ? ["bg-pay", "Saved notebook results"]
    : loading
      ? ["bg-faint", "Connecting…"]
      : up
        ? ["bg-good", "Live API connected"]
        : ["bg-drought", "API offline"];
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {text}
    </div>
  );
}

function DemoLinks({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <ul className="space-y-0.5">
      {DEMOS.map((d) => {
        const active =
          pathname === "/explorer" &&
          params.get("district") === d.district &&
          params.get("season") === String(d.season);
        return (
          <li key={d.detail}>
            <Link
              href={`/explorer?district=${d.district}&season=${d.season}`}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${d.tone}`} />
              <span className="flex-1">{d.label}</span>
              <span className="text-xs text-faint">{d.detail}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function NavContent({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-3 px-3 py-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-ink">
          <Sprout size={18} />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold">Drought Index</span>
          <span className="block text-xs text-muted">Eastern Rwanda · Maize</span>
        </span>
      </Link>

      <nav className="mt-8">
        <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-faint">
          Dashboard
        </div>
        <ul className="space-y-0.5">
          {NAV.map(({ href, label, hint, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-start gap-3 rounded-lg px-3 py-2 transition-colors ${
                    active ? "bg-accent-soft" : "hover:bg-surface-2"
                  }`}
                >
                  <Icon
                    size={18}
                    className={`mt-0.5 shrink-0 ${active ? "text-accent" : "text-faint group-hover:text-ink"}`}
                  />
                  <span className="leading-tight">
                    <span className={`block text-sm ${active ? "font-semibold text-ink" : "text-ink/85"}`}>
                      {label}
                    </span>
                    <span className="block text-xs text-muted">{hint}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-8">
        <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-faint">
          Demo cases
        </div>
        <Suspense>
          <DemoLinks onNavigate={onNavigate} />
        </Suspense>
      </div>

      <div className="mt-auto space-y-1 border-t border-line pt-4">
        <DataStatus />
        <ThemeToggle />
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-line bg-surface px-3 py-5 lg:block">
        <NavContent onNavigate={() => {}} />
      </aside>

      {/* Mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-ink">
            <Sprout size={15} />
          </span>
          Drought Index
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-muted hover:bg-surface-2"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface px-3 py-5 shadow-xl">
            <button
              onClick={close}
              className="absolute right-3 top-4 rounded-lg p-2 text-muted hover:bg-surface-2"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <NavContent onNavigate={close} />
          </aside>
        </div>
      )}
    </>
  );
}
