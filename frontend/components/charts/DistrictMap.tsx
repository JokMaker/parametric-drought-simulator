"use client";

import { geoArea, geoMercator, geoPath } from "d3-geo";
import { useMemo, useRef, useState, type ReactNode } from "react";
import type { DistrictShapes } from "@/lib/types";

const WIDTH = 600;

type Feature = DistrictShapes["features"][number];

/** d3 expects clockwise outer rings; GeoJSON files often use the opposite. */
function rewind(f: Feature): Feature {
  const g = f.geometry;
  if (g.type !== "Polygon" && g.type !== "MultiPolygon") return f;
  if (geoArea(f) <= 2 * Math.PI) return f;
  const flip = (rings: GeoJSON.Position[][]) => rings.map((r) => [...r].reverse());
  const geometry =
    g.type === "Polygon"
      ? { ...g, coordinates: flip(g.coordinates) }
      : { ...g, coordinates: g.coordinates.map(flip) };
  return { ...f, geometry } as Feature;
}

export default function DistrictMap({
  shapes,
  fill,
  label,
  tooltip,
  onSelect,
  height = 520,
  ariaLabel,
}: {
  shapes: DistrictShapes;
  /** Fill colour for a district. */
  fill: (district: string) => string;
  /** Short value printed under the district name, e.g. "-12.3%". */
  label?: (district: string) => string;
  tooltip: (district: string) => ReactNode;
  onSelect?: (district: string) => void;
  height?: number;
  ariaLabel: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Position and container width are measured in event handlers, never during render.
  const [hover, setHover] = useState<{ district: string; x: number; y: number; width: number } | null>(null);

  const drawn = useMemo(() => {
    const features = shapes.features.map(rewind);
    const collection = { type: "FeatureCollection", features } as DistrictShapes;
    const projection = geoMercator().fitExtent(
      [
        [12, 12],
        [WIDTH - 12, height - 12],
      ],
      collection,
    );
    const path = geoPath(projection);
    return features.map((f) => ({
      district: f.properties.district,
      d: path(f) ?? "",
      centroid: path.centroid(f),
    }));
  }, [shapes, height]);

  function move(district: string, e: React.MouseEvent) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ district, x: e.clientX - rect.left, y: e.clientY - rect.top, width: rect.width });
  }

  return (
    <div ref={box} className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
        {drawn.map(({ district, d }) => (
          <path
            key={district}
            d={d}
            style={{ fill: fill(district) }}
            className={`stroke-surface transition-[stroke] ${onSelect ? "cursor-pointer" : ""} ${
              hover?.district === district ? "stroke-ink" : ""
            }`}
            strokeWidth={hover?.district === district ? 2.5 : 1.5}
            strokeLinejoin="round"
            tabIndex={onSelect ? 0 : undefined}
            role={onSelect ? "button" : undefined}
            aria-label={`${district}${label ? `: ${label(district)}` : ""}`}
            onMouseMove={(e) => move(district, e)}
            onFocus={() => {
              const c = drawn.find((x) => x.district === district)?.centroid ?? [0, 0];
              const width = box.current?.clientWidth ?? WIDTH;
              setHover({ district, x: (c[0] * width) / WIDTH, y: (c[1] * width) / WIDTH, width });
            }}
            onBlur={() => setHover(null)}
            onClick={() => onSelect?.(district)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(district);
              }
            }}
          />
        ))}
        {/* Direct labels, so a district never depends on colour alone. */}
        {drawn.map(({ district, centroid: [x, y] }) => (
          <g key={district} pointerEvents="none" textAnchor="middle" className="tabular">
            <text
              x={x}
              y={label ? y - 3 : y + 4}
              fontSize={14}
              fontWeight={600}
              fill="var(--ink)"
              stroke="var(--surface)"
              strokeWidth={4}
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {district}
            </text>
            {label && (
              <text
                x={x}
                y={y + 14}
                fontSize={12}
                fill="var(--ink)"
                stroke="var(--surface)"
                strokeWidth={4}
                paintOrder="stroke"
                strokeLinejoin="round"
              >
                {label(district)}
              </text>
            )}
          </g>
        ))}
      </svg>
      {hover && (
        <div
          className="card pointer-events-none absolute z-10 w-60 px-3 py-2.5 text-xs shadow-lg"
          style={{
            left: Math.max(0, Math.min(hover.x + 14, hover.width - 250)),
            top: hover.y + 14,
          }}
        >
          {tooltip(hover.district)}
        </div>
      )}
    </div>
  );
}
