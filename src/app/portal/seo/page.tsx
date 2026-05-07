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
import FilterableTable, { type Column } from "@/components/portal/FilterableTable";
import { runSEOAudit } from "@/lib/wp-seo-audit";
import { getServerSession } from "@/lib/auth";
import { cachedFetch, TTL } from "@/lib/cache";
import { getTopPages } from "@/lib/google-analytics";
import { getTopQueries, getStrikingDistance, getLowCTRQueries, getOverview, getTopPagesGSC } from "@/lib/google-search-console";
import { getKeywordSuggestions } from "@/lib/keyword-research";
import { getPageSpeedBatch, rollupVitals } from "@/lib/pagespeed";
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

async function SearchConsoleSection({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;
  const session = (await getServerSession()) as any;
  const accessToken = session?.accessToken;

  if (!accessToken) {
    return (
      <Section
        id="section-gsc"
        title="From Google Search Console"
        description="Sign in with Google to see real query performance."
      >
        <Card>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Search Console reads through the same Google sign-in as GA4. After we deploy this update,
            click <a href="/portal/analytics" className="underline">Sign in</a> on Analytics —
            you&apos;ll be asked to grant the additional <code>webmasters.readonly</code> scope.
            Once granted, this section will populate with clicks, impressions, CTR, and position
            for every query that landed traffic on the site.
          </p>
        </Card>
      </Section>
    );
  }

  const [overview, top, striking, lowCtr] = await Promise.all([
    cachedFetch(`gsc:overview:${rangeKey}`, TTL.GA4_OVERVIEW, () =>
      getOverview(accessToken, rangeKey)
    ).catch(() => null),
    cachedFetch(`gsc:top:${rangeKey}`, TTL.GA4_REPORTS, () =>
      getTopQueries(accessToken, rangeKey, 50)
    ).catch(() => []),
    cachedFetch(`gsc:striking:${rangeKey}`, TTL.GA4_REPORTS, () =>
      getStrikingDistance(accessToken, rangeKey, 25)
    ).catch(() => []),
    cachedFetch(`gsc:low-ctr:${rangeKey}`, TTL.GA4_REPORTS, () =>
      getLowCTRQueries(accessToken, rangeKey, 25)
    ).catch(() => []),
  ]);

  if (!overview) {
    return (
      <Section
        id="section-gsc"
        title="From Google Search Console"
        description="See the Search rankings page for the full diagnostic."
      >
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Couldn&apos;t load Search Console data for this window.
            Open <a href="/portal/gsc" className="underline">Search rankings</a> for the
            specific error + step-by-step fix.
          </p>
        </Card>
      </Section>
    );
  }

  return (
    <Section
      id="section-gsc"
      title="From Google Search Console"
      description={`Real query performance for ${range.label.toLowerCase()}.`}
      action={<ExportButton targetId="section-gsc" filename="seo-gsc" />}
    >
      <div className="mb-6">
        <KPIGrid
          accent="blue"
          kpis={[
            { label: "Clicks", value: overview.clicks.toLocaleString() },
            { label: "Impressions", value: overview.impressions.toLocaleString() },
            { label: "Avg CTR", value: `${(overview.ctr * 100).toFixed(2)}%` },
            { label: "Avg position", value: overview.position.toFixed(1) },
          ]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            Striking-distance keywords (page 2)
          </h3>
          <p className="mt-1 mb-3 text-xs text-gray-500">
            Queries ranking positions 11–20 — the cheapest wins. Small on-page improvements push these onto page 1.
          </p>
          {striking.length === 0 ? (
            <p className="text-xs text-gray-500">No striking-distance queries in this window.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {striking.slice(0, 12).map((q, i) => (
                <li key={i} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-gray-900 dark:text-gray-100">{q.query}</span>
                  <span className="ml-2 flex-shrink-0 text-xs tabular-nums text-gray-500">
                    pos {q.position.toFixed(1)} · {q.impressions.toLocaleString()} impr
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            High-impression / low-CTR queries
          </h3>
          <p className="mt-1 mb-3 text-xs text-gray-500">
            People see your listing in search results but don&apos;t click. Title or meta-description rewrites usually fix this.
          </p>
          {lowCtr.length === 0 ? (
            <p className="text-xs text-gray-500">No low-CTR top-10 queries in this window.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {lowCtr.slice(0, 12).map((q, i) => (
                <li key={i} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-gray-900 dark:text-gray-100">{q.query}</span>
                  <span className="ml-2 flex-shrink-0 text-xs tabular-nums text-gray-500">
                    {(q.ctr * 100).toFixed(1)}% CTR · {q.impressions.toLocaleString()} impr
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card padded={false} className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="px-5 py-3">Top query</th>
                <th className="px-5 py-3 text-right">Clicks</th>
                <th className="px-5 py-3 text-right">Impressions</th>
                <th className="px-5 py-3 text-right">CTR</th>
                <th className="px-5 py-3 text-right">Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {top.slice(0, 25).map((q, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{q.query}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{q.clicks.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{q.impressions.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{(q.ctr * 100).toFixed(2)}%</td>
                  <td className="px-5 py-3 text-right tabular-nums">{q.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Section>
  );
}

async function CoreWebVitalsSummary({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;
  const session = (await getServerSession()) as any;
  const accessToken = session?.accessToken;

  // Pick which URLs to score: GSC top pages if available, otherwise the
  // homepage + top pages from the audit.
  const SITE = process.env.WP_SITE_URL || "https://zhealtheducation.com";
  let urls: string[] = [SITE];
  if (accessToken) {
    try {
      const gscPages = await cachedFetch(`gsc:pages:${rangeKey}`, TTL.GA4_REPORTS, () =>
        getTopPagesGSC(accessToken, rangeKey, 8).catch(() => [])
      );
      urls = Array.from(new Set([SITE, ...gscPages.map((p: any) => p.page)])).slice(0, 8);
    } catch {}
  } else {
    const audit = await runSEOAudit().catch(() => null);
    if (audit) urls = [SITE, ...audit.rows.slice(0, 7).map((r) => r.link)];
  }

  const mobile = await getPageSpeedBatch(urls, "MOBILE", 4);
  const rollup = rollupVitals(mobile);
  const poorPages = mobile.filter(
    (m) => m.lcp?.rating === "poor" || m.inp?.rating === "poor" || m.cls?.rating === "poor"
  );

  return (
    <Section
      id="section-cwv"
      title="Core Web Vitals (mobile)"
      description="Field data from Chrome users — same source GSC uses for its CWV report. Sampling your top GSC pages."
      action={
        <a
          href="/portal/gsc#section-cwv"
          className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
        >
          Full breakdown →
        </a>
      }
    >
      <KPIGrid
        accent={poorPages.length > 0 ? "rose" : "green"}
        kpis={[
          { label: "Pages tested", value: rollup.total, hint: `${rollup.withFieldData} have CrUX field data` },
          { label: "Mobile avg perf", value: rollup.avgPerformance != null ? `${rollup.avgPerformance}/100` : "—" },
          { label: "Pages with poor CWV", value: poorPages.length, hint: "any of LCP / INP / CLS in 'poor' tier" },
          { label: "LCP good / OK / poor", value: `${rollup.lcp.good} / ${rollup.lcp.ni} / ${rollup.lcp.poor}` },
        ]}
      />
      {poorPages.length > 0 && (
        <Card className="mt-4 border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20">
          <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
            {poorPages.length} page{poorPages.length === 1 ? "" : "s"} with poor Core Web Vitals
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {poorPages.slice(0, 6).map((p) => {
              const path = (() => { try { return new URL(p.url).pathname || "/"; } catch { return p.url; } })();
              return (
                <li key={p.url} className="flex items-center justify-between text-rose-900 dark:text-rose-200">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs hover:underline">
                    {path}
                  </a>
                  <span className="ml-3 text-xs">
                    {p.lcp ? `LCP ${(p.lcp.ms / 1000).toFixed(1)}s` : ""}
                    {p.inp ? ` · INP ${p.inp.ms}ms` : ""}
                    {p.cls ? ` · CLS ${p.cls.value.toFixed(2)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-rose-800 dark:text-rose-300">
            Open the <a href="/portal/gsc#section-cwv" className="underline">Search Console page</a> for the full table with the top recommended fix per URL.
          </p>
        </Card>
      )}
    </Section>
  );
}

async function KeywordOpportunitiesSection() {
  const audit = await runSEOAudit().catch(() => null);
  if (!audit) return null;

  // Pick the top 5 highest-traffic-shaped pages by content depth
  const candidates = audit.rows
    .filter((r) => r.derivedFocus && r.wordCount >= 300)
    .sort((a, b) => b.wordCount - a.wordCount)
    .slice(0, 6);

  const opportunities = await Promise.all(
    candidates.map(async (r) => {
      const seed = r.derivedFocus || r.title;
      const suggestions = await getKeywordSuggestions(seed).catch(() => []);
      // Filter out suggestions that are too close to existing title (low value)
      const titleWords = new Set((r.seoTitle || "").toLowerCase().split(/\s+/));
      const fresh = suggestions.filter((s) => {
        const words = s.toLowerCase().split(/\s+/);
        const overlap = words.filter((w) => titleWords.has(w)).length / Math.max(1, words.length);
        return overlap < 0.6 && s.length >= seed.length + 2;
      });
      return { row: r, seed, suggestions: fresh.slice(0, 12) };
    })
  );

  return (
    <Section
      id="section-keywords"
      title="Keyword opportunities"
      description="Long-tail variations from Google Suggest, seeded by your top pages' actual content topics. Use these as new H2/H3 sub-sections, FAQ entries, or new blog post ideas — they're what real users type into Google."
      action={<ExportButton targetId="section-keywords" filename="seo-keyword-opportunities" />}
    >
      <div className="grid gap-6 md:grid-cols-2">
        {opportunities.map(({ row, seed, suggestions }) => (
          <Card key={row.id}>
            <div className="mb-2">
              <a href={row.link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-gray-900 hover:underline dark:text-gray-50">
                {row.title}
              </a>
              <div className="mt-0.5 text-xs text-gray-500">
                <code className="font-mono">{row.path}</code>
                <span className="mx-2">·</span>
                <span>seed: <strong className="text-gray-700 dark:text-gray-300">{seed}</strong></span>
              </div>
            </div>
            {suggestions.length === 0 ? (
              <p className="text-xs text-gray-500">No fresh long-tail variations. The page&apos;s seed term is broad — try refining the focus keyword.</p>
            ) : (
              <ul className="space-y-1">
                {suggestions.map((s, i) => (
                  <li key={i} className="rounded-md border border-gray-200/70 bg-gray-50/50 px-2 py-1 text-xs text-gray-700 dark:border-white/5 dark:bg-white/[0.02] dark:text-gray-300">
                    {s}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[10px] text-gray-500">
              Top phrases on page: {row.topPhrases.slice(0, 4).map((p) => p.phrase).join(" · ") || "—"}
            </p>
          </Card>
        ))}
      </div>
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
          Where can we improve to rank higher in search?
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

      {/* Search Console — clicks, impressions, striking-distance, low-CTR */}
      <Suspense fallback={<SectionSkeleton title="From Google Search Console" description="Real query performance from your GSC property…" bodyHeight={420} />}>
        <SearchConsoleSection searchParams={searchParams} />
      </Suspense>

      {/* Keyword opportunities — Google Suggest variations on actual focus keywords */}
      <Suspense fallback={<SectionSkeleton title="Keyword opportunities" description="Pulling Google autocomplete for your top pages' topics…" bodyHeight={400} />}>
        <KeywordOpportunitiesSection />
      </Suspense>

      {/* Core Web Vitals — same data Google Search Console uses */}
      <Suspense fallback={<SectionSkeleton title="Core Web Vitals" description="Calling PageSpeed Insights for your top pages…" bodyHeight={300} />}>
        <CoreWebVitalsSummary searchParams={searchParams} />
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
        description="Search by title or path. Sort by clicking column headers. Use the chips to narrow to common SEO problems."
        action={<ExportButton targetId="section-all" filename="seo-all" />}
      >
        <FilterableTable
          rows={audit.rows}
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
          columns={[
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
          ] as Column<typeof audit.rows[number]>[]}
        />
      </Section>

      </div>
    </main>
  );
}
