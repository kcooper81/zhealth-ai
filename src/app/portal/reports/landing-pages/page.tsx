/**
 * Landing Pages report — for every page that received traffic, computes:
 *   GA4 visits → cta_click → form_submit → Keap tag count → enrollment → revenue
 *
 * Cross-stitches the three datasets via the LANDING_PAGE_TAG_MAP:
 *   path → Keap tag → contacts created in window with that tag → Thinkific
 *   purchases attributable via utm_campaign carried over.
 */
import Section, { Card } from "@/components/portal/Section";
import DateRangePicker from "@/components/portal/DateRangePicker";
import ExportButton from "@/components/portal/ExportButton";
import KPIGrid from "@/components/portal/KPIGrid";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import { parseTimeRange } from "@/lib/time-range";
import { getServerSession } from "@/lib/auth";
import { cachedFetch, TTL, rangeCacheSegment } from "@/lib/cache";
import {
  getPagesWithEntrances,
  getEventCounts,
  getEcommerce,
} from "@/lib/google-analytics";
import { listAllContactsInRange } from "@/lib/keap";
import { LANDING_PAGE_TAG_MAP, findLandingPageRow } from "@/lib/landing-page-tag-map";
import { LandingPagesFunnelTable } from "@/components/portal/ReportTables";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

async function loadLandingPages(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;
  const rangeSeg = rangeCacheSegment(range);

  const session = (await getServerSession()) as any;
  const accessToken = session?.accessToken;

  const [pages, formSubmits, ctaClicks, enrollClicks, campaignRev, contactsInWindow] = await Promise.all([
    accessToken
      ? cachedFetch(`ga4:pages:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getPagesWithEntrances(accessToken, "website", rangeKey, 200)
        ).catch(() => [])
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:event:form_submit:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEventCounts(accessToken, "website", rangeKey, "form_submit", ["pagePath"], 200)
        ).catch(() => [])
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:event:cta_click:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEventCounts(accessToken, "website", rangeKey, "cta_click", ["pagePath"], 200)
        ).catch(() => [])
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:event:enroll_click:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEventCounts(accessToken, "website", rangeKey, "enroll_click", ["pagePath"], 200)
        ).catch(() => [])
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:ecom:campaign:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEcommerce(accessToken, "website", rangeKey, "sessionCampaignName", 100)
        ).catch(() => [])
      : Promise.resolve([] as any[]),
    // Pull every contact created in window with their tag_ids — we'll
    // count per LP tag below, which gives us "leads in window" instead
    // of all-time count.
    cachedFetch(
      `keap:contacts:in-range-with-tags:${rangeSeg}`,
      TTL.KEAP_STATS,
      () => listAllContactsInRange(range.from.toISOString(), range.to.toISOString()).catch(() => [])
    ),
  ]);

  // Count how many in-window contacts have each LP tag
  const keapByTag = new Map<number, number>();
  for (const c of contactsInWindow as any[]) {
    if (c.tag_ids) {
      for (const tid of c.tag_ids) keapByTag.set(tid, (keapByTag.get(tid) ?? 0) + 1);
    }
  }

  // Index helpers
  const formByPath = new Map<string, number>(formSubmits.map((r: any) => [r.dims.pagePath || "", r.eventCount]));
  const ctaByPath = new Map<string, number>(ctaClicks.map((r: any) => [r.dims.pagePath || "", r.eventCount]));
  const enrollByPath = new Map<string, number>(enrollClicks.map((r: any) => [r.dims.pagePath || "", r.eventCount]));
  const campaignRevMap = new Map<string, number>(campaignRev.map((r: any) => [r.dim, r.revenue]));
  // keapByTag computed above from in-window contacts

  // For each page from GA4, build the funnel
  const funnel = pages.map((p: any) => {
    const lp = findLandingPageRow(p.page);
    const keapTagCount = lp ? keapByTag.get(lp.tagId) ?? 0 : 0;
    const revenue = lp?.utmCampaign ? (campaignRevMap.get(lp.utmCampaign) ?? 0) : 0;

    return {
      page: p.page,
      label: lp?.label || p.page,
      pageviews: p.pageviews,
      users: p.users,
      sessions: p.sessions,
      entrances: p.entrances,
      bounceRate: p.bounceRate,
      ctaClicks: ctaByPath.get(p.page) ?? 0,
      formSubmits: formByPath.get(p.page) ?? 0,
      enrollClicks: enrollByPath.get(p.page) ?? 0,
      keapTagged: keapTagCount,
      lp,
      revenue,
    };
  });

  // Order: prioritize mapped LPs that have signups, then by traffic
  funnel.sort((a, b) => {
    if (a.lp && !b.lp) return -1;
    if (!a.lp && b.lp) return 1;
    return b.pageviews - a.pageviews;
  });

  const totals = {
    pageviews: funnel.reduce((s, r) => s + r.pageviews, 0),
    formSubmits: funnel.reduce((s, r) => s + r.formSubmits, 0),
    enrollClicks: funnel.reduce((s, r) => s + r.enrollClicks, 0),
    revenue: funnel.reduce((s, r) => s + r.revenue, 0),
    mappedLPs: funnel.filter((r) => r.lp).length,
  };

  return { range, accessToken: !!accessToken, funnel, totals };
}

export const metadata = { title: "Landing Pages — Z-Health Portal" };

export default async function LandingPagesReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await loadLandingPages(searchParams);

  const insights: Array<{ severity: "good" | "warn" | "alert" | "info"; title: string; body: string }> = [];

  // Best-converting LP by form_submit ÷ pageviews
  const mappedLPs = data.funnel.filter((r) => r.lp && r.pageviews > 0);
  if (mappedLPs.length > 0) {
    const best = [...mappedLPs].sort((a, b) => (b.formSubmits / b.pageviews) - (a.formSubmits / a.pageviews))[0];
    if (best.formSubmits > 0) {
      const rate = (best.formSubmits / best.pageviews) * 100;
      insights.push({
        severity: "good",
        title: `Best-converting landing page: ${best.label}`,
        body: `${rate.toFixed(2)}% form-submit rate (${best.formSubmits} signups / ${best.pageviews} views).`,
      });
    }

    const worst = [...mappedLPs]
      .filter((r) => r.pageviews > 50)
      .sort((a, b) => (a.formSubmits / a.pageviews) - (b.formSubmits / b.pageviews))[0];
    if (worst && worst.formSubmits / worst.pageviews < 0.01) {
      insights.push({
        severity: "warn",
        title: `${worst.label} has high traffic but low conversion`,
        body: `${worst.pageviews.toLocaleString()} views → ${worst.formSubmits} form submits (${((worst.formSubmits / worst.pageviews) * 100).toFixed(2)}%). Worth reviewing form placement, copy, or offer.`,
      });
    }
  }

  if (data.totals.mappedLPs === 0) {
    insights.push({
      severity: "info",
      title: "No landing pages mapped yet",
      body: "Edit src/lib/landing-page-tag-map.ts and add rows for each LP that captures emails. Until then, the funnel columns won't tie to Keap.",
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Landing Pages
          </h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <ExportButton targetId="report-content" filename="landing-pages-report" label="Export all" />
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
          How does each page convert from visit to lead to sale?
        </p>
      </header>

      {!data.accessToken && (
        <Card className="mb-8 border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>GA4 not connected.</strong> Sign in via <a href="/portal/analytics" className="underline">Analytics</a> first.
          </p>
        </Card>
      )}

      <div id="report-content" className="bg-white dark:bg-[#1c1c1e]">

      <div className="mb-10">
        <KPIGrid
          accent="green"
          kpis={[
            { label: "Pages with traffic", value: data.funnel.length.toLocaleString(), hint: `${data.totals.mappedLPs} mapped to Keap tags` },
            { label: "Form submits", value: data.totals.formSubmits.toLocaleString() },
            { label: "Enroll clicks", value: data.totals.enrollClicks.toLocaleString(), hint: "WP → Thinkific outbound" },
            { label: "Attributed revenue", value: data.totals.revenue > 0 ? fmtMoney(data.totals.revenue) : "—", hint: "via utm_campaign" },
          ]}
        />
      </div>

      {insights.length > 0 && (
        <Section
          id="section-insights"
          title="What stands out"
          description="Computed from current data."
          action={<ExportButton targetId="section-insights" filename="landing-pages-insights" />}
        >
          <InsightGrid>
            {insights.map((i, idx) => (
              <Insight key={idx} severity={i.severity} title={i.title}>{i.body}</Insight>
            ))}
          </InsightGrid>
        </Section>
      )}

      <Section
        id="section-funnel"
        title={`Per-page funnel (${data.funnel.length})`}
        description="Search by title or path. Click headers to sort. Use the chips to narrow."
        action={<ExportButton targetId="section-funnel" filename="landing-pages-funnel" />}
      >
        {data.funnel.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500">No GA4 page data yet.</p>
          </Card>
        ) : (
          <LandingPagesFunnelTable
            rows={data.funnel.map((r) => ({
              page: r.page,
              label: r.label,
              pageviews: r.pageviews,
              ctaClicks: r.ctaClicks,
              formSubmits: r.formSubmits,
              enrollClicks: r.enrollClicks,
              keapTagged: r.keapTagged,
              hasMappedTag: !!r.lp,
              mappedTagId: r.lp?.tagId,
              revenue: r.revenue,
            }))}
          />
        )}
      </Section>

      <Section
        id="section-mapping"
        title="Landing-page → Keap-tag mapping"
        description="Edit src/lib/landing-page-tag-map.ts to add or change."
        action={<ExportButton targetId="section-mapping" filename="landing-pages-mapping" />}
      >
        <Card padded={false}>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="px-5 py-3">Path</th>
                <th className="px-5 py-3">Label</th>
                <th className="px-5 py-3">Keap tag</th>
                <th className="px-5 py-3">UTM campaign</th>
                <th className="px-5 py-3">Course</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {LANDING_PAGE_TAG_MAP.map((lp) => (
                <tr key={lp.path} className="text-gray-700 dark:text-gray-300">
                  <td className="px-5 py-3 font-mono text-xs text-gray-900 dark:text-gray-100">{lp.path}</td>
                  <td className="px-5 py-3">{lp.label}</td>
                  <td className="px-5 py-3 font-mono text-xs">{lp.tagId}</td>
                  <td className="px-5 py-3 font-mono text-xs">{lp.utmCampaign || "—"}</td>
                  <td className="px-5 py-3 font-mono text-xs">{lp.thinkificCourseSlug || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      </div>
    </main>
  );
}
