/**
 * Page Flow report data computation — all the GA4 queries + shaping in one
 * place so the page (cached, stale-while-revalidate) and the "Refresh" API
 * route (force-recompute) share identical logic. Returns a plain-serializable
 * snapshot that is cached as a single object.
 */
import {
  getPageFlow,
  getEntrances,
  getConversionTrend,
  getBreakdown,
  getChannelRollup,
  getFunnelSteps,
  getEventCounts,
  getTrafficOverviewWithComparison,
} from "@/lib/google-analytics";
import type { PageFlowRow } from "@/components/portal/ReportTables";

function surfaceOf(host: string): PageFlowRow["surface"] {
  const h = (host || "").toLowerCase();
  if (h.includes("thinkific.com") || h.includes("zuniversity") || h.startsWith("university.") || h.startsWith("courses."))
    return "Thinkific";
  if (h.includes("zhealtheducation.com")) return "WordPress";
  return "Other";
}

export type PageFlowSnapshot = {
  rows: PageFlowRow[];
  entrances: Array<{ page: string; entrances: number; bounceRate: number; conversions: number }>;
  trend: Array<{ date: string; sessions: number; users: number; conversions: number }>;
  channels: Array<{ label: string; sessions: number; users: number; conversions: number; engagementRate: number }>;
  devices: Array<{ label: string; sessions: number; users: number; conversions: number; engagementRate: number }>;
  outbound: Array<{ dims: Record<string, string>; eventCount: number; users: number }>;
  funnelSteps: Array<{ name: string; eventName: string; users: number; events: number }>;
  channelRollup: Array<{ source: string; medium: string; campaign: string; users: number; sessions: number; conversions: number; revenue: number }>;
  overview: Awaited<ReturnType<typeof getTrafficOverviewWithComparison>> | null;
  totalConversions: number;
  wpCount: number;
  tkCount: number;
};

export async function computePageFlowSnapshot(accessToken: string, rangeKey: string): Promise<PageFlowSnapshot> {
  const e: any[] = [];
  const [pages, entrances, trend, channels, devices, outbound, funnelSteps, overview] = await Promise.all([
    getPageFlow(accessToken, "website", rangeKey, 300).catch(() => e),
    getEntrances(accessToken, "website", rangeKey, 200).catch(() => e),
    getConversionTrend(accessToken, "website", rangeKey).catch(() => e),
    getBreakdown(accessToken, "website", rangeKey, "sessionDefaultChannelGroup", 12).catch(() => e),
    getBreakdown(accessToken, "website", rangeKey, "deviceCategory", 5).catch(() => e),
    getEventCounts(accessToken, "website", rangeKey, "click", ["linkDomain"], 20).catch(() => e),
    getFunnelSteps(accessToken, "website", rangeKey, [
      { name: "Sessions", eventName: "session_start" },
      { name: "Viewed a course", eventName: "course_view" },
      { name: "Clicked a CTA", eventName: "cta_click" },
      { name: "Clicked to enroll", eventName: "enroll_click" },
    ]).catch(() => e),
    getTrafficOverviewWithComparison(accessToken, "website", rangeKey).catch(() => null),
  ]);
  const channelRollup = await getChannelRollup(accessToken, "website", rangeKey, 150).catch(() => e);

  const norm = (p: string) => (p || "").replace(/\/+$/, "") || "/";
  const entrMap = new Map<string, number>();
  for (const en of entrances as any[]) entrMap.set(norm(en.page), en.entrances);

  const rows: PageFlowRow[] = (pages as any[]).map((p) => {
    const entr = entrMap.get(norm(p.page)) ?? 0;
    return {
      page: p.page,
      surface: surfaceOf(p.host),
      pageviews: p.pageviews,
      users: p.users,
      sessions: p.sessions,
      entrances: entr,
      exitsEst: Math.round(entr * p.bounceRate),
      bounceRate: p.bounceRate,
      engagementRate: p.engagementRate,
      avgDuration: p.avgDuration,
    };
  });

  const totalConversions = (trend as any[]).reduce((s, d) => s + (d.conversions || 0), 0);

  return {
    rows,
    entrances: entrances as any[],
    trend: trend as any[],
    channels: channels as any[],
    devices: devices as any[],
    outbound: outbound as any[],
    funnelSteps: funnelSteps as any[],
    channelRollup: channelRollup as any[],
    overview: overview as any,
    totalConversions,
    wpCount: rows.filter((r) => r.surface === "WordPress").length,
    tkCount: rows.filter((r) => r.surface === "Thinkific").length,
  };
}

export const PAGE_FLOW_FRESH_SECONDS = 30 * 60; // 30 min fresh window
export const PAGE_FLOW_HARD_SECONDS = 24 * 60 * 60; // snapshot survives 24h
export const pageFlowCacheKey = (rangeKey: string) => `pf:report:v2:${rangeKey}`;
