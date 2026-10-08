/**
 * Page Flow & Conversion report.
 *
 * Loads from a single cached snapshot (stale-while-revalidate) so it renders
 * instantly and refreshes in the background; a manual "Refresh" button forces
 * a recompute. Data covers the WordPress site AND the Thinkific LMS (one GA4
 * property), showing entrances/exits, bounce, engagement, the WP→Thinkific
 * conversion funnel, signup attribution, trends, and a full page table.
 */
import Section, { Card } from "@/components/portal/Section";
import DateRangePicker from "@/components/portal/DateRangePicker";
import ExportButton from "@/components/portal/ExportButton";
import RefreshButton from "@/components/portal/RefreshButton";
import KPIGrid from "@/components/portal/KPIGrid";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import Funnel from "@/components/portal/Funnel";
import BarList from "@/components/portal/BarList";
import LineChart from "@/components/portal/LineChart";
import { PageFlowTable, type PageFlowRow } from "@/components/portal/ReportTables";
import { parseTimeRange } from "@/lib/time-range";
import { getServerSession } from "@/lib/auth";
import { getPortalGa4Token } from "@/lib/reports/google-auth";
import { cachedFetchSWR } from "@/lib/cache";
import {
  computePageFlowSnapshot,
  pageFlowCacheKey,
  PAGE_FLOW_FRESH_SECONDS,
  PAGE_FLOW_HARD_SECONDS,
  type PageFlowSnapshot,
} from "@/lib/reports/page-flow-data";

export const dynamic = "force-dynamic";
export const maxDuration = 90;
export const metadata = { title: "Page Flow & Conversion — Z-Health Portal" };

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const num = (n: number) => Math.round(n).toLocaleString();
const dur = (s: number) => {
  const m = Math.floor(s / 60);
  return m ? `${m}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`;
};
const ago = (ts: number) => {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

async function load(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;
  const session = (await getServerSession()) as any;
  const accessToken = await getPortalGa4Token(session?.accessToken);

  if (!accessToken) {
    return { accessToken: false, range, rangeKey, updatedAt: 0, stale: false, snap: null as PageFlowSnapshot | null };
  }

  const { data, updatedAt, stale } = await cachedFetchSWR<PageFlowSnapshot>(
    pageFlowCacheKey(rangeKey),
    PAGE_FLOW_FRESH_SECONDS,
    PAGE_FLOW_HARD_SECONDS,
    () => computePageFlowSnapshot(accessToken, rangeKey)
  );

  return { accessToken: true, range, rangeKey, updatedAt, stale, snap: data };
}

export default async function PageFlowReportPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const d = await load(searchParams);
  const s = d.snap;

  if (!d.accessToken || !s) {
    return (
      <main className="mx-auto max-w-7xl px-8 py-12">
        <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Page Flow &amp; Conversion</h1>
        <Card className="mt-8 border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200"><strong>No analytics data available.</strong> The GA4 service token couldn&apos;t be loaded. Check GOOGLE_REFRESH_TOKEN in the environment.</p>
        </Card>
      </main>
    );
  }

  const rows = s.rows;
  const wp = rows.filter((r) => r.surface === "WordPress");
  const o = s.overview?.current;
  const ch = s.overview?.changes;
  const convRate = o && o.totalSessions ? (s.totalConversions / o.totalSessions) * 100 : 0;

  const fs = new Map<string, number>((s.funnelSteps || []).map((x) => [x.name, x.users]));
  const stages = [
    { label: "Sessions", value: o?.totalSessions || fs.get("Sessions") || 0, hint: "All visits in the window" },
    { label: "Viewed a course", value: fs.get("Viewed a course") || 0, hint: "course_view (Thinkific)" },
    { label: "Clicked a CTA", value: fs.get("Clicked a CTA") || 0, hint: "cta_click (WordPress)" },
    { label: "Converted", value: Math.round(s.totalConversions), hint: "GA4 key events" },
  ];

  const topEntrances = [...rows].filter((r) => r.entrances > 0).sort((a, b) => b.entrances - a.entrances).slice(0, 8);
  const topExits = [...rows].filter((r) => r.pageviews >= 30).sort((a, b) => b.exitsEst - a.exitsEst).slice(0, 8);

  // Attribution
  const signupsByChannel = [...s.channels].filter((c) => c.conversions > 0).sort((a, b) => b.conversions - a.conversions);
  const signupsByLanding = [...s.entrances].filter((en) => en.conversions > 0).sort((a, b) => b.conversions - a.conversions).slice(0, 8);
  const aggBy = (key: "source" | "campaign") => {
    const m = new Map<string, number>();
    for (const r of s.channelRollup) {
      const k = key === "source" ? `${r.source} / ${r.medium}` : r.campaign;
      if (r.conversions > 0 && k && k !== "(not set)") m.set(k, (m.get(k) || 0) + r.conversions);
    }
    return Array.from(m.entries()).map(([label, conversions]) => ({ label, conversions })).sort((a, b) => b.conversions - a.conversions);
  };
  const signupsBySource = aggBy("source").slice(0, 8);
  const signupsByCampaign = aggBy("campaign").slice(0, 8);

  const thinkOut = s.outbound.filter((r) => /thinkific|zuniversity|courses\./i.test(r.dims.linkDomain || ""));
  const handoffClicks = thinkOut.reduce((acc, r) => acc + r.eventCount, 0);

  const insights: Array<{ severity: "good" | "warn" | "alert" | "info"; title: string; body: string }> = [];
  const byRate = [...s.channels].filter((c) => c.sessions >= 50).sort((a, b) => (b.conversions / b.sessions) - (a.conversions / a.sessions));
  if (byRate[0]) insights.push({ severity: "good", title: `Best-converting channel: ${byRate[0].label}`, body: `${num(byRate[0].conversions)} conversions from ${num(byRate[0].sessions)} sessions (${((byRate[0].conversions / byRate[0].sessions) * 100).toFixed(2)}% rate) — the highest rate of any channel.` });
  const mob = s.devices.find((x) => x.label === "mobile");
  const desk = s.devices.find((x) => x.label === "desktop");
  if (mob && desk && mob.conversions > desk.conversions) insights.push({ severity: "info", title: "Mobile converts more than desktop", body: `Mobile: ${num(mob.conversions)} conversions from ${num(mob.sessions)} sessions. Desktop: ${num(desk.conversions)} from ${num(desk.sessions)}. Prioritize the mobile experience on key pages.` });
  const hiBounce = [...wp].filter((r) => r.pageviews >= 100 && r.bounceRate > 0.6).sort((a, b) => b.pageviews - a.pageviews)[0];
  if (hiBounce) insights.push({ severity: "warn", title: `High traffic, high bounce: ${hiBounce.page}`, body: `${num(hiBounce.pageviews)} views but ${pct(hiBounce.bounceRate)} bounce. Worth reviewing the hook, load speed, or offer.` });
  if (handoffClicks > 0) insights.push({ severity: "info", title: "WordPress → Thinkific handoff", body: `${num(handoffClicks)} outbound clicks to Thinkific/enrollment domains in this window — the bridge from marketing pages into the course platform.` });

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Page Flow &amp; Conversion</h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <RefreshButton endpoint={`/api/portal/page-flows/refresh?range=${d.rangeKey}`} />
            <ExportButton targetId="report-content" filename="page-flow-report" label="Export all" />
          </div>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600 dark:text-gray-400">
          <span className="max-w-3xl">Every page across the marketing site and the Thinkific LMS — entrances, exits, bounce, engagement, and how the journey converts into an enrollment.</span>
        </p>
        <p className="mt-2 flex items-center gap-2 text-xs text-gray-400">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${d.stale ? "bg-amber-400" : "bg-emerald-400"}`} />
          Data cached · updated {ago(d.updatedAt)}{d.stale ? " · refreshing in background" : ""}. Click Refresh to pull live now.
        </p>
      </header>

      <div id="report-content" className="bg-white dark:bg-[#1c1c1e]">
        <div className="mb-10">
          <KPIGrid
            accent="blue"
            kpis={[
              { label: "Sessions", value: num(o?.totalSessions || 0), trend: ch ? { value: Math.round(ch.sessions), positive: ch.sessions >= 0 } : undefined },
              { label: "Users", value: num(o?.totalUsers || 0), trend: ch ? { value: Math.round(ch.users), positive: ch.users >= 0 } : undefined },
              { label: "Pageviews", value: num(o?.totalPageviews || 0), trend: ch ? { value: Math.round(ch.pageviews), positive: ch.pageviews >= 0 } : undefined },
              { label: "Conversions", value: num(s.totalConversions), hint: "GA4 key events" },
              { label: "Conversion rate", value: `${convRate.toFixed(2)}%`, hint: "conversions ÷ sessions" },
              { label: "Avg. engagement", value: dur(o?.avgSessionDuration || 0), hint: `${pct(1 - (o?.bounceRate || 0))} engaged` },
            ]}
          />
        </div>

        <Section id="section-funnel" title="Conversion journey" description="WordPress visit → course view → CTA → conversion. Per-event reach across the window (not a strict step sequence).">
          <Card><Funnel color="green" stages={stages} formatValue={(n) => num(n)} /></Card>
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
              <LineChart height={200} formatY={(n) => num(n)} series={[{ label: "Sessions", color: "#2563eb", points: s.trend.map((t) => ({ x: t.date.slice(5), y: t.sessions })) }]} />
            </Card>
            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Conversions / day</p>
              <LineChart height={200} formatY={(n) => num(n)} series={[{ label: "Conversions", color: "#059669", points: s.trend.map((t) => ({ x: t.date.slice(5), y: t.conversions })) }]} />
            </Card>
          </div>
        </Section>

        <Section id="section-breakdowns" title="Where traffic comes from & how it converts">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Channels (by sessions)</p>
              <BarList color="blue" items={s.channels.slice(0, 8).map((c) => ({ label: c.label, value: c.sessions, sublabel: `${num(c.conversions)} conv · ${pct(c.engagementRate)} eng` }))} />
            </Card>
            <Card>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Devices</p>
              <BarList color="purple" items={s.devices.map((c) => ({ label: c.label, value: c.sessions, sublabel: `${num(c.conversions)} conversions` }))} />
            </Card>
            <Card>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Outbound clicks (handoff)</p>
              <BarList color="amber" items={s.outbound.slice(0, 8).map((r) => ({ label: r.dims.linkDomain || "(none)", value: r.eventCount, sublabel: /thinkific|zuniversity|courses\./i.test(r.dims.linkDomain || "") ? "→ Thinkific" : undefined }))} />
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
          title={`All pages (${rows.length}) — ${s.wpCount} WordPress · ${s.tkCount} Thinkific`}
          description="Search by path, click headers to sort, use the chips to filter by surface, entries, or high bounce."
          action={<ExportButton targetId="section-pages" filename="page-flow-table" />}
        >
          {rows.length === 0 ? (
            <Card><p className="text-sm text-gray-500">No GA4 page data yet.</p></Card>
          ) : (
            <PageFlowTable rows={rows} />
          )}
        </Section>
      </div>
    </main>
  );
}
