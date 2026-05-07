/**
 * Lightweight SVG line chart — no chart library dependency.
 * Renders one or more series over a shared X axis. Designed for
 * weekly/monthly trend data on the portal.
 */

type Point = { x: string; y: number | null };
type Series = {
  label: string;
  color: string;
  points: Point[];
  /** If true, format Y axis values as percentages (multiply by 100) */
  isPercent?: boolean;
};

type Props = {
  series: Series[];
  height?: number;
  formatY?: (n: number) => string;
  /** Optional Y axis label */
  yLabel?: string;
  /** Show data point dots (default true) */
  showDots?: boolean;
};

export default function LineChart({ series, height = 220, formatY, yLabel, showDots = true }: Props) {
  if (series.length === 0 || series.every((s) => s.points.every((p) => p.y == null))) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-500">
        No data yet — save weekly metrics to start tracking trends.
      </div>
    );
  }

  // Collect all x values across series, deduplicated, sorted
  const xValuesSet = new Set<string>();
  series.forEach((s) => s.points.forEach((p) => xValuesSet.add(p.x)));
  const xValues = Array.from(xValuesSet).sort();

  // Find min/max y across all series (ignoring nulls)
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      if (p.y != null) {
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }
  }
  if (minY === Infinity) {
    minY = 0;
    maxY = 1;
  }
  // Pad the range a bit so points don't sit at the edges
  const range = maxY - minY || 1;
  minY -= range * 0.1;
  maxY += range * 0.1;
  if (minY < 0 && series.every((s) => s.points.every((p) => p.y == null || p.y >= 0))) minY = 0;

  const W = 800;
  const H = height;
  const PAD_L = 56;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 36;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const xScale = (i: number) => PAD_L + (xValues.length === 1 ? innerW / 2 : (i / (xValues.length - 1)) * innerW);
  const yScale = (v: number) => PAD_T + innerH - ((v - minY) / (maxY - minY)) * innerH;

  // Y axis ticks (5 ticks)
  const yTicks: number[] = [];
  for (let i = 0; i <= 4; i++) yTicks.push(minY + ((maxY - minY) * i) / 4);

  const fmt = (v: number) => (formatY ? formatY(v) : v.toFixed(2));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full" style={{ minWidth: 500 }}>
        {/* Y axis label */}
        {yLabel && (
          <text x={4} y={PAD_T + innerH / 2} fontSize="10" fill="currentColor" className="text-gray-500" transform={`rotate(-90 4 ${PAD_T + innerH / 2})`} textAnchor="middle">
            {yLabel}
          </text>
        )}

        {/* Y grid lines + labels */}
        {yTicks.map((t, i) => {
          const y = yScale(t);
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="currentColor" strokeOpacity={i === 0 ? 0.2 : 0.08} strokeWidth={1} className="text-gray-400" />
              <text x={PAD_L - 8} y={y + 3} fontSize="10" textAnchor="end" fill="currentColor" className="text-gray-500">
                {fmt(t)}
              </text>
            </g>
          );
        })}

        {/* X axis labels */}
        {xValues.map((x, i) => {
          // Skip middle labels if many points, to avoid overlap
          const skip = xValues.length > 8 && i % Math.ceil(xValues.length / 8) !== 0 && i !== xValues.length - 1;
          if (skip) return null;
          return (
            <text key={x} x={xScale(i)} y={H - 8} fontSize="10" textAnchor="middle" fill="currentColor" className="text-gray-500">
              {x.length > 10 ? x.slice(5) : x}
            </text>
          );
        })}

        {/* Series lines */}
        {series.map((s) => {
          // Build the polyline points string, skipping nulls (creates gaps)
          const segments: string[] = [];
          let currentSegment: string[] = [];
          xValues.forEach((x, i) => {
            const point = s.points.find((p) => p.x === x);
            if (point && point.y != null) {
              currentSegment.push(`${xScale(i).toFixed(1)},${yScale(point.y).toFixed(1)}`);
            } else if (currentSegment.length) {
              segments.push(currentSegment.join(" "));
              currentSegment = [];
            }
          });
          if (currentSegment.length) segments.push(currentSegment.join(" "));

          // Build area-fill paths under each line segment (gradient fill for visual richness)
          const areaPaths: string[] = [];
          let areaSegment: string[] = [];
          xValues.forEach((x, i) => {
            const point = s.points.find((p) => p.x === x);
            if (point && point.y != null) {
              areaSegment.push(`${xScale(i).toFixed(1)},${yScale(point.y).toFixed(1)}`);
            } else if (areaSegment.length) {
              const first = areaSegment[0];
              const last = areaSegment[areaSegment.length - 1];
              const firstX = first.split(",")[0];
              const lastX = last.split(",")[0];
              const baseline = yScale(minY).toFixed(1);
              areaPaths.push(`M${firstX},${baseline} L${areaSegment.join(" L")} L${lastX},${baseline} Z`);
              areaSegment = [];
            }
          });
          if (areaSegment.length > 1) {
            const first = areaSegment[0];
            const last = areaSegment[areaSegment.length - 1];
            const firstX = first.split(",")[0];
            const lastX = last.split(",")[0];
            const baseline = yScale(minY).toFixed(1);
            areaPaths.push(`M${firstX},${baseline} L${areaSegment.join(" L")} L${lastX},${baseline} Z`);
          }
          const gradId = `grad-${s.label.replace(/[^a-z0-9]/gi, "")}-${Math.floor(Math.random() * 9999)}`;

          return (
            <g key={s.label}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              {areaPaths.map((p, idx) => (
                <path key={`a-${idx}`} d={p} fill={`url(#${gradId})`} />
              ))}
              {segments.map((seg, idx) => (
                <polyline key={idx} points={seg} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {showDots &&
                s.points.map((p, i) => {
                  if (p.y == null) return null;
                  const xi = xValues.indexOf(p.x);
                  if (xi < 0) return null;
                  return (
                    <circle key={`${s.label}-${i}`} cx={xScale(xi)} cy={yScale(p.y)} r={3.5} fill={s.color}>
                      <title>{`${s.label}: ${fmt(p.y)} on ${p.x}`}</title>
                    </circle>
                  );
                })}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-4">
          {series.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <span className="h-2 w-6 rounded" style={{ backgroundColor: s.color }} />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
