/**
 * Landing Pages — where sessions start, how sticky those pages are, and how
 * well they convert. Built on GA4's landingPage dimension (entrances) +
 * bounce / engagement / avg time / conversions (key events), which all
 * populate today. Loads from a cached snapshot (stale-while-revalidate).
 */
import Section, { Card } from "@/components/portal/Section";
import DateRangePicker from "@/components/portal/DateRangePicker";
import ExportButton from "@/components/portal/ExportButton";
import KPIGrid from "@/components/portal/KPIGrid";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import BarList from "@/components/portal/BarList";
import { LandingTable, type LandingRow } from "@/components/portal/ReportTables";
import { parseTimeRange } from "@/lib/time-range";
import { getServerSession } from "@/lib/auth";
import { getPortalGa4Token } from "@/lib/reports/google-auth";
import { cachedFetchSWR } from "@/lib/cache";
import { getEntrances } from "@/lib/google-analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = { title: "Landing Pages — Z-Health Portal" };

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const num = (n: number) => Math.round(n).toLocaleString();
const ago = (ts: number) => {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

async function load(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;
  const session = (await getServerSession()) as any;
  const token = await getPortalGa4Token(session?.accessToken);
  if (!token) return { ok: false as const, range, rangeKey, updatedAt: 0, stale: false, rows: [] as LandingRow[] };

  const { data, updatedAt, stale } = await cachedFetchSWR(
    `lp:report:${rangeKey}`,
    30 * 60,
    24 * 60 * 60,
    () => getEntrances(token, "website", rangeKey, 300)
  );

  const rows: LandingRow[] = (data || []).map((e) => ({
    page: e.page,
    entrances: e.entrances,
    bounceRate: e.bounceRate,
    engagementRate: e.engagementRate,
    avgDuration: e.avgDuration,
    conversions: e.conversions,
    convRate: e.entrances ? e.conversions / e.entrances : 0,
  }));

  return { ok: true as const, range, rangeKey, updatedAt, stale, rows };
}

export default async function LandingPagesReportPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const d = await load(searchParams);

  if (!d.ok) {
    return (
      <main className="mx-auto max-w-7xl px-8 py-12">
        <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Landing Pages</h1>
        <Card className="mt-8 border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200"><strong>No analytics data available.</strong> The GA4 service token couldn&apos;t be loaded.</p>
        </Card>
      </main>
    );
  }

  const rows = d.rows;
  const totalEntr = rows.reduce((s, r) => s + r.entrances, 0);
  const totalConv = rows.reduce((s, r) => s + r.conversions, 0);
  const wBounce = totalEntr ? rows.reduce((s, r) => s + r.bounceRate * r.entrances, 0) / totalEntr : 0;
  const convRate = totalEntr ? totalConv / totalEntr : 0;

  const topConv = [...rows].filter((r) => r.conversions > 0).sort((a, b) => b.conversions - a.conversions).slice(0, 8);
  const topEntr = [...rows].sort((a, b) => b.entrances - a.entrances).slice(0, 8);

  const insights: Array<{ severity: "good" | "warn" | "alert" | "info"; title: string; body: string }> = [];
  const bestRate = [...rows].filter((r) => r.entrances >= 50 && r.conversions > 0).sort((a, b) => b.convRate - a.convRate)[0];
  if (bestRate) insights.push({ severity: "good", title: `Best-converting entry page: ${bestRate.page}`, body: `${(bestRate.convRate * 100).toFixed(2)}% conversion (${num(bestRate.conversions)} from ${num(bestRate.entrances)} entrances).` });
  const leak = [...rows].filter((r) => r.entrances >= 100 && r.conversions === 0).sort((a, b) => b.entrances - a.entrances)[0];
  if (leak) insights.push({ severity: "warn", title: `High traffic, zero conversions: ${leak.page}`, body: `${num(leak.entrances)} entrances, ${pct(leak.bounceRate)} bounce, ${pct(leak.engagementRate)} engaged — but no conversions. Review the offer/CTA on this entry page.` });
  const bouncy = [...rows].filter((r) => r.entrances >= 100).sort((a, b) => b.bounceRate - a.bounceRate)[0];
  if (bouncy && bouncy.bounceRate > 0.6) insights.push({ severity: "alert", title: `Highest bounce among busy entries: ${bouncy.page}`, body: `${pct(bouncy.bounceRate)} of ${num(bouncy.entrances)} entrances leave immediately. Worth checking load speed, message match, and above-the-fold content.` });

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Landing Pages</h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <ExportButton targetId="report-content" filename="landing-pages-report" label="Export all" />
          </div>
        </div>
        <p className="mt-2 max-w-3xl text-gray-600 dark:text-gray-400">Where sessions start, how engaged those visitors are, and which entry pages actually produce signups.</p>
        <p className="mt-2 flex items-center gap-2 text-xs text-gray-400">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${d.stale ? "bg-amber-400" : "bg-emerald-400"}`} />
          Data cached · updated {ago(d.updatedAt)}{d.stale ? " · refreshing in background" : ""}.
        </p>
      </header>

      <div id="report-content" className="bg-white dark:bg-[#1c1c1e]">
        <div className="mb-10">
          <KPIGrid
            accent="purple"
            kpis={[
              { label: "Entry pages", value: num(rows.length) },
              { label: "Entrances", value: num(totalEntr), hint: "sessions that start on a page" },
              { label: "Conversions", value: num(totalConv), hint: "GA4 key events on entry sessions" },
              { label: "Conversion rate", value: `${(convRate * 100).toFixed(2)}%` },
              { label: "Avg. bounce", value: pct(wBounce), hint: "traffic-weighted" },
            ]}
          />
        </div>

        {insights.length > 0 && (
          <Section id="section-insights" title="What stands out" description="Computed from the current window.">
            <InsightGrid>
              {insights.map((i, idx) => <Insight key={idx} severity={i.severity} title={i.title}>{i.body}</Insight>)}
            </InsightGrid>
          </Section>
        )}

        <Section id="section-top" title="Top entry pages">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Most conversions</p>
              <BarList color="green" items={topConv.length ? topConv.map((r) => ({ label: r.page || "(not set)", value: Math.round(r.conversions), sublabel: `${(r.convRate * 100).toFixed(1)}% of ${num(r.entrances)}` })) : [{ label: "No conversions recorded on entry pages", value: 0 }]} />
            </Card>
            <Card>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Most entrances</p>
              <BarList color="blue" items={topEntr.map((r) => ({ label: r.page || "(not set)", value: r.entrances, sublabel: `${pct(r.bounceRate)} bounce · ${num(r.conversions)} conv` }))} />
            </Card>
          </div>
        </Section>

        <Section
          id="section-table"
          title={`All entry pages (${rows.length})`}
          description="Search by path, click headers to sort, use the chips to filter by converters, high bounce, or engagement."
          action={<ExportButton targetId="section-table" filename="landing-pages-table" />}
        >
          {rows.length === 0 ? <Card><p className="text-sm text-gray-500">No GA4 landing-page data yet.</p></Card> : <LandingTable rows={rows} />}
        </Section>
      </div>
    </main>
  );
}
