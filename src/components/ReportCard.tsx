"use client";

import React, { useCallback } from "react";
import type { ReportData } from "@/lib/types";
import { Download } from "./icons";
import ReportChart from "./ReportChart";

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

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const csv = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((r) => r.map(escapeCsvCell).join(",")),
  ].join("\n");
  downloadFile(csv, filename, "text/csv");
}

function downloadTSV(headers: string[], rows: (string | number)[][], filename: string) {
  const tsv = [
    headers.join("\t"),
    ...rows.map((r) => r.map((c) => String(c).replace(/\t/g, " ")).join("\t")),
  ].join("\n");
  downloadFile(tsv, filename, "text/tab-separated-values");
}

function downloadJSON(data: ReportData, filename: string) {
  downloadFile(JSON.stringify(data, null, 2), filename, "application/json");
}

function downloadPdfReport(data: ReportData, filename: string) {
  // Build a styled HTML document for PDF printing via browser print dialog
  const slug = filename.replace(/\.pdf$/, "");

  const summaryHtml = data.summary && data.summary.length > 0
    ? `<div class="summary-grid">${data.summary.map((stat) =>
        `<div class="stat-card">
          <div class="stat-label">${stat.label}</div>
          <div class="stat-value">${formatNumber(stat.value)}</div>
          ${stat.change !== undefined ? `<div class="stat-change ${stat.change > 0 ? "positive" : stat.change < 0 ? "negative" : ""}">${stat.change > 0 ? "+" : ""}${stat.change.toFixed(1)}%${stat.changeLabel ? ` ${stat.changeLabel}` : ""}</div>` : ""}
        </div>`
      ).join("")}</div>`
    : "";

  const tableHtml = data.table && data.table.headers.length > 0
    ? `<table>
        <thead><tr>${data.table.headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${data.table.rows.map((row) =>
          `<tr>${row.map((cell) => `<td${isNumericCell(cell) ? ' class="num"' : ""}>${formatCellValue(cell)}</td>`).join("")}</tr>`
        ).join("")}</tbody>
      </table>`
    : "";

  const notesHtml = data.notes && data.notes.length > 0
    ? `<div class="notes"><h3>Notes</h3><ul>${data.notes.map((n) => `<li>${n}</li>`).join("")}</ul></div>`
    : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${data.title}</title>
<style>
  @page { margin: 0.6in; size: letter; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 11px; line-height: 1.5; }
  .header { border-bottom: 2px solid #2c8df3; padding-bottom: 8px; margin-bottom: 16px; }
  .header h1 { font-size: 20px; font-weight: 700; color: #080a0d; }
  .header .period { font-size: 12px; color: #666; margin-top: 2px; }
  .header .brand { font-size: 10px; color: #2c8df3; float: right; margin-top: 4px; }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .stat-card { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 10px; }
  .stat-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #888; }
  .stat-value { font-size: 18px; font-weight: 700; color: #1a1a1a; margin-top: 2px; }
  .stat-change { font-size: 10px; margin-top: 2px; color: #888; }
  .stat-change.positive { color: #16a34a; }
  .stat-change.negative { color: #dc2626; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
  th { background: #f1f3f5; text-align: left; padding: 6px 8px; font-weight: 600; border-bottom: 2px solid #dee2e6; white-space: nowrap; }
  td { padding: 5px 8px; border-bottom: 1px solid #e9ecef; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr:nth-child(even) { background: #fafafa; }
  .notes { margin-top: 10px; }
  .notes h3 { font-size: 11px; font-weight: 600; color: #555; margin-bottom: 4px; }
  .notes ul { padding-left: 16px; }
  .notes li { font-size: 10px; color: #666; margin-bottom: 3px; }
  .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e9ecef; font-size: 9px; color: #aaa; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>
  <div class="header">
    <span class="brand">Z-Health Education</span>
    <h1>${data.title}</h1>
    <div class="period">${data.period} &mdash; Generated ${new Date().toLocaleDateString()}</div>
  </div>
  ${summaryHtml}
  ${tableHtml}
  ${notesHtml}
  <div class="footer">Generated by Z-Health AI &bull; ${new Date().toLocaleString()}</div>
</body></html>`;

  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) {
    // Fallback: download as HTML if popup blocked
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  // Wait for content to render, then trigger print (Save as PDF)
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
  // Fallback for browsers where onload doesn't fire reliably
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
}

function ExportButton({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors border border-gray-200 dark:border-gray-700"
      title={title}
    >
      <Download size={11} />
      {label}
    </button>
  );
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

      {/* Chart visualization */}
      {data.chart && data.chart.data && data.chart.data.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700/40">
          <ReportChart chart={data.chart} />
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

      {/* Export buttons */}
      <div className="px-4 pt-2 pb-3 border-t border-gray-100 dark:border-gray-700/40 flex items-center gap-1.5 flex-wrap">
        {data.table && data.table.headers.length > 0 && (
          <ExportButton
            label="CSV"
            title="Download as CSV (spreadsheet)"
            onClick={() => {
              const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
              downloadCSV(data.table!.headers, data.table!.rows, `${slug}.csv`);
            }}
          />
        )}
        {data.table && data.table.headers.length > 0 && (
          <ExportButton
            label="Excel"
            title="Download as TSV (opens in Excel)"
            onClick={() => {
              const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
              downloadTSV(data.table!.headers, data.table!.rows, `${slug}.tsv`);
            }}
          />
        )}
        <ExportButton
          label="PDF"
          title="Download as PDF"
          onClick={() => {
            const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            downloadPdfReport(data, `${slug}.pdf`);
          }}
        />
        <ExportButton
          label="JSON"
          title="Download raw data as JSON"
          onClick={() => {
            const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            downloadJSON(data, `${slug}.json`);
          }}
        />
      </div>
    </div>
  );
}
