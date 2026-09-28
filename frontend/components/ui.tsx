import type { ReactNode } from "react";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{children}</p>}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      {title && <h2 className="mb-4 text-sm font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function Loading() {
  return <div className="py-12 text-center text-sm text-muted">Loading…</div>;
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-drought/30 bg-drought-soft p-4 text-sm text-drought">
      {message}. Check that the backend is running and NEXT_PUBLIC_API_URL is correct.
    </div>
  );
}
