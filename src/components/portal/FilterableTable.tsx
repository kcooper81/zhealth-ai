"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown } from "@/components/icons";

export type Column<T> = {
  /** Column id — used for sorting state */
  key: string;
  label: string;
  /** True if user can click the header to sort by this column */
  sortable?: boolean;
  /** Right-align the cell (numbers) */
  numeric?: boolean;
  /** Width hint, e.g. "w-32" */
  className?: string;
  /** How to read the sort value out of a row (defaults to row[key]) */
  accessor?: (row: T) => string | number;
  /** How to render the cell (defaults to String(accessor(row))) */
  render?: (row: T) => React.ReactNode;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  /** Which fields to substring-match against the search input */
  searchableKeys: Array<keyof T | ((row: T) => string)>;
  /** Initial sort column key + direction */
  initialSort?: { key: string; dir: "asc" | "desc" };
  /** Optional preset filters — chips above the search input */
  presets?: Array<{ label: string; predicate: (row: T) => boolean }>;
  /** Search input placeholder */
  placeholder?: string;
  /** Render override per row (defaults to a normal table) */
  emptyMessage?: string;
  /** Outer max-height for sticky scrolling */
  maxHeight?: number;
  rowKey: (row: T) => string;
};

/**
 * Generic filterable + sortable table. Used on long report tables so
 * managers can find a specific page/query/course in seconds.
 *
 * - Search input matches substrings across `searchableKeys`
 * - Click any header marked `sortable` to sort; click again to reverse
 * - Presets are toggle chips that apply an extra predicate filter
 */
export default function FilterableTable<T>({
  rows,
  columns,
  searchableKeys,
  initialSort,
  presets,
  placeholder = "Search…",
  emptyMessage = "No matching rows.",
  maxHeight = 600,
  rowKey,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [activePresets, setActivePresets] = useState<Set<number>>(new Set());
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort || null);

  const filtered = useMemo(() => {
    let out = rows;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter((row) =>
        searchableKeys.some((k) => {
          const v = typeof k === "function" ? k(row) : (row as any)[k];
          return v != null && String(v).toLowerCase().includes(q);
        })
      );
    }

    if (presets && activePresets.size > 0) {
      out = out.filter((row) =>
        Array.from(activePresets).every((idx) => presets[idx].predicate(row))
      );
    }

    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        const accessor = col.accessor || ((r: T) => (r as any)[col.key]);
        out = [...out].sort((a, b) => {
          const va = accessor(a);
          const vb = accessor(b);
          if (typeof va === "number" && typeof vb === "number") {
            return sort.dir === "asc" ? va - vb : vb - va;
          }
          const sa = String(va ?? "").toLowerCase();
          const sb = String(vb ?? "").toLowerCase();
          if (sa < sb) return sort.dir === "asc" ? -1 : 1;
          if (sa > sb) return sort.dir === "asc" ? 1 : -1;
          return 0;
        });
      }
    }

    return out;
  }, [rows, query, activePresets, sort, presets, columns, searchableKeys]);

  const togglePreset = (i: number) =>
    setActivePresets((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const toggleSort = (key: string) =>
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: "desc" };
      if (s.dir === "desc") return { key, dir: "asc" };
      return null;
    });

  return (
    <div>
      {/* Search + presets bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-7 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
        </div>
        {presets?.map((p, i) => {
          const active = activePresets.has(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => togglePreset(i)}
              className={[
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                active
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10",
              ].join(" ")}
            >
              {p.label}
            </button>
          );
        })}
        <span className="ml-auto text-[11px] text-gray-500">
          {filtered.length === rows.length
            ? `${rows.length.toLocaleString()} rows`
            : `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} rows`}
        </span>
      </div>

      <div
        className="overflow-y-auto rounded-2xl border border-gray-200/70 bg-white ring-1 ring-black/[0.03] dark:border-white/5 dark:bg-[#1f1f22] dark:ring-white/[0.04]"
        style={{ maxHeight }}
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 border-b border-gray-200/70 bg-white/95 backdrop-blur dark:border-white/5 dark:bg-[#1f1f22]/95">
            <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {columns.map((col) => {
                const isActive = sort?.key === col.key;
                const arrow = isActive ? (sort.dir === "asc" ? "↑" : "↓") : "";
                return (
                  <th
                    key={col.key}
                    className={[
                      "px-5 py-3",
                      col.numeric ? "text-right" : "",
                      col.className || "",
                      col.sortable ? "cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-300" : "",
                    ].join(" ")}
                    onClick={() => col.sortable && toggleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable && <span className={`ml-0.5 ${isActive ? "" : "text-gray-300 dark:text-gray-600"}`}>{arrow || <ChevronDown size={10} />}</span>}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-8 text-center text-xs text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={rowKey(row)} className="text-gray-700 dark:text-gray-300">
                  {columns.map((col) => {
                    const value = col.render ? col.render(row) : String((col.accessor || ((r: T) => (r as any)[col.key]))(row) ?? "");
                    return (
                      <td
                        key={col.key}
                        className={[
                          "px-5 py-2.5",
                          col.numeric ? "text-right tabular-nums" : "",
                          col.className || "",
                        ].join(" ")}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
