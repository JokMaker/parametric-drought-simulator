import type { ValidationRow } from "@/lib/types";

export default function ValidationTable({ rows, selected }: { rows: ValidationRow[]; selected: string }) {
  const schemes = [...new Set(rows.map((r) => r.scheme))];
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-2 pr-4 font-medium">Validation</th>
            <th className="py-2 pr-4 font-medium">Model</th>
            <th className="py-2 pr-4 text-right font-medium">RMSE</th>
            <th className="py-2 pr-4 text-right font-medium">MAE</th>
            <th className="py-2 text-right font-medium">R²</th>
          </tr>
        </thead>
        <tbody>
          {schemes.map((scheme) =>
            rows
              .filter((r) => r.scheme === scheme)
              .map((r, i) => (
                <tr
                  key={`${scheme}-${r.model}`}
                  className={`border-b border-line last:border-0 ${r.model === selected ? "font-semibold" : ""}`}
                >
                  <td className="py-2 pr-4 text-muted">{i === 0 ? scheme : ""}</td>
                  <td className="py-2 pr-4">
                    {r.model}
                    {r.model === selected && (
                      <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
                        selected
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right">{r.rmse.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right">{r.mae.toFixed(1)}</td>
                  <td className={`py-2 text-right ${r.r2 < 0 ? "text-drought" : ""}`}>{r.r2.toFixed(2)}</td>
                </tr>
              )),
          )}
        </tbody>
      </table>
    </div>
  );
}
