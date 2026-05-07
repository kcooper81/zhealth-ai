/**
 * SEO Audit — every page/post on zhealtheducation.com scored against
 * on-page SEO best practices, cross-stitched with GA4 traffic so the
 * highest-impact fixes float to the top.
 *
 * What's checked per page:
 *   - SEO title (presence + length 25-65 chars)
 *   - Meta description (presence + length 70-165 chars)
 *   - Open-graph image
 *   - Canonical URL
 *   - Schema.org JSON-LD markup
 *   - Word count (thin-content warning <300)
 *   - Indexability (noindex flag detection)
 */
import { Suspense } from "react";
import Section, { Card } from "@/components/portal/Section";
import KPIGrid from "@/components/portal/KPIGrid";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import DateRangePicker from "@/components/portal/DateRangePicker";
import ExportButton from "@/components/portal/ExportButton";
import { SectionSkeleton, TableSkeleton, KPIGridSkeleton } from "@/components/portal/Skeletons";
import { runSEOAudit } from "@/lib/wp-seo-audit";
import { getServerSession } from "@/lib/auth";
import { cachedFetch, TTL } from "@/lib/cache";
import { getTopPages } from "@/lib/google-analytics";
import { parseTimeRange } from "@/lib/time-range";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function severityCls(s: "critical" | "warn" | "info"): string {
  return {
    critical: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
    warn: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    info: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  }[s];
}

function scoreCls(score: number): string {
  if (score >= 85) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 65) return "text-amber-700 dark:text-amber-400";
  return "text-rose-700 dark:text-rose-400";
}

async function loadShell() {
  const audit = await runSEOAudit().catch(() => ({
    rows: [],
    totals: {
      total: 0, pages: 0, posts: 0, avgScore: 0,
      missingDescription: 0, missingTitle: 0, missingOgImage: 0,
      missingSchema: 0, thinContent: 0, noindex: 0,
    },
    worst: [],
    best: [],
  }));
  return audit;
}

async function HighImpactSection({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // Cross-stitch SEO issues × GA4 pageviews → "fix these first" list
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;

  const session = (await getServerSession()) as any;
  const accessToken = session?.accessToken;

  const [audit, topPages] = await Promise.all([
    runSEOAudit(),
    accessToken
      ? cachedFetch(`ga4:top-pages:website:${rangeKey}:200`, TTL.GA4_REPORTS, () =>
          getTopPages(accessToken, "website", rangeKey, 200).catch(() => [])
        )
      : Promise.resolve([] as any[]),
  ]);

  // Map pageviews to audit rows by path
  const pvByPath = new Map<string, number>();
  for (const p of topPages as any[]) {
    pvByPath.set(p.page, p.pageviews);
  }
  const decorated = audit.rows
    .map((r) => ({ ...r, pageviews: pvByPath.get(r.path) ?? 0 }))
    .filter((r) => r.score < 90 && r.pageviews > 0)
    .sort((a, b) => b.pageviews * (100 - a.score) - a.pageviews * (100 - b.score));

  const top = decorated.slice(0, 15);

  return (
    <Section
      id="section-high-impact"
      title="Highest-impact fixes"
      description="Ranked by traffic × how broken — top of the list = most search-traffic recovery for the smallest fix."
      action={<ExportButton targetId="section-high-impact" filename="seo-high-impact" />}
    >
      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="px-5 py-3">Page</th>
                <th className="px-5 py-3 text-right">Score</th>
                <th className="px-5 py-3 text-right">Views ({range.label})</th>
                <th className="px-5 py-3">Top issue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {top.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">
                    {accessToken
                      ? "No high-impact pages found — either every trafficked page scores ≥90 or there's no GA4 traffic yet for this window."
                      : "Sign in via Analytics to see traffic-weighted rankings."}
                  </td>
                </tr>
              )}
              {top.map((r) => {
                const topIssue = r.issues.sort((a, b) => {
                  const order = { critical: 0, warn: 1, info: 2 } as const;
                  return order[a.severity] - order[b.severity];
                })[0];
                return (
                  <tr key={r.id} className="text-gray-700 dark:text-gray-300">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{r.title}</div>
                      <div className="text-xs">
                        <a href={r.link} target="_blank" rel="noopener noreferrer" className="font-mono text-gray-500 hover:underline">
                          {r.path}
                        </a>
                      </div>
                    </td>
                    <td className={`px-5 py-3 text-right tabular-nums font-semibold ${scoreCls(r.score)}`}>{r.score}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{r.pageviews.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      {topIssue && (
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${severityCls(topIssue.severity)}`}>
                            {topIssue.severity}
                          </span>
                          <span className="text-xs text-gray-700 dark:text-gray-300">{topIssue.message}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </Section>
  );
}

export const metadata = { title: "SEO Audit — Z-Health Portal" };

export default async function SEOAuditPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const audit = await loadShell();

  const insights: Array<{ severity: "good" | "warn" | "alert" | "info"; title: string; body: string }> = [];

  if (audit.totals.missingDescription > 0) {
    const pct = Math.round((audit.totals.missingDescription / Math.max(1, audit.totals.total)) * 100);
    insights.push({
      severity: pct >= 30 ? "alert" : "warn",
      title: `${audit.totals.missingDescription} pages missing meta descriptions (${pct}% of site)`,
      body: "Without a Yoast meta description, Google falls back to a content excerpt — usually generic and click-unfriendly. Set descriptions on the highest-traffic pages first; an AI generator could draft these in bulk from each page's content.",
    });
  }

  if (audit.totals.missingSchema > 0) {
    insights.push({
      severity: audit.totals.missingSchema > audit.totals.total * 0.5 ? "warn" : "info",
      title: `${audit.totals.missingSchema} pages have no JSON-LD schema`,
      body: "Schema markup unlocks rich results (FAQ, breadcrumbs, course, review). Yoast Premium auto-generates basics on most templates — pages without it likely have a custom Elementor layout.",
    });
  }

  if (audit.totals.thinContent > 0) {
    insights.push({
      severity: "info",
      title: `${audit.totals.thinContent} pages have thin content (<300 words)`,
      body: "Thin pages are unlikely to rank for competitive terms. Either expand them, merge with related pages, or set noindex if they're functional (thank-you pages, etc.).",
    });
  }

  if (audit.totals.noindex > 0) {
    insights.push({
      severity: "info",
      title: `${audit.totals.noindex} pages are set to noindex`,
      body: "Confirm these are intentional (cart, account, thank-you) and not blocking valuable content.",
    });
  }

  if (audit.totals.avgScore >= 85) {
    insights.push({
      severity: "good",
      title: `Strong site-wide average: ${audit.totals.avgScore}/100`,
      body: "Your on-page SEO baseline is solid. Highest leverage is probably content updates, internal linking, and earning backlinks rather than fixing on-page basics.",
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">SEO</h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <ExportButton targetId="report-content" filename="seo-audit" label="Export all" />
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
          Every WordPress page and post audited against on-page SEO best practices, with the
          biggest fixes ranked by traffic impact.
        </p>
      </header>

      <div id="report-content" className="bg-white dark:bg-[#1c1c1e]">

      <div className="mb-10">
        <KPIGrid
          accent="green"
          kpis={[
            { label: "Pages audited", value: audit.totals.total.toLocaleString(), hint: `${audit.totals.pages} pages, ${audit.totals.posts} posts` },
            { label: "Average score", value: `${audit.totals.avgScore}/100`, hint: audit.totals.avgScore >= 85 ? "strong" : audit.totals.avgScore >= 70 ? "decent" : "needs work" },
            { label: "Missing descriptions", value: audit.totals.missingDescription.toLocaleString(), hint: "Yoast meta description not set" },
            { label: "Thin content", value: audit.totals.thinContent.toLocaleString(), hint: "<300 words" },
          ]}
        />
      </div>

      {insights.length > 0 && (
        <Section
          id="section-insights"
          title="What stands out"
          description="Computed from current site state — wording updates as the audit numbers do."
          action={<ExportButton targetId="section-insights" filename="seo-insights" />}
        >
          <InsightGrid>
            {insights.map((i, idx) => (
              <Insight key={idx} severity={i.severity} title={i.title}>{i.body}</Insight>
            ))}
          </InsightGrid>
        </Section>
      )}

      {/* High-impact section streams in via Suspense — needs GA4 query */}
      <Suspense fallback={<SectionSkeleton title="Highest-impact fixes" description="Cross-stitching audit × GA4 traffic…" bodyHeight={400} />}>
        <HighImpactSection searchParams={searchParams} />
      </Suspense>

      <Section
        id="section-worst"
        title={`Pages with the lowest scores (${audit.worst.length})`}
        description="Sorted by score ascending — start at the top."
        action={<ExportButton targetId="section-worst" filename="seo-worst" />}
      >
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="px-5 py-3">Page</th>
                  <th className="px-5 py-3 text-right">Score</th>
                  <th className="px-5 py-3 text-right">Words</th>
                  <th className="px-5 py-3">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {audit.worst.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">
                      Every page scores ≥70. Solid baseline.
                    </td>
                  </tr>
                )}
                {audit.worst.map((r) => (
                  <tr key={r.id} className="text-gray-700 dark:text-gray-300">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{r.title}</div>
                      <div className="text-xs">
                        <a href={r.link} target="_blank" rel="noopener noreferrer" className="font-mono text-gray-500 hover:underline">
                          {r.path}
                        </a>
                        <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-gray-700 dark:bg-white/5 dark:text-gray-400">
                          {r.type}
                        </span>
                      </div>
                    </td>
                    <td className={`px-5 py-3 text-right tabular-nums font-semibold ${scoreCls(r.score)}`}>{r.score}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{r.wordCount.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <ul className="space-y-1">
                        {r.issues.slice(0, 4).map((iss, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${severityCls(iss.severity)}`}>
                              {iss.severity}
                            </span>
                            <span className="text-gray-700 dark:text-gray-300">{iss.message}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      <Section
        id="section-all"
        title={`All audited pages (${audit.rows.length})`}
        description="The full list — sorted score ascending so the worst surfaces first."
        action={<ExportButton targetId="section-all" filename="seo-all" />}
      >
        <Card padded={false}>
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-gray-200/70 bg-white/95 backdrop-blur dark:border-white/5 dark:bg-[#1f1f22]/95">
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="px-5 py-3">Page</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3 text-right">Title len</th>
                  <th className="px-5 py-3 text-right">Desc len</th>
                  <th className="px-5 py-3 text-right">Words</th>
                  <th className="px-5 py-3 text-right">Issues</th>
                  <th className="px-5 py-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {audit.rows.map((r) => (
                  <tr key={r.id} className="text-gray-700 dark:text-gray-300">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{r.title}</div>
                      <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-gray-500 hover:underline">
                        {r.path}
                      </a>
                    </td>
                    <td className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500">{r.type}</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${r.titleLength === 0 ? "text-rose-600" : r.titleLength < 25 || r.titleLength > 65 ? "text-amber-600" : ""}`}>
                      {r.titleLength}
                    </td>
                    <td className={`px-5 py-3 text-right tabular-nums ${r.descriptionLength === 0 ? "text-rose-600" : r.descriptionLength < 70 || r.descriptionLength > 165 ? "text-amber-600" : ""}`}>
                      {r.descriptionLength || "—"}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{r.wordCount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{r.issues.length}</td>
                    <td className={`px-5 py-3 text-right tabular-nums font-semibold ${scoreCls(r.score)}`}>{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      </div>
    </main>
  );
}
