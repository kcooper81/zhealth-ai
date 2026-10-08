/**
 * Page Flow & Conversion report.
 *
 * One place to see every page (WordPress marketing site AND the Thinkific
 * LMS — the GA4 website property tracks both), how people enter and leave,
 * how engaged they are, and how the journey converts: WP page → CTA →
 * Thinkific course → conversion. All data from GA4 (property 336619240).
 */
import Section, { Card } from "@/components/portal/Section";
import DateRangePicker from "@/components/portal/DateRangePicker";
import ExportButton from "@/components/portal/ExportButton";
import KPIGrid from "@/components/portal/KPIGrid";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import Funnel from "@/components/portal/Funnel";
import BarList from "@/components/portal/BarList";
import LineChart from "@/components/portal/LineChart";
import { PageFlowTable, type PageFlowRow } from "@/components/portal/ReportTables";
import { parseTimeRange } from "@/lib/time-range";
import { getServerSession } from "@/lib/auth";
import { getPortalGa4Token } from "@/lib/reports/google-auth";
import { cachedFetch, TTL } from "@/lib/cache";
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

export const dynamic = "force-dynamic";
export const maxDuration = 90;
export const metadata = { title: "Page Flow & Conversion — Z-Health Portal" };

function surfaceOf(host: string): PageFlowRow["surface"] {
  const h = (host || "").toLowerCase();
  if (h.includes("thinkific.com") || h.includes("zuniversity") || h.startsWith("university.") || h.startsWith("courses."))
    return "Thinkific";
  if (h.includes("zhealtheducation.com")) return "WordPress";
  return "Other";
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const num = (n: number) => Math.round(n).toLocaleString();
const dur = (s: number) => {
  const m = Math.floor(s / 60);
  return m ? `${m}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`;
};

async function load(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;
  const session = (await getServerSession()) as any;
  const accessToken = await getPortalGa4Token(session?.accessToken);

  const empty: any[] = [];
  const [pages, entrances, trend, channels, devices, outbound, funnelSteps, overview] = await Promise.all([
    accessToken ? cachedFetch(`pf:pages:${rangeKey}`, TTL.GA4_REPORTS, () => getPageFlow(accessToken, "website", rangeKey, 300)).catch(() => empty) : empty,
    accessToken ? cachedFetch(`pf:entr:${rangeKey}`, TTL.GA4_REPORTS, () => getEntrances(accessToken, "website", rangeKey, 200)).catch(() => empty) : empty,
    accessToken ? cachedFetch(`pf:trend:${rangeKey}`, TTL.GA4_REPORTS, () => getConversionTrend(accessToken, "website", rangeKey)).catch(() => empty) : empty,
    accessToken ? cachedFetch(`pf:chan:${rangeKey}`, TTL.GA4_REPORTS, () => getBreakdown(accessToken, "website", rangeKey, "sessionDefaultChannelGroup", 12)).catch(() => empty) : empty,
    accessToken ? cachedFetch(`pf:dev:${rangeKey}`, TTL.GA4_REPORTS, () => getBreakdown(accessToken, "website", rangeKey, "deviceCategory", 5)).catch(() => empty) : empty,
    accessToken ? cachedFetch(`pf:out:${rangeKey}`, TTL.GA4_REPORTS, () => getEventCounts(accessToken, "website", rangeKey, "click", ["linkDomain"], 20)).catch(() => empty) : empty,
    accessToken ? cachedFetch(`pf:funnel:${rangeKey}`, TTL.GA4_REPORTS, () => getFunnelSteps(accessToken, "website", rangeKey, [
      { name: "Sessions", eventName: "session_start" },
      { name: "Viewed a course", eventName: "course_view" },
      { name: "Clicked a CTA", eventName: "cta_click" },
      { name: "Clicked to enroll", eventName: "enroll_click" },
    ])).catch(() => empty) : empty,
    accessToken ? cachedFetch(`pf:ovw:${rangeKey}`, TTL.GA4_REPORTS, () => getTrafficOverviewWithComparison(accessToken, "website", rangeKey)).catch(() => null) : null,
  ]);

  const channelRollup = accessToken
    ? await cachedFetch(`pf:roll:${rangeKey}`, TTL.GA4_REPORTS, () => getChannelRollup(accessToken!, "website", rangeKey, 150)).catch(() => empty)
    : empty;

  // Entrances come from the landingPage dimension; join them onto pages by path.
  const norm = (p: string) => (p || "").replace(/\/+$/, "") || "/";
  const entrMap = new Map<string, number>();
  for (const e of entrances as any[]) entrMap.set(norm(e.page), e.entrances);

  // Build page rows with surface + honest exit estimate
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
  const wp = rows.filter((r) => r.surface === "WordPress");
  const tk = rows.filter((r) => r.surface === "Thinkific");

  return { range, accessToken: !!accessToken, rows, wp, tk, entrances, trend, channels, devices, outbound, funnelSteps, overview, totalConversions, channelRollup };
}

export default async function PageFlowReportPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const d = await load(searchParams);
  const o = d.overview?.current;
  const ch = d.overview?.changes;
  const convRate = o && o.totalSessions ? (d.totalConversions / o.totalSessions) * 100 : 0;

  // Funnel stages (journey view — per-event reach, not strict sequence)
  const fs = new Map<string, number>((d.funnelSteps as any[]).map((s) => [s.name, s.users]));
  const stages = [
    { label: "Sessions", value: o?.totalSessions || fs.get("Sessions") || 0, hint: "All visits in the window" },
    { label: "Viewed a course", value: fs.get("Viewed a course") || 0, hint: "course_view (Thinkific)" },
    { label: "Clicked a CTA", value: fs.get("Clicked a CTA") || 0, hint: "cta_click (WordPress)" },
    { label: "Converted", value: Math.round(d.totalConversions), hint: "GA4 key events" },
  ];

  // Top entrances + top exits (est)
  const topEntrances = [...d.rows].filter((r) => r.entrances > 0).sort((a, b) => b.entrances - a.entrances).slice(0, 8);
  const topExits = [...d.rows].filter((r) => r.pageviews >= 30).sort((a, b) => b.exitsEst - a.exitsEst).slice(0, 8);

  // ---- Where signups come from (attribution) ----
  const signupsByChannel = [...(d.channels as any[])].filter((c) => c.conversions > 0).sort((a, b) => b.conversions - a.conversions);
  const signupsByLanding = [...(d.entrances as any[])].filter((e) => e.conversions > 0).sort((a, b) => b.conversions - a.conversions).slice(0, 8);
  const rollup = d.channelRollup as any[];
  const aggBy = (key: "source" | "campaign") => {
    const m = new Map<string, number>();
    for (const r of rollup) {
      const k = key === "source" ? `${r.source} / ${r.medium}` : r.campaign;
      if (r.conversions > 0 && k && k !== "(not set)") m.set(k, (m.get(k) || 0) + r.conversions);
    }
    return Array.from(m.entries()).map(([label, conversions]) => ({ label, conversions })).sort((a, b) => b.conversions - a.conversions);
  };
  const signupsBySource = aggBy("source").slice(0, 8);
  const signupsByCampaign = aggBy("campaign").slice(0, 8);

  // WP → Thinkific handoff (outbound clicks to thinkific/course domains)
  const thinkOut = (d.outbound as any[]).filter((r) => /thinkific|zuniversity|courses\./i.test(r.dims.linkDomain || ""));
  const handoffClicks = thinkOut.reduce((s, r) => s + r.eventCount, 0);

  // Insights
  const insights: Array<{ severity: "good" | "warn" | "alert" | "info"; title: string; body: string }> = [];
  const byRate = [...(d.channels as any[])].filter((c) => c.sessions >= 50).sort((a, b) => (b.conversions / b.sessions) - (a.conversions / a.sessions));
  if (byRate[0]) insights.push({ severity: "good", title: `Best-converting channel: ${byRate[0].label}`, body: `${num(byRate[0].conversions)} conversions from ${num(byRate[0].sessions)} sessions (${((byRate[0].conversions / byRate[0].sessions) * 100).toFixed(2)}% rate) — the highest rate of any channel.` });
  const mob = (d.devices as any[]).find((x) => x.label === "mobile");
  const desk = (d.devices as any[]).find((x) => x.label === "desktop");
  if (mob && desk && mob.conversions > desk.conversions) insights.push({ severity: "info", title: "Mobile converts more than desktop", body: `Mobile: ${num(mob.conversions)} conversions from ${num(mob.sessions)} sessions. Desktop: ${num(desk.conversions)} from ${num(desk.sessions)}. Prioritize the mobile experience on key pages.` });
  const hiBounce = [...d.wp].filter((r) => r.pageviews >= 100 && r.bounceRate > 0.6).sort((a, b) => b.pageviews - a.pageviews)[0];
  if (hiBounce) insights.push({ severity: "warn", title: `High traffic, high bounce: ${hiBounce.page}`, body: `${num(hiBounce.pageviews)} views but ${pct(hiBounce.bounceRate)} bounce. Worth reviewing the hook, load speed, or offer.` });
  if (handoffClicks > 0) insights.push({ severity: "info", title: "WordPress → Thinkific handoff", body: `${num(handoffClicks)} outbound clicks to Thinkific/enrollment domains in this window — the bridge from marketing pages into the course platform.` });

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Page Flow &amp; Conversion</h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <ExportButton targetId="report-content" filename="page-flow-report" label="Export all" />
          </div>
        </div>
        <p className="mt-2 max-w-3xl text-gray-600 dark:text-gray-400">
          Every page across the marketing site and the Thinkific LMS — entrances, exits, bounce, engagement, and how the journey converts from a WordPress page into a course enrollment.
        </p>
      </header>

      {!d.accessToken && (
        <Card className="mb-8 border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200"><strong>GA4 not connected.</strong> Sign in via <a href="/portal/analytics" className="underline">Analytics</a> first.</p>
        </Card>
      )}

      <div id="report-content" className="bg-white dark:bg-[#1c1c1e]">
        <div className="mb-10">
          <KPIGrid
            accent="blue"
            kpis={[
              { label: "Sessions", value: num(o?.totalSessions || 0), trend: ch ? { value: Math.round(ch.sessions), positive: ch.sessions >= 0 } : undefined },
              { label: "Users", value: num(o?.totalUsers || 0), trend: ch ? { value: Math.round(ch.users), positive: ch.users >= 0 } : undefined },
              { label: "Pageviews", value: num(o?.totalPageviews || 0), trend: ch ? { value: Math.round(ch.pageviews), positive: ch.pageviews >= 0 } : undefined },
              { label: "Conversions", value: num(d.totalConversions), hint: "GA4 key events" },
              { label: "Conversion rate", value: `${convRate.toFixed(2)}%`, hint: "conversions ÷ sessions" },
              { label: "Avg. engagement", value: dur(o?.avgSessionDuration || 0), hint: `${pct(1 - (o?.bounceRate || 0))} engaged` },
            ]}
          />
        </div>

        <Section id="section-funnel" title="Conversion journey" description="WordPress visit → course view → CTA → conversion. Per-event reach across the window (not a strict step sequence).">
          <Card>
            <Funnel color="green" stages={stages} formatValue={(n) => num(n)} />
          </Card>
        </Section>

        <Section id="section-attribution" title="Where signups come from" description="Conversions (GA4 key events) attributed to the channel, source, landing page, and campaign that drove them.">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">By channel</p>
              <BarList color="green" items={signupsByChannel.map((c) => ({ label: c.label, value: Math.round(c.conversions), sublabel: `${((c.conversions / Math.max(1, c.sessions)) * 100).toFixed(1)}% of ${num(c.sessions)}` }))} />
            </Card>
            <Card>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">By source / medium</p>
              <BarList color="blue" items={signupsBySource.map((c) => ({ label: c.label, value: Math.round(c.conversions) }))} />
            </Card>
            <Card>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">By landing page</p>
              <BarList color="purple" items={signupsByLanding.map((c) => ({ label: c.page || "(not set)", value: Math.round(c.conversions) }))} />
            </Card>
            <Card>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">By campaign</p>
              <BarList color="amber" items={signupsByCampaign.length ? signupsByCampaign.map((c) => ({ label: c.label, value: Math.round(c.conversions) })) : [{ label: "No campaign-tagged conversions", value: 0 }]} />
            </Card>
          </div>
        </Section>

        {insights.length > 0 && (
          <Section id="section-insights" title="What stands out" description="Computed from the current window.">
            <InsightGrid>
              {insights.map((i, idx) => <Insight key={idx} severity={i.severity} title={i.title}>{i.body}</Insight>)}
            </InsightGrid>
          </Section>
        )}

        <Section id="section-trend" title="Traffic & conversions over time">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Sessions / day</p>
              <LineChart height={200} formatY={(n) => num(n)} series={[{ label: "Sessions", color: "#2563eb", points: (d.trend as any[]).map((t) => ({ x: t.date.slice(5), y: t.sessions })) }]} />
            </Card>
            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Conversions / day</p>
              <LineChart height={200} formatY={(n) => num(n)} series={[{ label: "Conversions", color: "#059669", points: (d.trend as any[]).map((t) => ({ x: t.date.slice(5), y: t.conversions })) }]} />
            </Card>
          </div>
        </Section>

        <Section id="section-breakdowns" title="Where traffic comes from & how it converts">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Channels (by sessions)</p>
              <BarList color="blue" items={(d.channels as any[]).slice(0, 8).map((c) => ({ label: c.label, value: c.sessions, sublabel: `${num(c.conversions)} conv · ${pct(c.engagementRate)} eng` }))} />
            </Card>
            <Card>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Devices</p>
              <BarList color="purple" items={(d.devices as any[]).map((c) => ({ label: c.label, value: c.sessions, sublabel: `${num(c.conversions)} conversions` }))} />
            </Card>
            <Card>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Outbound clicks (handoff)</p>
              <BarList color="amber" items={(d.outbound as any[]).slice(0, 8).map((r) => ({ label: r.dims.linkDomain || "(none)", value: r.eventCount, sublabel: /thinkific|zuniversity|courses\./i.test(r.dims.linkDomain || "") ? "→ Thinkific" : undefined }))} />
            </Card>
          </div>
        </Section>

        <Section id="section-entry-exit" title="Entry & exit points">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Top entrances (where sessions start)</p>
              <BarList color="green" items={topEntrances.map((r) => ({ label: r.page, value: r.entrances, sublabel: `${r.surface} · ${pct(r.bounceRate)} bounce` }))} />
            </Card>
            <Card>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Likely exits (estimated)</p>
              <BarList color="rose" items={topExits.map((r) => ({ label: r.page, value: r.exitsEst, sublabel: `${r.surface} · ${pct(r.bounceRate)} bounce` }))} />
              <p className="mt-3 text-[11px] text-gray-400">Estimate = bounced entrances. GA4&apos;s API has no true exit metric; use PostHog/Clarity paths for exact exit flows as that data matures.</p>
            </Card>
          </div>
        </Section>

        <Section
          id="section-pages"
          title={`All pages (${d.rows.length}) — ${d.wp.length} WordPress · ${d.tk.length} Thinkific`}
          description="Search by path, click headers to sort, use the chips to filter by surface, entries, or high bounce."
          action={<ExportButton targetId="section-pages" filename="page-flow-table" />}
        >
          {d.rows.length === 0 ? (
            <Card><p className="text-sm text-gray-500">No GA4 page data yet.</p></Card>
          ) : (
            <PageFlowTable rows={d.rows} />
          )}
        </Section>
      </div>
    </main>
  );
}
