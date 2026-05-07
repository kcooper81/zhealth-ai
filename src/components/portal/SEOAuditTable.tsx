"use client";

import FilterableTable, { type Column } from "./FilterableTable";

type Issue = { code: string; severity: "critical" | "warn" | "info"; message: string };

export type SEOAuditTableRow = {
  id: number;
  type: "page" | "post";
  title: string;
  slug: string;
  link: string;
  path: string;
  titleLength: number;
  descriptionLength: number;
  wordCount: number;
  score: number;
  issues: Issue[];
};

function scoreCls(score: number): string {
  if (score >= 85) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 65) return "text-amber-700 dark:text-amber-400";
  return "text-rose-700 dark:text-rose-400";
}

/**
 * Thin client wrapper around FilterableTable that owns the column
 * definitions (which contain functions and so can't cross the
 * server/client component boundary as props).
 */
export default function SEOAuditTable({ rows }: { rows: SEOAuditTableRow[] }) {
  const columns: Column<SEOAuditTableRow>[] = [
    {
      key: "title",
      label: "Page",
      sortable: true,
      accessor: (r) => r.title,
      render: (r) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{r.title}</div>
          <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-gray-500 hover:underline">
            {r.path}
          </a>
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      accessor: (r) => r.type,
      render: (r) => <span className="text-xs uppercase tracking-wider text-gray-500">{r.type}</span>,
    },
    {
      key: "titleLength",
      label: "Title len",
      sortable: true,
      numeric: true,
      accessor: (r) => r.titleLength,
      render: (r) => (
        <span className={r.titleLength === 0 ? "text-rose-600" : r.titleLength < 25 || r.titleLength > 65 ? "text-amber-600" : ""}>
          {r.titleLength}
        </span>
      ),
    },
    {
      key: "descriptionLength",
      label: "Desc len",
      sortable: true,
      numeric: true,
      accessor: (r) => r.descriptionLength,
      render: (r) => (
        <span className={r.descriptionLength === 0 ? "text-rose-600" : r.descriptionLength < 70 || r.descriptionLength > 165 ? "text-amber-600" : ""}>
          {r.descriptionLength || "—"}
        </span>
      ),
    },
    {
      key: "wordCount",
      label: "Words",
      sortable: true,
      numeric: true,
      accessor: (r) => r.wordCount,
      render: (r) => r.wordCount.toLocaleString(),
    },
    {
      key: "issues",
      label: "Issues",
      sortable: true,
      numeric: true,
      accessor: (r) => r.issues.length,
      render: (r) => r.issues.length,
    },
    {
      key: "score",
      label: "Score",
      sortable: true,
      numeric: true,
      accessor: (r) => r.score,
      render: (r) => <span className={`font-semibold ${scoreCls(r.score)}`}>{r.score}</span>,
    },
  ];

  return (
    <FilterableTable
      rows={rows}
      rowKey={(r) => String(r.id)}
      searchableKeys={["title", "path", "slug"]}
      placeholder="Search by page title or URL path…"
      maxHeight={600}
      presets={[
        { label: "Score < 70", predicate: (r) => r.score < 70 },
        { label: "Missing description", predicate: (r) => r.issues.some((i) => i.code === "missing_description") },
        { label: "Thin content", predicate: (r) => r.issues.some((i) => i.code === "thin_content") },
        { label: "Posts only", predicate: (r) => r.type === "post" },
        { label: "Pages only", predicate: (r) => r.type === "page" },
      ]}
      initialSort={{ key: "score", dir: "asc" }}
      columns={columns}
    />
  );
}
