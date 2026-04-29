"use client";

import { useMemo, useState } from "react";
import { Search } from "@/components/icons";

type Tag = {
  id: number;
  name: string;
  description?: string;
  category?: { id: number; name: string };
  contactCount: number;
};

type SortKey = "name" | "category" | "contactCount";
type SortDir = "asc" | "desc";

const QUICK_FILTERS = [
  { label: "Course", pattern: /course/i },
  { label: "Registered", pattern: /register/i },
  { label: "Trainer", pattern: /trainer/i },
  { label: "Customer", pattern: /customer|buyer|paid/i },
  { label: "Lead", pattern: /lead|prospect/i },
];

export default function TagCountsTable({ tags }: { tags: Tag[] }) {
  const [query, setQuery] = useState("");
  const [activeQuick, setActiveQuick] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("contactCount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of tags) {
      if (t.category?.name) set.add(t.category.name);
    }
    return ["all", ...Array.from(set).sort()];
  }, [tags]);

  const filtered = useMemo(() => {
    let result = tags;

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.category?.name || "").toLowerCase().includes(q)
      );
    }

    if (activeQuick) {
      const filter = QUICK_FILTERS.find((f) => f.label === activeQuick);
      if (filter) {
        result = result.filter((t) => filter.pattern.test(t.name) || filter.pattern.test(t.category?.name || ""));
      }
    }

    if (categoryFilter !== "all") {
      result = result.filter((t) => t.category?.name === categoryFilter);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "category")
        cmp = (a.category?.name || "").localeCompare(b.category?.name || "");
      else cmp = (a.contactCount ?? 0) - (b.contactCount ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [tags, query, activeQuick, sortKey, sortDir, categoryFilter]);

  const totalContacts = filtered.reduce((s, t) => s + (t.contactCount || 0), 0);

  const setSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "contactCount" ? "desc" : "asc");
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tags by name, category, description…"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:border-white/10 dark:bg-[#1f1f22] dark:text-gray-100"
            />
          </div>

          {categories.length > 2 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none dark:border-white/10 dark:bg-[#1f1f22] dark:text-gray-100"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All categories" : c}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-500">
            Quick filters:
          </span>
          {QUICK_FILTERS.map((f) => {
            const active = activeQuick === f.label;
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => setActiveQuick(active ? null : f.label)}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-brand-blue text-white"
                    : "border border-gray-200 bg-white text-gray-700 hover:border-brand-blue dark:border-white/10 dark:bg-white/5 dark:text-gray-300",
                ].join(" ")}
              >
                {f.label}
              </button>
            );
          })}
          {(query || activeQuick || categoryFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveQuick(null);
                setCategoryFilter("all");
              }}
              className="ml-auto text-xs text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear
            </button>
          )}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-500">
          {filtered.length} tag{filtered.length === 1 ? "" : "s"} ·{" "}
          <strong className="tabular-nums text-gray-700 dark:text-gray-300">
            {totalContacts.toLocaleString()}
          </strong>{" "}
          contacts in matched tags{" "}
          <span className="text-gray-400 dark:text-gray-600">
            (note: a contact in 3 tags counts 3×)
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white dark:border-white/5 dark:bg-[#1f1f22]">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
            <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => setSort("name")}
                  className="hover:text-gray-900 dark:hover:text-gray-100"
                >
                  Tag {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => setSort("category")}
                  className="hover:text-gray-900 dark:hover:text-gray-100"
                >
                  Category {sortKey === "category" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="px-5 py-3 text-right">
                <button
                  type="button"
                  onClick={() => setSort("contactCount")}
                  className="hover:text-gray-900 dark:hover:text-gray-100"
                >
                  Contacts {sortKey === "contactCount" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-sm text-gray-500">
                  No tags match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="text-gray-700 dark:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{t.id}</td>
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {t.name}
                    {t.description && (
                      <div className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-500">
                        {t.description}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {t.category?.name ? (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-white/5 dark:text-gray-300">
                        {t.category.name}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                    {t.contactCount.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
