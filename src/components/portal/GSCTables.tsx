"use client";

import FilterableTable, { type Column } from "./FilterableTable";

export type GSCQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GSCPageRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/** Top-queries table for GSC dashboard. Owns its column functions. */
export function GSCQueriesTable({ rows }: { rows: GSCQueryRow[] }) {
  const columns: Column<GSCQueryRow>[] = [
    {
      key: "query",
      label: "Query",
      sortable: true,
      accessor: (q) => q.query,
      render: (q) => <span className="font-medium text-gray-900 dark:text-gray-100">{q.query}</span>,
    },
    { key: "clicks", label: "Clicks", sortable: true, numeric: true, accessor: (q) => q.clicks, render: (q) => q.clicks.toLocaleString() },
    { key: "impressions", label: "Impressions", sortable: true, numeric: true, accessor: (q) => q.impressions, render: (q) => q.impressions.toLocaleString() },
    { key: "ctr", label: "CTR", sortable: true, numeric: true, accessor: (q) => q.ctr, render: (q) => `${(q.ctr * 100).toFixed(2)}%` },
    { key: "position", label: "Position", sortable: true, numeric: true, accessor: (q) => q.position, render: (q) => q.position.toFixed(1) },
  ];

  return (
    <FilterableTable
      rows={rows}
      rowKey={(q) => q.query}
      searchableKeys={["query"]}
      placeholder="Search queries…"
      maxHeight={500}
      presets={[
        { label: "Page 1 (≤10)", predicate: (q) => q.position <= 10 },
        { label: "Page 2 (11–20)", predicate: (q) => q.position > 10 && q.position <= 20 },
        { label: ">100 impressions", predicate: (q) => q.impressions > 100 },
        { label: "Low CTR (<2%)", predicate: (q) => q.ctr < 0.02 },
      ]}
      initialSort={{ key: "clicks", dir: "desc" }}
      columns={columns}
    />
  );
}

/** Top-pages table for GSC dashboard. */
export function GSCPagesTable({ rows }: { rows: GSCPageRow[] }) {
  const columns: Column<GSCPageRow>[] = [
    {
      key: "page",
      label: "Page",
      sortable: true,
      accessor: (p) => p.page,
      render: (p) => (
        <a href={p.page} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-gray-900 hover:underline dark:text-gray-100">
          {(() => {
            try { return new URL(p.page).pathname; } catch { return p.page; }
          })()}
        </a>
      ),
    },
    { key: "clicks", label: "Clicks", sortable: true, numeric: true, accessor: (p) => p.clicks, render: (p) => p.clicks.toLocaleString() },
    { key: "impressions", label: "Impressions", sortable: true, numeric: true, accessor: (p) => p.impressions, render: (p) => p.impressions.toLocaleString() },
    { key: "ctr", label: "CTR", sortable: true, numeric: true, accessor: (p) => p.ctr, render: (p) => `${(p.ctr * 100).toFixed(2)}%` },
    { key: "position", label: "Position", sortable: true, numeric: true, accessor: (p) => p.position, render: (p) => p.position.toFixed(1) },
  ];

  return (
    <FilterableTable
      rows={rows}
      rowKey={(p) => p.page}
      searchableKeys={["page"]}
      placeholder="Search by URL path…"
      maxHeight={500}
      presets={[
        { label: "Page 1 (≤10)", predicate: (p) => p.position <= 10 },
        { label: "Page 2 (11–20)", predicate: (p) => p.position > 10 && p.position <= 20 },
        { label: ">100 impressions", predicate: (p) => p.impressions > 100 },
        { label: "0 clicks", predicate: (p) => p.clicks === 0 },
      ]}
      initialSort={{ key: "clicks", dir: "desc" }}
      columns={columns}
    />
  );
}
