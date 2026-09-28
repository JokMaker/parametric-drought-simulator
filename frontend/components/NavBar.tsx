"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/explorer", label: "District Explorer" },
  { href: "/history", label: "Drought History" },
  { href: "/basis-risk", label: "Basis Risk" },
] as const;

export default function NavBar() {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Drought Index Simulator
          <span className="ml-2 font-normal text-muted">Eastern Rwanda · Maize</span>
        </Link>
        <nav className="flex flex-wrap gap-1 text-sm">
          {LINKS.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
