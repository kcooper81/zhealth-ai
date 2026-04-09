"use client";

import React from "react";
import type { ChartData } from "@/lib/types";

// Z-Health brand palette for chart colors
const COLORS = [
  "#2c8df3", // blue
  "#d32431", // red
  "#d0f689", // lime
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#10b981", // emerald
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#6366f1", // indigo
];

function getColor(index: number, custom?: string): string {
  return custom || COLORS[index % COLORS.length];
}

// ---------------------------------------------------------------------------
// Bar Chart
// ---------------------------------------------------------------------------
function BarChart({ data, height = 180 }: { data: ChartData["data"]; height: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.max(16, Math.min(48, (280 - data.length * 4) / data.length));
  const chartWidth = data.length * (barWidth + 8) + 40;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${Math.max(chartWidth, 280)} ${height}`} className="overflow-visible">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
        const y = 10 + (height - 40) * (1 - pct);
        return (
          <g key={pct}>
            <line x1="35" y1={y} x2={chartWidth} y2={y} stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeWidth="1" />
            <text x="30" y={y + 3} textAnchor="end" className="text-gray-400 dark:text-gray-500" fontSize="9" fill="currentColor">
              {Math.round(max * pct).toLocaleString()}
            </text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const barHeight = (d.value / max) * (height - 40);
        const x = 40 + i * (barWidth + 8);
        const y = height - 30 - barHeight;
        const color = getColor(i, d.color);
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx="3" fill={color} opacity="0.85">
              <title>{`${d.label}: ${d.value.toLocaleString()}`}</title>
            </rect>
            <text
              x={x + barWidth / 2}
              y={height - 16}
              textAnchor="middle"
              className="text-gray-500 dark:text-gray-400"
              fontSize="9"
              fill="currentColor"
            >
              {d.label.length > 8 ? d.label.slice(0, 7) + "..." : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Horizontal Bar Chart
// ---------------------------------------------------------------------------
function HorizontalBarChart({ data, height: requestedHeight }: { data: ChartData["data"]; height: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barHeight = 20;
  const gap = 6;
  const height = Math.max(requestedHeight, data.length * (barHeight + gap) + 10);
  const labelWidth = 80;
  const chartWidth = 280;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
      {data.map((d, i) => {
        const barW = ((d.value / max) * (chartWidth - labelWidth - 50));
        const y = i * (barHeight + gap) + 4;
        const color = getColor(i, d.color);
        return (
          <g key={i}>
            <text x={labelWidth - 4} y={y + barHeight / 2 + 4} textAnchor="end" className="text-gray-600 dark:text-gray-400" fontSize="10" fill="currentColor">
              {d.label.length > 12 ? d.label.slice(0, 11) + "..." : d.label}
            </text>
            <rect x={labelWidth} y={y} width={Math.max(barW, 2)} height={barHeight} rx="3" fill={color} opacity="0.85">
              <title>{`${d.label}: ${d.value.toLocaleString()}`}</title>
            </rect>
            <text x={labelWidth + barW + 6} y={y + barHeight / 2 + 4} className="text-gray-500 dark:text-gray-400" fontSize="10" fill="currentColor">
              {d.value.toLocaleString()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Donut Chart
// ---------------------------------------------------------------------------
function DonutChart({ data, height = 180 }: { data: ChartData["data"]; height: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const cx = 90;
  const cy = height / 2;
  const radius = Math.min(cx - 10, cy - 10);
  const innerRadius = radius * 0.6;

  let startAngle = -90; // Start from top

  const slices = data.map((d, i) => {
    const pct = d.value / total;
    const angle = pct * 360;
    const endAngle = startAngle + angle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const ix1 = cx + innerRadius * Math.cos(startRad);
    const iy1 = cy + innerRadius * Math.sin(startRad);
    const ix2 = cx + innerRadius * Math.cos(endRad);
    const iy2 = cy + innerRadius * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    const path = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      "Z",
    ].join(" ");

    const color = getColor(i, d.color);
    startAngle = endAngle;

    return (
      <path key={i} d={path} fill={color} opacity="0.85">
        <title>{`${d.label}: ${d.value.toLocaleString()} (${(pct * 100).toFixed(1)}%)`}</title>
      </path>
    );
  });

  // Center text
  const centerText = total.toLocaleString();

  return (
    <div className="flex items-center gap-4">
      <svg width={cx * 2} height={height} viewBox={`0 0 ${cx * 2} ${height}`}>
        {slices}
        <text x={cx} y={cy - 4} textAnchor="middle" className="text-gray-800 dark:text-gray-200" fontSize="16" fontWeight="600" fill="currentColor">
          {centerText}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="text-gray-400 dark:text-gray-500" fontSize="9" fill="currentColor">
          Total
        </text>
      </svg>
      {/* Legend */}
      <div className="flex flex-col gap-1.5 min-w-0">
        {data.slice(0, 8).map((d, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: getColor(i, d.color) }} />
            <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate">{d.label}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0">{d.value.toLocaleString()}</span>
          </div>
        ))}
        {data.length > 8 && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">+{data.length - 8} more</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line Chart (Sparkline / Trend)
// ---------------------------------------------------------------------------
function LineChart({ data, height = 120 }: { data: ChartData["data"]; height: number }) {
  if (data.length < 2) return null;

  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const padding = { top: 10, right: 10, bottom: 30, left: 40 };
  const chartW = 300;
  const innerW = chartW - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * innerW;
    const y = padding.top + innerH - ((d.value - min) / range) * innerH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;

  const color = data[0]?.color || COLORS[0];

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${chartW} ${height}`}>
      {/* Grid */}
      {[0, 0.5, 1].map((pct) => {
        const y = padding.top + innerH * (1 - pct);
        const val = min + range * pct;
        return (
          <g key={pct}>
            <line x1={padding.left} y1={y} x2={chartW - padding.right} y2={y} stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeWidth="1" />
            <text x={padding.left - 4} y={y + 3} textAnchor="end" className="text-gray-400 dark:text-gray-500" fontSize="9" fill="currentColor">
              {Math.round(val).toLocaleString()}
            </text>
          </g>
        );
      })}
      {/* Area fill */}
      <path d={areaPath} fill={color} opacity="0.08" />
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} stroke="white" strokeWidth="1.5">
          <title>{`${p.label}: ${p.value.toLocaleString()}`}</title>
        </circle>
      ))}
      {/* X-axis labels */}
      {points.filter((_, i) => data.length <= 10 || i % Math.ceil(data.length / 8) === 0).map((p, i) => (
        <text key={i} x={p.x} y={height - 10} textAnchor="middle" className="text-gray-400 dark:text-gray-500" fontSize="9" fill="currentColor">
          {p.label.length > 6 ? p.label.slice(0, 5) + ".." : p.label}
        </text>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export default function ReportChart({ chart }: { chart: ChartData }) {
  const h = chart.height || (chart.type === "donut" ? 160 : chart.type === "line" ? 140 : 180);

  return (
    <div className="px-4 py-3">
      {chart.type === "bar" && <BarChart data={chart.data} height={h} />}
      {chart.type === "horizontal-bar" && <HorizontalBarChart data={chart.data} height={h} />}
      {chart.type === "donut" && <DonutChart data={chart.data} height={h} />}
      {chart.type === "line" && <LineChart data={chart.data} height={h} />}
    </div>
  );
}
