// FR8: which input moves the index most. Inputs are standardised, so the
// coefficient sizes are directly comparable.
export default function InfluenceChart({ rain, ndvi }: { rain: number; ndvi: number }) {
  const total = Math.abs(rain) + Math.abs(ndvi);
  const rows = [
    { label: "Rainfall", coef: rain },
    { label: "Crop greenness (NDVI)", coef: ndvi },
  ];
  return (
    <div className="space-y-3">
      {rows.map(({ label, coef }) => {
        const share = total ? Math.abs(coef) / total : 0;
        return (
          <div key={label} className="grid grid-cols-[170px_1fr_150px] items-center gap-4 text-sm">
            <span>{label}</span>
            <div className="h-3 bg-surface-2">
              <div className="h-full bg-accent" style={{ width: `${share * 100}%` }} />
            </div>
            <span className="tabular text-right">
              <span className="font-semibold">{(share * 100).toFixed(0)}%</span>
              <span className="text-muted"> · {Math.abs(coef).toFixed(1)} pts per SD</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
