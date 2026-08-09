"use client";

import { useState } from "react";

interface SparklinePoint {
  label: string;
  value: number;
}

const WIDTH = 220;
const HEIGHT = 48;
const PADDING = 4;

export function Sparkline({
  points,
  formatValue,
  ariaLabel,
}: {
  points: SparklinePoint[];
  formatValue: (value: number) => string;
  ariaLabel: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const coords = points.map((p, i) => ({
    x: PADDING + (i / (points.length - 1)) * (WIDTH - PADDING * 2),
    y: HEIGHT - PADDING - ((p.value - min) / range) * (HEIGHT - PADDING * 2),
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${HEIGHT - PADDING} L ${coords[0].x.toFixed(1)} ${HEIGHT - PADDING} Z`;
  const hitWidth = (WIDTH - PADDING * 2) / (points.length - 1);

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const hoveredCoord = hoverIndex !== null ? coords[hoverIndex] : null;

  return (
    <div className="sparkline">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-bright)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--brand-bright)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkline-fill)" stroke="none" />
        <path d={linePath} fill="none" stroke="var(--brand-bright)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle
            key={`dot-${i}`}
            cx={c.x}
            cy={c.y}
            r={hoverIndex === i ? 3.5 : 2}
            fill={hoverIndex === i ? "var(--brand-bright)" : "var(--text)"}
            opacity={hoverIndex === i ? 1 : 0.45}
          />
        ))}
        {coords.map((c, i) => (
          <rect
            key={`hit-${i}`}
            x={Math.max(0, c.x - hitWidth / 2)}
            y={0}
            width={hitWidth}
            height={HEIGHT}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex((prev) => (prev === i ? null : prev))}
          />
        ))}
      </svg>
      {hovered && hoveredCoord && (
        <div className="sparkline-tooltip" style={{ left: `${(hoveredCoord.x / WIDTH) * 100}%` }}>
          <span className="sparkline-tooltip-value">{formatValue(hovered.value)}</span>
          <span className="sparkline-tooltip-label">{hovered.label}</span>
        </div>
      )}
    </div>
  );
}
