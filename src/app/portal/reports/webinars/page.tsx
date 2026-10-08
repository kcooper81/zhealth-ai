/**
 * Webinars — masterclass funnel from Keap tags (WebinarJam registrations sync
 * into Keap). Per masterclass: Registered → Replay signup → Sale, plus the
 * registration source split. Loads from a cached snapshot (SWR).
 */
import Section, { Card } from "@/components/portal/Section";
import ExportButton from "@/components/portal/ExportButton";
import KPIGrid from "@/components/portal/KPIGrid";
import Funnel from "@/components/portal/Funnel";
import BarList from "@/components/portal/BarList";
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

async function load() {
  const session = await getServerSession();
  if (!session) return { ok: false as const, updatedAt: 0, stale: false, stats: [] as WebinarStat[] };
  const { data, updatedAt, stale } = await cachedFetchSWR<WebinarStat[]>(
    WEBINAR_CACHE_KEY,
    WEBINAR_FRESH_SECONDS,
    WEBINAR_HARD_SECONDS,
    () => getWebinarStats()
  );
  return { ok: true as const, updatedAt, stale, stats: data || [] };
}

export default async function WebinarsReportPage() {
  const d = await load();
  const stats = d.stats;

  const totalReg = stats.reduce((s, w) => s + w.registered, 0);
  const totalReplay = stats.reduce((s, w) => s + w.replaySignups, 0);
  const totalSale = stats.reduce((s, w) => s + w.saleClaimed, 0);

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Webinars</h1>
          <ExportButton targetId="report-content" filename="webinars-report" label="Export all" />
        </div>
        <p className="mt-2 max-w-3xl text-gray-600 dark:text-gray-400">
          Masterclass funnels from Keap (WebinarJam registrations sync in as tags): registered → replay signup → sale, with the registration source split.
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
                { label: "Sales claimed", value: num(totalSale) },
              ]}
            />
          </div>

          {stats.map((w) => {
            const stages = [
              { label: "Registered", value: w.registered, hint: "primary registration tag" },
              { label: "Replay signup", value: w.replaySignups, hint: "signed up to watch the replay" },
              { label: "Sale claimed", value: w.saleClaimed, hint: "bought from this webinar" },
            ].filter((s) => s.value > 0 || s.label !== "Sale claimed");
            const sources = Object.entries(w.registeredBySource).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
            return (
              <Section key={w.webinar} id={`w-${w.webinar.replace(/\W+/g, "-")}`} title={w.webinar} description={`${num(w.registered)} registered · ${pct(w.regToSale)} bought${w.replaySignups ? ` · ${num(w.replaySignups)} replay signups` : ""}`}>
                <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
                  <Card>
                    <Funnel color="amber" stages={stages} formatValue={(n) => num(n)} />
                  </Card>
                  <Card>
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Registration source</p>
                    {sources.length ? (
                      <BarList color="blue" items={sources.map(([src, v]) => ({ label: src, value: v }))} />
                    ) : (
                      <p className="text-sm text-gray-400">No source split tagged.</p>
                    )}
                  </Card>
                </div>
              </Section>
            );
          })}
        </div>
      )}
    </main>
  );
}
