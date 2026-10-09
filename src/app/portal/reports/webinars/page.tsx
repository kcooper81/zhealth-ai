/**
 * Webinars — masterclass reporting for the marketing team. Sourced from Keap
 * tags (WebinarJam registrations sync in). Shows a comparison table, trend,
 * source performance, benchmark insights, and a per-masterclass funnel
 * (Registered → Replay → Sale). Loads from a cached snapshot (SWR).
 */
import Section, { Card } from "@/components/portal/Section";
import ExportButton from "@/components/portal/ExportButton";
import KPIGrid from "@/components/portal/KPIGrid";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import Funnel from "@/components/portal/Funnel";
import BarList from "@/components/portal/BarList";
import LineChart from "@/components/portal/LineChart";
import { WebinarCompareTable } from "@/components/portal/ReportTables";
import { getServerSession } from "@/lib/auth";
import { cachedFetchSWR } from "@/lib/cache";
import {
  getWebinarStats,
  WEBINAR_CACHE_KEY,
  WEBINAR_FRESH_SECONDS,
  WEBINAR_HARD_SECONDS,
  type WebinarStat,
} from "@/lib/reports/webinar-stats";

export const dynamic = "force-dynamic";
export const maxDuration = 90;
export const metadata = { title: "Webinars — Z-Health Portal" };

const num = (n: number) => Math.round(n).toLocaleString();
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const ago = (ts: number) => {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};
// LineChart sorts its X axis as strings, so use an ISO date (YYYY-MM-DD from
// the YYYYMMDD dateKey) — sorts chronologically and reads clearly.
const isoFromDateKey = (k: string) =>
  k && k.length === 8 ? `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}` : k;

async function load() {
  const session = await getServerSession();
  if (!session) return { ok: false as const, updatedAt: 0, stale: false, stats: [] as WebinarStat[] };
  const { data, updatedAt, stale } = await cachedFetchSWR<WebinarStat[]>(
    WEBINAR_CACHE_KEY, WEBINAR_FRESH_SECONDS, WEBINAR_HARD_SECONDS, () => getWebinarStats()
  );
  return { ok: true as const, updatedAt, stale, stats: data || [] };
}

export default async function WebinarsReportPage() {
  const d = await load();
  const stats = d.stats;

  const totalReg = stats.reduce((s, w) => s + w.registered, 0);
  const totalReplay = stats.reduce((s, w) => s + w.replaySignups, 0);
  const totalSale = stats.reduce((s, w) => s + w.saleClaimed, 0);
  const withSales = stats.filter((w) => w.saleClaimed > 0);
  const avgRegToSale = withSales.length ? withSales.reduce((s, w) => s + w.regToSale, 0) / withSales.length : 0;

  // Source performance across all webinars
  const sourceTotals = new Map<string, number>();
  for (const w of stats) for (const [src, v] of Object.entries(w.registeredBySource)) sourceTotals.set(src, (sourceTotals.get(src) || 0) + v);
  const sourceRanked = Array.from(sourceTotals.entries()).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  // Trend (chronological)
  const chrono = [...stats].filter((w) => w.dateKey).sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  // Insights
  const insights: Array<{ severity: "good" | "warn" | "alert" | "info"; title: string; body: string }> = [];
  const biggest = [...stats].sort((a, b) => b.registered - a.registered)[0];
  if (biggest) insights.push({ severity: "info", title: `Biggest turnout: ${biggest.webinar}`, body: `${num(biggest.registered)} registered (top source: ${biggest.topSource}).` });
  const bestConv = [...withSales].sort((a, b) => b.regToSale - a.regToSale)[0];
  if (bestConv) insights.push({ severity: "good", title: `Best registration→sale: ${bestConv.webinar}`, body: `${pct(bestConv.regToSale)} of ${num(bestConv.registered)} registrants bought (${num(bestConv.saleClaimed)} sales).` });
  if (sourceRanked[0]) insights.push({ severity: "info", title: `Top registration channel: ${sourceRanked[0][0]}`, body: `${num(sourceRanked[0][1])} registrations across all masterclasses from ${sourceRanked[0][0]}.` });
  const bestReplay = [...stats].filter((w) => w.replaySignups > 0).sort((a, b) => b.regToReplay - a.regToReplay)[0];
  if (bestReplay) insights.push({ severity: "info", title: `Strongest replay interest: ${bestReplay.webinar}`, body: `${pct(bestReplay.regToReplay)} of registrants signed up for the replay (${num(bestReplay.replaySignups)}).` });

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Webinars</h1>
          <ExportButton targetId="report-content" filename="webinars-report" label="Export all" />
        </div>
        <p className="mt-2 max-w-3xl text-gray-600 dark:text-gray-400">
          Masterclass performance from Keap (WebinarJam registrations sync in as tags): registrations, source split, replay interest, and sales — for the team&apos;s webinar reporting.
        </p>
        <p className="mt-2 flex items-center gap-2 text-xs text-gray-400">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${d.stale ? "bg-amber-400" : "bg-emerald-400"}`} />
          Data cached · updated {ago(d.updatedAt)}{d.stale ? " · refreshing in background" : ""}.
        </p>
      </header>

      {!d.ok ? (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20"><p className="text-sm text-amber-900 dark:text-amber-200">Sign in to view.</p></Card>
      ) : stats.length === 0 ? (
        <Card><p className="text-sm text-gray-500">No masterclass tags found in Keap yet.</p></Card>
      ) : (
        <div id="report-content" className="bg-white dark:bg-[#1c1c1e]">
          <div className="mb-10">
            <KPIGrid
              accent="amber"
              kpis={[
                { label: "Masterclasses", value: num(stats.length) },
                { label: "Total registered", value: num(totalReg) },
                { label: "Replay signups", value: num(totalReplay) },
                { label: "Sales", value: num(totalSale) },
                { label: "Avg reg→sale", value: avgRegToSale ? pct(avgRegToSale) : "—", hint: "webinars with sales" },
              ]}
            />
          </div>

          {insights.length > 0 && (
            <Section id="section-insights" title="What stands out">
              <InsightGrid>
                {insights.map((i, idx) => <Insight key={idx} severity={i.severity} title={i.title}>{i.body}</Insight>)}
              </InsightGrid>
            </Section>
          )}

          <Section id="section-compare" title={`Masterclass comparison (${stats.length})`} description="Sort by any column, search, and export for your webinar report." action={<ExportButton targetId="section-compare" filename="webinar-comparison" />}>
            <WebinarCompareTable rows={stats.map((w) => ({ webinar: w.webinar, registered: w.registered, replaySignups: w.replaySignups, saleClaimed: w.saleClaimed, regToReplay: w.regToReplay, regToSale: w.regToSale, topSource: w.topSource }))} />
          </Section>

          <Section id="section-trend" title="Registrations over time">
            <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
              <Card>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Registered per masterclass</p>
                <LineChart height={220} formatY={(n) => num(n)} series={[{ label: "Registered", color: "#f59e0b", points: chrono.map((w) => ({ x: isoFromDateKey(w.dateKey), y: w.registered })) }]} />
              </Card>
              <Card>
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Registrations by channel (all webinars)</p>
                <BarList color="blue" items={sourceRanked.map(([src, v]) => ({ label: src, value: v }))} />
              </Card>
            </div>
          </Section>

          <Section id="section-funnels" title="Per-masterclass funnel" description="Registered → replay signup → sale, with the registration source split.">
            {stats.map((w) => {
              const stages = [
                { label: "Registered", value: w.registered, hint: w.topSource },
                { label: "Replay signup", value: w.replaySignups, hint: w.replayLive || w.replayOnDemand ? `${num(w.replayLive)} live · ${num(w.replayOnDemand)} on-demand` : undefined },
                { label: "Sale claimed", value: w.saleClaimed, hint: "bought" },
              ].filter((s) => s.value > 0 || s.label !== "Sale claimed");
              const sources = Object.entries(w.registeredBySource).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
              return (
                <div key={w.webinar} className="mb-6">
                  <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{w.webinar} <span className="font-normal text-gray-400">· {num(w.registered)} registered · {pct(w.regToSale)} bought</span></p>
                  <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
                    <Card><Funnel color="amber" stages={stages} formatValue={(n) => num(n)} /></Card>
                    <Card>
                      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Registration source</p>
                      {sources.length ? <BarList color="blue" items={sources.map(([src, v]) => ({ label: src, value: v }))} /> : <p className="text-sm text-gray-400">No source split tagged.</p>}
                    </Card>
                  </div>
                </div>
              );
            })}
          </Section>
        </div>
      )}
    </main>
  );
}
