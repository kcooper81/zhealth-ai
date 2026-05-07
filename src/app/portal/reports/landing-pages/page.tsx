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
import { getContactsWithTag } from "@/lib/keap";
import { LANDING_PAGE_TAG_MAP, findLandingPageRow } from "@/lib/landing-page-tag-map";

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

  const [pages, formSubmits, ctaClicks, enrollClicks, campaignRev, tagCounts] = await Promise.all([
    accessToken
      ? cachedFetch(`ga4:pages:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getPagesWithEntrances(accessToken, "website", rangeKey, 200).catch(() => [])
        )
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:event:form_submit:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEventCounts(accessToken, "website", rangeKey, "form_submit", ["pagePath"], 200).catch(() => [])
        )
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:event:cta_click:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEventCounts(accessToken, "website", rangeKey, "cta_click", ["pagePath"], 200).catch(() => [])
        )
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:event:enroll_click:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEventCounts(accessToken, "website", rangeKey, "enroll_click", ["pagePath"], 200).catch(() => [])
        )
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:ecom:campaign:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEcommerce(accessToken, "website", rangeKey, "sessionCampaignName", 100).catch(() => [])
        )
      : Promise.resolve([] as any[]),
    // For each mapped landing page, pull the Keap tag count
    Promise.all(
      LANDING_PAGE_TAG_MAP.map(async (lp) => {
        try {
          const res = await cachedFetch(
            `keap:contacts-with-tag:${lp.tagId}:count`,
            TTL.KEAP_TAGS,
            () => getContactsWithTag(lp.tagId, { limit: 1 })
          );
          return { tagId: lp.tagId, count: res.count };
        } catch {
          return { tagId: lp.tagId, count: 0 };
        }
      })
    ),
  ]);

  // Index helpers
  const formByPath = new Map<string, number>(formSubmits.map((r: any) => [r.dims.pagePath || "", r.eventCount]));
  const ctaByPath = new Map<string, number>(ctaClicks.map((r: any) => [r.dims.pagePath || "", r.eventCount]));
  const enrollByPath = new Map<string, number>(enrollClicks.map((r: any) => [r.dims.pagePath || "", r.eventCount]));
  const campaignRevMap = new Map<string, number>(campaignRev.map((r: any) => [r.dim, r.revenue]));
  const keapByTag = new Map<number, number>(tagCounts.map((t: any) => [t.tagId, t.count]));

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
          For every page that received traffic in {data.range.label.toLowerCase()}: visits →
          CTA clicks → form submits → Keap tag → enroll clicks → attributed revenue.
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
        title="Per-page funnel"
        description="Mapped landing pages first (rows tied to a Keap tag), then by pageviews."
        action={<ExportButton targetId="section-funnel" filename="landing-pages-funnel" />}
      >
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="px-5 py-3">Page</th>
                  <th className="px-5 py-3 text-right">Views</th>
                  <th className="px-5 py-3 text-right">CTA</th>
                  <th className="px-5 py-3 text-right">Forms</th>
                  <th className="px-5 py-3 text-right">Keap leads</th>
                  <th className="px-5 py-3 text-right">Enroll</th>
                  <th className="px-5 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {data.funnel.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">
                      No GA4 page data yet.
                    </td>
                  </tr>
                )}
                {data.funnel.slice(0, 80).map((r, i) => {
                  const cvr = r.pageviews > 0 ? (r.formSubmits / r.pageviews) * 100 : 0;
                  return (
                    <tr key={`${r.page}-${i}`} className="text-gray-700 dark:text-gray-300">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{r.label}</div>
                        <div className="text-xs text-gray-500">
                          {r.lp ? <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Mapped · tag {r.lp.tagId}</span> : <span className="text-gray-400">{r.page}</span>}
                          {cvr > 0 && (
                            <span className="ml-2 text-[10px] text-gray-500">{cvr.toFixed(2)}% form CVR</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{r.pageviews.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{r.ctaClicks.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{r.formSubmits.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{r.lp ? r.keapTagged.toLocaleString() : <span className="text-gray-400">—</span>}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{r.enrollClicks.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{r.revenue > 0 ? fmtMoney(r.revenue) : <span className="text-gray-400">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
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
