// FR8: which input moves the index most. Inputs are standardised, so the
// coefficient sizes are directly comparable.
export default function InfluenceChart({ rain, ndvi }: { rain: number; ndvi: number }) {
  const total = Math.abs(rain) + Math.abs(ndvi);
  const rows = [
    { label: "Rainfall", coef: rain },
    { label: "Vegetation (NDVI)", coef: ndvi },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const share = total ? Math.abs(r.coef) / total : 0;
        return (
          <div key={r.label}>
            <div className="flex justify-between text-sm">
              <span>{r.label}</span>
              <span className="tabular text-muted">
                {r.coef > 0 ? "+" : ""}
                {r.coef.toFixed(2)} · {(share * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-canvas">
              <div className="h-full rounded-full bg-accent" style={{ width: `${share * 100}%` }} />
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
