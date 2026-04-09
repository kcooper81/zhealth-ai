"use client";

import React from "react";
import type { ReportData } from "@/lib/types";

interface ReportCardProps {
  data: ReportData;
}

function formatNumber(value: string | number): string {
  if (typeof value === "string") return value;
  if (Number.isInteger(value)) {
    return value.toLocaleString("en-US");
  }
  // Float: format with up to 2 decimals
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatCellValue(value: string | number): string {
  if (typeof value === "string") return value;
  return formatNumber(value);
}

function isNumericCell(value: string | number): boolean {
  if (typeof value === "number") return true;
  // Check if it's a string that looks like a number, currency, or percentage
  if (typeof value === "string") {
    return /^[\$]?[\d,]+\.?\d*%?$/.test(value.trim());
  }
  return false;
}

function ChangeIndicator({ change, label }: { change: number; label?: string }) {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const color = isPositive ? "text-emerald-600 dark:text-emerald-400" : isNegative ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500";
  const bgColor = isPositive ? "bg-emerald-50 dark:bg-emerald-900/20" : isNegative ? "bg-red-50 dark:bg-red-900/20" : "bg-gray-50 dark:bg-gray-800";

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium ${color} ${bgColor}`}>
      {isPositive && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
          <path d="M5 2L8 6H2L5 2Z" fill="currentColor" />
        </svg>
      )}
      {isNegative && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
          <path d="M5 8L2 4H8L5 8Z" fill="currentColor" />
        </svg>
      )}
      {isPositive ? "+" : ""}{change.toFixed(1)}%
      {label && <span className="text-gray-400 dark:text-gray-500 ml-0.5">{label}</span>}
    </span>
  );
}

export default function ReportCard({ data }: ReportCardProps) {
  return (
    <div className="report-card mt-3 mb-1">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 leading-tight">
          {data.title}
        </h3>
        <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
          {data.period}
        </p>
      </div>

      {/* Summary stats grid */}
      {data.summary && data.summary.length > 0 && (
        <div className="report-summary-grid px-4 pb-3">
          {data.summary.map((stat, idx) => (
            <div key={idx} className="report-stat-card">
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider leading-tight">
                {stat.label}
              </p>
              <p className="text-[20px] font-semibold text-gray-900 dark:text-gray-100 leading-tight mt-1">
                {formatNumber(stat.value)}
              </p>
              {stat.change !== undefined && (
                <div className="mt-1">
                  <ChangeIndicator change={stat.change} label={stat.changeLabel} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {data.table && data.table.headers.length > 0 && (
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                {data.table.headers.map((header, idx) => (
                  <th key={idx}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.table.rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className={isNumericCell(cell) ? "text-right tabular-nums" : ""}
                    >
                      {formatCellValue(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {data.notes && data.notes.length > 0 && (
        <div className="px-4 pt-2 pb-3 border-t border-gray-100 dark:border-gray-700/40">
          <ul className="space-y-1">
            {data.notes.map((note, idx) => (
              <li key={idx} className="flex items-start gap-2 text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mt-[6px] flex-shrink-0" />
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
