/**
 * Channels report — pivot of every traffic channel against visits / leads /
 * revenue, joined to the Keap-tag side via the landing-page tag map.
 *
 * Pull keys per row:
 *   GA4:    sessionSource × sessionMedium × sessionCampaignName
 *   Keap:   contacts created in window matched to landing pages by lead_source_id
 *   Thinkific:  enrollments / orders attributable via utm_campaign carry-over
 */
import Section, { Card } from "@/components/portal/Section";
import DateRangePicker from "@/components/portal/DateRangePicker";
import ExportButton from "@/components/portal/ExportButton";
import BarList from "@/components/portal/BarList";
import KPIGrid from "@/components/portal/KPIGrid";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import { parseTimeRange, pctChange } from "@/lib/time-range";
import { getServerSession } from "@/lib/auth";
import { cachedFetch, TTL, rangeCacheSegment } from "@/lib/cache";
import { getChannelRollup, getEcommerce } from "@/lib/google-analytics";
import { listAllContactsInRange } from "@/lib/keap";
import { LANDING_PAGE_TAG_MAP } from "@/lib/landing-page-tag-map";
import { ChannelPivotTable } from "@/components/portal/ReportTables";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

async function loadChannels(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;
  const rangeSeg = rangeCacheSegment(range);

  const session = (await getServerSession()) as any;
  const accessToken = session?.accessToken;

  const [channels, campaignRevenue, sourceRevenue, contacts] = await Promise.all([
    accessToken
      ? cachedFetch(`ga4:channels:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getChannelRollup(accessToken, "website", rangeKey, 100).catch(() => [])
        )
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:ecom:campaign:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEcommerce(accessToken, "website", rangeKey, "sessionCampaignName", 50).catch(() => [])
        )
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:ecom:source:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEcommerce(accessToken, "website", rangeKey, "sessionSource", 50).catch(() => [])
        )
      : Promise.resolve([] as any[]),
    cachedFetch(
      `keap:contacts:in-range:${rangeSeg}`,
      TTL.KEAP_STATS,
      () => listAllContactsInRange(range.from.toISOString(), range.to.toISOString()).catch(() => [])
    ),
  ]);

  // Keap leads by lead_source_id, matched against the LP tag map
  const leadsBySourceId = new Map<number, number>();
  for (const c of contacts) {
    if (c.lead_source_id) {
      leadsBySourceId.set(c.lead_source_id, (leadsBySourceId.get(c.lead_source_id) ?? 0) + 1);
    }
  }

  // GA4 channel rollup → augment each row with revenue from campaignRevenue.
  // We track whether the revenue lookup actually matched something so we can
  // distinguish "$0 because attribution didn't match" from "$0 actual revenue".
  const campaignRevMap = new Map(
    campaignRevenue.map((r: any) => [r.dim, r.revenue])
  );
  const sourceRevMap = new Map(sourceRevenue.map((r: any) => [r.dim, r.revenue]));

  const enriched = channels.map((c: any) => {
    const directRev = c.revenue;
    const campaignRev = campaignRevMap.get(c.campaign);
    const sourceRev = sourceRevMap.get(c.source);
    const matched = directRev > 0 || campaignRev !== undefined || sourceRev !== undefined;
    return {
      ...c,
      revenue: directRev || campaignRev || sourceRev || 0,
      revenueAttributed: matched,
    };
  });

  // Aggregate by source for the source-level summary
  const bySource = new Map<string, { source: string; sessions: number; users: number; conversions: number; revenue: number }>();
  for (const r of enriched) {
    const s = bySource.get(r.source) ?? { source: r.source, sessions: 0, users: 0, conversions: 0, revenue: 0 };
    s.sessions += r.sessions;
    s.users += r.users;
    s.conversions += r.conversions;
    s.revenue += r.revenue;
    bySource.set(r.source, s);
  }
  const sourceSummary = Array.from(bySource.values()).sort((a, b) => b.sessions - a.sessions);

  const totalSessions = enriched.reduce((s: number, r: any) => s + r.sessions, 0);
  const totalUsers = enriched.reduce((s: number, r: any) => s + r.users, 0);
  const totalConversions = enriched.reduce((s: number, r: any) => s + r.conversions, 0);
  const totalRevenue = enriched.reduce((s: number, r: any) => s + r.revenue, 0);
  const totalLeads = contacts.length;

  return {
    range,
    accessToken: !!accessToken,
    channels: enriched.sort((a: any, b: any) => b.sessions - a.sessions),
    sourceSummary,
    totals: { totalSessions, totalUsers, totalConversions, totalRevenue, totalLeads },
    leadsBySourceId,
  };
}

export const metadata = { title: "Channels — Z-Health Portal" };

export default async function ChannelsReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await loadChannels(searchParams);

  const top10 = data.channels.slice(0, 10);
  const conversionRate = data.totals.totalSessions > 0 ? (data.totals.totalConversions / data.totals.totalSessions) : 0;
  const valuePerSession = data.totals.totalSessions > 0 ? data.totals.totalRevenue / data.totals.totalSessions : 0;

  // Insights — written live from data
  const insights: Array<{ severity: "good" | "warn" | "alert" | "info"; title: string; body: string }> = [];
  if (data.sourceSummary.length > 0) {
    const top = data.sourceSummary[0];
    const pct = data.totals.totalSessions > 0 ? Math.round((top.sessions / data.totals.totalSessions) * 100) : 0;
    insights.push({
      severity: "info",
      title: `${top.source} drives ${pct}% of all sessions`,
      body: `${top.sessions.toLocaleString()} sessions in ${data.range.label.toLowerCase()}, ${top.users.toLocaleString()} users, ${top.revenue > 0 ? fmtMoney(top.revenue) : "no attributed revenue"}.`,
    });
  }
  const bestRev = [...data.channels].filter((c: any) => c.revenue > 0).sort((a: any, b: any) => b.revenue - a.revenue)[0];
  if (bestRev) {
    insights.push({
      severity: "good",
      title: `Highest-revenue channel: ${bestRev.source} / ${bestRev.medium}`,
      body: `${fmtMoney(bestRev.revenue)} from ${bestRev.sessions.toLocaleString()} sessions${bestRev.campaign && bestRev.campaign !== "(not set)" ? ` (campaign: ${bestRev.campaign})` : ""}.`,
    });
  }
  const noConvHighTraffic = data.channels.filter((c: any) => c.sessions > 50 && c.conversions === 0);
  if (noConvHighTraffic.length > 0) {
    const top = noConvHighTraffic[0];
    insights.push({
      severity: "warn",
      title: `${noConvHighTraffic.length} channels: traffic but no conversions`,
      body: `Biggest is ${top.source}/${top.medium} — ${top.sessions.toLocaleString()} sessions and zero conversion events. Check that conversion events are configured in GA4.`,
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Channels
          </h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <ExportButton targetId="report-content" filename="channels-report" label="Export all" />
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
          Which traffic sources actually drive sales?
        </p>
      </header>

      {!data.accessToken && (
        <Card className="mb-8 border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>GA4 not connected.</strong> Sign in with the Google account that has access to{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900/30">zhealtheducation.com</code> —
            this report needs a live GA4 token. Open <a href="/portal/analytics" className="underline">Analytics</a> to authenticate, then come back.
          </p>
        </Card>
      )}

      <div id="report-content" className="bg-white dark:bg-[#1c1c1e]">

      <div className="mb-10">
        <KPIGrid
          accent="blue"
          kpis={[
            { label: "Sessions", value: data.totals.totalSessions.toLocaleString(), hint: `${data.channels.length} unique channels` },
            { label: "Users", value: data.totals.totalUsers.toLocaleString() },
            { label: "Conversions", value: data.totals.totalConversions.toLocaleString(), hint: data.totals.totalSessions > 0 ? `${(conversionRate * 100).toFixed(2)}% rate` : undefined },
            { label: "Revenue", value: data.totals.totalRevenue > 0 ? fmtMoney(data.totals.totalRevenue) : "—", hint: data.totals.totalSessions > 0 ? `${fmtMoney(valuePerSession)} / session` : undefined },
          ]}
        />
      </div>

      {insights.length > 0 && (
        <Section
          id="section-insights"
          title="What stands out"
          description="Computed from current data — wording updates as numbers change."
          action={<ExportButton targetId="section-insights" filename="channels-insights" />}
        >
          <InsightGrid>
            {insights.map((i, idx) => (
              <Insight key={idx} severity={i.severity} title={i.title}>
                {i.body}
              </Insight>
            ))}
          </InsightGrid>
        </Section>
      )}

      {data.sourceSummary.length > 0 && (
        <Section
          id="section-sources"
          title="Top sources"
          description="Aggregate sessions per source (utm_source / referrer)."
          action={<ExportButton targetId="section-sources" filename="channels-sources" />}
        >
          <Card>
            <BarList
              color="blue"
              items={data.sourceSummary.slice(0, 10).map((s) => ({
                label: s.source,
                value: s.sessions,
                sublabel: s.revenue > 0 ? `${fmtMoney(s.revenue)} revenue · ${s.users} users` : `${s.users} users`,
              }))}
              formatValue={(n) => `${n.toLocaleString()} sessions`}
            />
          </Card>
        </Section>
      )}

      <Section
        id="section-pivot"
        title={`Channel pivot (${data.channels.length})`}
        description={`Search source / medium / campaign. Click headers to sort. ${data.range.label}.`}
        action={<ExportButton targetId="section-pivot" filename="channels-pivot" />}
      >
        {data.channels.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500">
              {data.accessToken ? "No GA4 channel data yet for this window." : "Sign in to GA4 to populate."}
            </p>
          </Card>
        ) : (
          <ChannelPivotTable rows={data.channels} />
        )}
      </Section>

      <Section
        id="section-keap-leads"
        title="Keap leads — by lead_source_id"
        description="What lead_source_id values landed in the window. Cross-reference src/lib/landing-page-tag-map.ts to label them."
        action={<ExportButton targetId="section-keap-leads" filename="channels-keap-leads" />}
      >
        <Card>
          {data.leadsBySourceId.size === 0 ? (
            <p className="text-sm text-gray-500">No new Keap contacts with a lead_source_id in this window.</p>
          ) : (
            <BarList
              color="green"
              items={Array.from(data.leadsBySourceId.entries())
                .map(([sourceId, count]) => {
                  const knownLp = LANDING_PAGE_TAG_MAP.find((r) => r.leadSourceId === sourceId);
                  return {
                    label: knownLp ? knownLp.label : `Source ${sourceId}`,
                    value: count,
                    sublabel: knownLp ? `tag ${knownLp.tagId} · source ${sourceId}` : `unmapped — source ${sourceId}`,
                  };
                })
                .sort((a, b) => b.value - a.value)
                .slice(0, 12)}
            />
          )}
        </Card>
      </Section>

      </div>
    </main>
  );
}
