/**
 * Google Search Console dashboard — what queries and pages are landing
 * organic traffic, where the click-through opportunities are, and which
 * URLs Chrome users are flagging as slow (Core Web Vitals).
 *
 * Reads through the same NextAuth Google sign-in as GA4 — needs the
 * webmasters.readonly scope (granted on the next sign-in after the auth
 * config update) plus Owner/Full-user access to the GSC property.
 */
import { Suspense } from "react";
import Section, { Card } from "@/components/portal/Section";
import KPIGrid from "@/components/portal/KPIGrid";
import BarList from "@/components/portal/BarList";
import LineChart from "@/components/portal/LineChart";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import DateRangePicker from "@/components/portal/DateRangePicker";
import ExportButton from "@/components/portal/ExportButton";
import { SectionSkeleton, KPIGridSkeleton } from "@/components/portal/Skeletons";
import { getServerSession } from "@/lib/auth";
import { cachedFetch, TTL } from "@/lib/cache";
import {
  getOverview,
  getTopQueries,
  getTopPagesGSC,
  getStrikingDistance,
  getLowCTRQueries,
  getByDimension,
  getDailyTrend,
} from "@/lib/google-search-console";
import { getPageSpeedBatch, rollupVitals } from "@/lib/pagespeed";
import { parseTimeRange } from "@/lib/time-range";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const SITE_URL = process.env.WP_SITE_URL || "https://zhealtheducation.com";

async function GSCBody({
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
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
        <p className="text-sm text-amber-900 dark:text-amber-200">
          <strong>Sign in with Google first.</strong> Visit <a href="/portal/analytics" className="underline">/portal/analytics</a>{" "}
          and sign in. The consent screen will request the new <code>webmasters.readonly</code> scope —
          once granted, this page populates.
        </p>
      </Card>
    );
  }

  // Try the overview first — if it errors, surface the real message
  let gscError: string | null = null;
  const safeOverview = await getOverview(accessToken, rangeKey).catch((e) => {
    gscError = e instanceof Error ? e.message : "Search Console fetch failed";
    return null;
  });

  if (gscError) {
    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
        <p className="text-sm text-amber-900 dark:text-amber-200">
          <strong>Search Console error:</strong>
        </p>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          {gscError}
        </p>
        <details className="mt-3 text-xs text-amber-800 dark:text-amber-300">
          <summary className="cursor-pointer">If sign-in didn&apos;t fix it</summary>
          <ol className="mt-2 ml-5 list-decimal space-y-1">
            <li>Go to <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="underline">myaccount.google.com/permissions</a> and remove access for &ldquo;Z-Health AI&rdquo; (so Google forces a fresh consent prompt).</li>
            <li>In <a href="https://search.google.com/search-console/users" target="_blank" rel="noopener noreferrer" className="underline">Search Console &rarr; Users</a>, confirm your Google account is listed as Owner or Full user.</li>
            <li>Sign back in at <a href="/portal/analytics" className="underline">/portal/analytics</a>. The consent screen will request the new <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/30">webmasters.readonly</code> permission.</li>
          </ol>
        </details>
      </Card>
    );
  }

  const [overview, topQueries, topPages, striking, lowCtr, devices, countries, daily] = await Promise.all([
    Promise.resolve(safeOverview),
    // catch OUTSIDE cachedFetch so failures don't poison the cache —
    // we'd rather retry next page load than show empty data for 30min
    cachedFetch(`gsc:queries:${rangeKey}`, TTL.GA4_REPORTS, () =>
      getTopQueries(accessToken, rangeKey, 100)
    ).catch(() => []),
    cachedFetch(`gsc:pages:${rangeKey}`, TTL.GA4_REPORTS, () =>
      getTopPagesGSC(accessToken, rangeKey, 100)
    ).catch(() => []),
    cachedFetch(`gsc:striking:${rangeKey}`, TTL.GA4_REPORTS, () =>
      getStrikingDistance(accessToken, rangeKey, 30)
    ).catch(() => []),
    cachedFetch(`gsc:low-ctr:${rangeKey}`, TTL.GA4_REPORTS, () =>
      getLowCTRQueries(accessToken, rangeKey, 30)
    ).catch(() => []),
    cachedFetch(`gsc:devices:${rangeKey}`, TTL.GA4_REPORTS, () =>
      getByDimension(accessToken, rangeKey, "device", 10)
    ).catch(() => []),
    cachedFetch(`gsc:countries:${rangeKey}`, TTL.GA4_REPORTS, () =>
      getByDimension(accessToken, rangeKey, "country", 15)
    ).catch(() => []),
    cachedFetch(`gsc:daily:${rangeKey}`, TTL.GA4_REPORTS, () =>
      getDailyTrend(accessToken, rangeKey)
    ).catch(() => []),
  ]);

  if (!overview) {
    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
        <p className="text-sm text-amber-900 dark:text-amber-200">
          <strong>No Search Console data yet for this date range.</strong> Try a wider window or check that the property has any traffic.
        </p>
      </Card>
    );
  }

  // Insights computed live from data
  const insights: Array<{ severity: "good" | "warn" | "alert" | "info"; title: string; body: string }> = [];

  const brandedClicks = topQueries
    .filter((q) => /\b(z[-\s]?health|zhealth)\b/i.test(q.query))
    .reduce((s, q) => s + q.clicks, 0);
  const totalClicks = overview.clicks || 1;
  const brandedShare = (brandedClicks / totalClicks) * 100;
  if (brandedClicks > 0) {
    insights.push({
      severity: brandedShare > 70 ? "warn" : "info",
      title: `Branded queries are ${brandedShare.toFixed(0)}% of clicks`,
      body: brandedShare > 70
        ? "Most search traffic is people already searching for your brand. The site isn't yet ranking widely for non-branded discovery terms — that's the next growth lever."
        : "Healthy mix. Branded traffic is people who already know you; non-branded is new discovery.",
    });
  }

  if (striking.length > 0) {
    const totalImpr = striking.reduce((s, q) => s + q.impressions, 0);
    insights.push({
      severity: "good",
      title: `${striking.length} striking-distance keywords (${totalImpr.toLocaleString()} impressions)`,
      body: "These queries already rank on page 2. Light on-page optimization (better title, more body content, internal links) tends to push them onto page 1 fast.",
    });
  }

  if (lowCtr.length > 0) {
    insights.push({
      severity: "warn",
      title: `${lowCtr.length} top-10 queries have low CTR`,
      body: "People see your search snippet but don't click. Likely the title or meta description doesn't match what they expected — strongest leverage is rewriting these on the corresponding pages.",
    });
  }

  if (overview.position > 30) {
    insights.push({
      severity: "alert",
      title: `Average position is ${overview.position.toFixed(1)} — well past page 1`,
      body: "Most queries don't reach the SERP. Focus on building authority for a focused topic cluster rather than spreading across many keywords.",
    });
  }

  // Build line chart series from daily data (sorted ascending by date)
  const dailySorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const dailyClicksSeries = [
    { label: "Clicks", color: "#3b82f6", points: dailySorted.map((d) => ({ x: d.date, y: d.clicks })) },
    { label: "Impressions ÷ 10", color: "#10b981", points: dailySorted.map((d) => ({ x: d.date, y: Math.round(d.impressions / 10) })) },
  ];

  return (
    <>
      <div className="mb-10">
        <KPIGrid
          accent="blue"
          kpis={[
            { label: "Clicks", value: overview.clicks.toLocaleString(), hint: range.label.toLowerCase() },
            { label: "Impressions", value: overview.impressions.toLocaleString() },
            { label: "Avg CTR", value: `${(overview.ctr * 100).toFixed(2)}%` },
            { label: "Avg position", value: overview.position.toFixed(1), hint: overview.position <= 10 ? "page 1" : overview.position <= 20 ? "page 2" : "deep" },
          ]}
        />
      </div>

      {insights.length > 0 && (
        <Section
          id="section-insights"
          title="What stands out"
          description="Computed from GSC data."
          action={<ExportButton targetId="section-insights" filename="gsc-insights" />}
        >
          <InsightGrid>
            {insights.map((i, idx) => (
              <Insight key={idx} severity={i.severity} title={i.title}>{i.body}</Insight>
            ))}
          </InsightGrid>
        </Section>
      )}

      {dailySorted.length > 1 && (
        <Section
          id="section-trend"
          title="Search trend"
          description={`Daily clicks + impressions over ${range.label.toLowerCase()}.`}
          action={<ExportButton targetId="section-trend" filename="gsc-trend" />}
        >
          <Card>
            <LineChart series={dailyClicksSeries} height={240} formatY={(v) => v.toLocaleString()} />
          </Card>
        </Section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          id="section-striking"
          title="Striking-distance keywords"
          description="Queries ranking on page 2 (positions 11–20). Cheapest cleanups in SEO."
          action={<ExportButton targetId="section-striking" filename="gsc-striking" />}
        >
          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-3">Query</th>
                    <th className="px-5 py-3 text-right">Pos</th>
                    <th className="px-5 py-3 text-right">Impr</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {striking.length === 0 && (
                    <tr><td colSpan={3} className="px-5 py-4 text-center text-xs text-gray-500">No striking-distance queries.</td></tr>
                  )}
                  {striking.slice(0, 20).map((q, i) => (
                    <tr key={i} className="text-gray-700 dark:text-gray-300">
                      <td className="px-5 py-2 text-gray-900 dark:text-gray-100">{q.query}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{q.position.toFixed(1)}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{q.impressions.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Section>

        <Section
          id="section-low-ctr"
          title="Title-rewrite candidates"
          description="High-impression top-10 queries with low CTR. Rewriting the page title here is the highest-leverage change."
          action={<ExportButton targetId="section-low-ctr" filename="gsc-low-ctr" />}
        >
          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-3">Query</th>
                    <th className="px-5 py-3 text-right">CTR</th>
                    <th className="px-5 py-3 text-right">Impr</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {lowCtr.length === 0 && (
                    <tr><td colSpan={3} className="px-5 py-4 text-center text-xs text-gray-500">No flagged queries.</td></tr>
                  )}
                  {lowCtr.slice(0, 20).map((q, i) => (
                    <tr key={i} className="text-gray-700 dark:text-gray-300">
                      <td className="px-5 py-2 text-gray-900 dark:text-gray-100">{q.query}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{(q.ctr * 100).toFixed(1)}%</td>
                      <td className="px-5 py-2 text-right tabular-nums">{q.impressions.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Section>
      </div>

      <Section
        id="section-queries"
        title="Top queries"
        description={`The 50 queries that drove the most search clicks in ${range.label.toLowerCase()}.`}
        action={<ExportButton targetId="section-queries" filename="gsc-top-queries" />}
      >
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="px-5 py-3">Query</th>
                  <th className="px-5 py-3 text-right">Clicks</th>
                  <th className="px-5 py-3 text-right">Impressions</th>
                  <th className="px-5 py-3 text-right">CTR</th>
                  <th className="px-5 py-3 text-right">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {topQueries.slice(0, 50).map((q, i) => (
                  <tr key={i} className="text-gray-700 dark:text-gray-300">
                    <td className="px-5 py-2 font-medium text-gray-900 dark:text-gray-100">{q.query}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{q.clicks.toLocaleString()}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{q.impressions.toLocaleString()}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{(q.ctr * 100).toFixed(2)}%</td>
                    <td className="px-5 py-2 text-right tabular-nums">{q.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      <Section
        id="section-pages"
        title="Top pages"
        description="Which URLs are landing search traffic. Sorted by clicks."
        action={<ExportButton targetId="section-pages" filename="gsc-top-pages" />}
      >
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="px-5 py-3">Page</th>
                  <th className="px-5 py-3 text-right">Clicks</th>
                  <th className="px-5 py-3 text-right">Impressions</th>
                  <th className="px-5 py-3 text-right">CTR</th>
                  <th className="px-5 py-3 text-right">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {topPages.slice(0, 50).map((p, i) => (
                  <tr key={i} className="text-gray-700 dark:text-gray-300">
                    <td className="px-5 py-2">
                      <a href={p.page} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-gray-900 hover:underline dark:text-gray-100">
                        {(() => { try { return new URL(p.page).pathname; } catch { return p.page; } })()}
                      </a>
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums">{p.clicks.toLocaleString()}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{p.impressions.toLocaleString()}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{(p.ctr * 100).toFixed(2)}%</td>
                    <td className="px-5 py-2 text-right tabular-nums">{p.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          id="section-devices"
          title="Devices"
          description="How users are searching."
          action={<ExportButton targetId="section-devices" filename="gsc-devices" />}
        >
          <Card>
            <BarList
              color="blue"
              items={devices.map((d) => ({
                label: d.key,
                value: d.clicks,
                sublabel: `${d.impressions.toLocaleString()} impr · ${(d.ctr * 100).toFixed(1)}% CTR`,
              }))}
              formatValue={(n) => `${n.toLocaleString()} clicks`}
            />
          </Card>
        </Section>

        <Section
          id="section-countries"
          title="Top countries"
          description="Where search traffic comes from."
          action={<ExportButton targetId="section-countries" filename="gsc-countries" />}
        >
          <Card>
            <BarList
              color="purple"
              items={countries.slice(0, 10).map((c) => ({
                label: (c.key || "").toUpperCase(),
                value: c.clicks,
                sublabel: `${c.impressions.toLocaleString()} impr · pos ${c.position.toFixed(1)}`,
              }))}
              formatValue={(n) => `${n.toLocaleString()} clicks`}
            />
          </Card>
        </Section>
      </div>

      {/* Core Web Vitals streams in separately — PageSpeed API is slow */}
      <Suspense fallback={<SectionSkeleton title="Core Web Vitals" description="Calling PageSpeed Insights for top pages…" bodyHeight={400} />}>
        <CoreWebVitalsSection topPages={topPages.slice(0, 10).map((p) => p.page)} />
      </Suspense>
    </>
  );
}

async function CoreWebVitalsSection({ topPages }: { topPages: string[] }) {
  if (topPages.length === 0) {
    return (
      <Section id="section-cwv" title="Core Web Vitals" description="No pages to score yet.">
        <Card><p className="text-sm text-gray-500">Need GSC top-pages data first.</p></Card>
      </Section>
    );
  }

  // Always include the homepage even if not in topPages
  const targets = Array.from(new Set([SITE_URL, ...topPages])).slice(0, 12);
  const [mobile, desktop] = await Promise.all([
    getPageSpeedBatch(targets, "MOBILE", 4),
    getPageSpeedBatch(targets, "DESKTOP", 4),
  ]);
  const mobileRollup = rollupVitals(mobile);
  const desktopRollup = rollupVitals(desktop);

  const merged = mobile.map((m) => ({ mobile: m, desktop: desktop.find((d) => d.url === m.url) || null }));

  const totalPoor = mobile.filter((m) => m.lcp?.rating === "poor" || m.inp?.rating === "poor" || m.cls?.rating === "poor").length;

  return (
    <Section
      id="section-cwv"
      title="Core Web Vitals"
      description="Field data from Chrome users — same source GSC uses for its CWV report. Scoring the top GSC pages."
      action={<ExportButton targetId="section-cwv" filename="gsc-cwv" />}
    >
      <KPIGrid
        accent={totalPoor > 0 ? "rose" : "green"}
        kpis={[
          { label: "Pages tested", value: mobileRollup.total, hint: `${mobileRollup.withFieldData} have CrUX field data` },
          { label: "Mobile avg perf", value: mobileRollup.avgPerformance != null ? `${mobileRollup.avgPerformance}/100` : "—" },
          { label: "Desktop avg perf", value: desktopRollup.avgPerformance != null ? `${desktopRollup.avgPerformance}/100` : "—" },
          { label: "Pages with poor CWV", value: totalPoor, hint: "any of LCP / INP / CLS in 'poor' tier" },
        ]}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          { label: "LCP (Largest Contentful Paint)", roll: mobileRollup.lcp, target: "≤2.5s" },
          { label: "INP (Interaction to Next Paint)", roll: mobileRollup.inp, target: "≤200ms" },
          { label: "CLS (Cumulative Layout Shift)", roll: mobileRollup.cls, target: "≤0.1" },
        ].map(({ label, roll, target }) => {
          const total = roll.good + roll.ni + roll.poor;
          return (
            <Card key={label}>
              <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {label}
              </div>
              <div className="mt-1 mb-3 text-xs text-gray-500">target {target} · mobile field data</div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                {total > 0 && (
                  <>
                    <div className="bg-emerald-500" style={{ width: `${(roll.good / total) * 100}%` }} />
                    <div className="bg-amber-500" style={{ width: `${(roll.ni / total) * 100}%` }} />
                    <div className="bg-rose-500" style={{ width: `${(roll.poor / total) * 100}%` }} />
                  </>
                )}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="text-emerald-700 dark:text-emerald-400">{roll.good} good</div>
                <div className="text-amber-700 dark:text-amber-400">{roll.ni} OK</div>
                <div className="text-rose-700 dark:text-rose-400">{roll.poor} poor</div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="px-5 py-3">Page</th>
                <th className="px-5 py-3 text-right">Mobile perf</th>
                <th className="px-5 py-3 text-right">LCP</th>
                <th className="px-5 py-3 text-right">INP</th>
                <th className="px-5 py-3 text-right">CLS</th>
                <th className="px-5 py-3">Top fix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {merged.map((row, i) => {
                const m = row.mobile;
                const ratingCls = (r: "good" | "needs-improvement" | "poor" | undefined) =>
                  r === "good" ? "text-emerald-700 dark:text-emerald-400" :
                  r === "poor" ? "text-rose-700 dark:text-rose-400" :
                  r === "needs-improvement" ? "text-amber-700 dark:text-amber-400" :
                  "text-gray-400";
                return (
                  <tr key={i} className="text-gray-700 dark:text-gray-300">
                    <td className="px-5 py-2">
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-gray-900 hover:underline dark:text-gray-100">
                        {(() => { try { return new URL(m.url).pathname || "/"; } catch { return m.url; } })()}
                      </a>
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums">{m.performance != null ? m.performance : "—"}</td>
                    <td className={`px-5 py-2 text-right tabular-nums ${ratingCls(m.lcp?.rating)}`}>
                      {m.lcp ? `${(m.lcp.ms / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className={`px-5 py-2 text-right tabular-nums ${ratingCls(m.inp?.rating)}`}>
                      {m.inp ? `${m.inp.ms}ms` : "—"}
                    </td>
                    <td className={`px-5 py-2 text-right tabular-nums ${ratingCls(m.cls?.rating)}`}>
                      {m.cls ? m.cls.value.toFixed(2) : "—"}
                    </td>
                    <td className="px-5 py-2 text-xs text-gray-500">
                      {m.topOpportunity ? (
                        <span title={m.topOpportunity.description}>
                          {m.topOpportunity.title}
                          {m.topOpportunity.savingsMs > 0 && (
                            <span className="ml-1 text-gray-400">(-{Math.round(m.topOpportunity.savingsMs)}ms)</span>
                          )}
                        </span>
                      ) : "—"}
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

export const metadata = { title: "Search Console — Z-Health Portal" };

export default function GSCDashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Search Console</h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <ExportButton targetId="report-content" filename="gsc-report" label="Export all" />
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
          What does Google show people who search for us, and how are they responding?
        </p>
      </header>

      <div id="report-content" className="bg-white dark:bg-[#1c1c1e]">
        <Suspense fallback={
          <>
            <KPIGridSkeleton />
            <SectionSkeleton title="Search trend" description="Loading clicks + impressions over time…" bodyHeight={280} />
            <SectionSkeleton title="Striking-distance keywords" description="Loading…" bodyHeight={300} />
          </>
        }>
          <GSCBody searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
