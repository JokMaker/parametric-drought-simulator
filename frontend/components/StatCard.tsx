import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export default function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted">{label}</div>
        {Icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-2 text-muted">
            <Icon size={15} />
          </span>
        )}
      </div>
      <div className="tabular mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs leading-5 text-muted">{hint}</div>}
      {children}
    </div>
  );
}
