import type { ValidationRow } from "@/lib/types";
import { Badge } from "./ui";

export default function ValidationTable({ rows, selected }: { rows: ValidationRow[]; selected: string }) {
  const schemes = [...new Set(rows.map((r) => r.scheme))];
  return (
    <div className="space-y-5">
      {schemes.map((scheme) => (
        <div key={scheme} className="overflow-x-auto">
          <div className="mb-2 text-xs font-medium text-muted">{scheme}</div>
          <table className="tabular w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-faint">
                <th className="pb-2 font-medium">Model</th>
                <th className="pb-2 text-right font-medium">RMSE</th>
                <th className="pb-2 text-right font-medium">MAE</th>
                <th className="pb-2 text-right font-medium">R²</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => r.scheme === scheme)
                .map((r) => {
                  const isSelected = r.model === selected;
                  return (
                    <tr key={r.model} className={`border-t border-line ${isSelected ? "bg-accent-soft/60" : ""}`}>
                      <td className={`py-2.5 pl-2 ${isSelected ? "font-semibold" : ""}`}>
                        <span className="flex items-center gap-2">
                          {r.model}
                          {isSelected && <Badge tone="accent">selected</Badge>}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">{r.rmse.toFixed(1)}</td>
                      <td className="py-2.5 text-right">{r.mae.toFixed(1)}</td>
                      <td className="py-2.5 pr-2 text-right">
                        <span className={r.r2 < 0 ? "font-medium text-drought" : ""}>{r.r2.toFixed(2)}</span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
