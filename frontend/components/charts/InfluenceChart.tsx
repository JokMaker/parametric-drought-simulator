import { CloudRain, Leaf } from "lucide-react";

// FR8: which input moves the index most. Inputs are standardised, so the
// coefficient sizes are directly comparable.
export default function InfluenceChart({ rain, ndvi }: { rain: number; ndvi: number }) {
  const total = Math.abs(rain) + Math.abs(ndvi);
  const rows = [
    { label: "Rainfall", coef: rain, icon: CloudRain },
    { label: "Vegetation (NDVI)", coef: ndvi, icon: Leaf },
  ];
  return (
    <div className="space-y-5">
      {rows.map(({ label, coef, icon: Icon }) => {
        const share = total ? Math.abs(coef) / total : 0;
        return (
          <div key={label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 text-sm">
                <Icon size={15} className="text-muted" />
                {label}
              </span>
              <span className="tabular text-2xl font-semibold tracking-tight">
                {(share * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${share * 100}%` }} />
            </div>
            <div className="tabular mt-1 text-xs text-faint">
              Coefficient {coef > 0 ? "+" : ""}
              {coef.toFixed(2)}
            </div>
          </div>
        );
      })}
      <p className="text-xs leading-5 text-muted">
        Rainfall one standard deviation lower (measured across the 21 calibration seasons) lowers
        the predicted yield by {Math.abs(rain).toFixed(1)} percentage points. The same change in
        vegetation moves it by {Math.abs(ndvi).toFixed(1)}.
      </p>
    </div>
  );
}
