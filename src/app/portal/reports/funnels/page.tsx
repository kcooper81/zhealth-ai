/**
 * Funnels report — built-in preset funnels + saved custom funnel reports.
 *
 * Fast shell renders immediately:
 *   - Header + DateRangePicker + ExportButton
 *   - FunnelManager (just needs the saved-funnels list — single Supabase read)
 *
 * Slow body streams in via <Suspense>:
 *   - One GA4 query per funnel × per step (the heavy part). The skeleton
 *     fills the slot while the data loads.
 */
import { Suspense } from "react";
import Section, { Card } from "@/components/portal/Section";
import DateRangePicker from "@/components/portal/DateRangePicker";
import ExportButton from "@/components/portal/ExportButton";
import FunnelManager from "@/components/portal/FunnelManager";
import { type PageGroup } from "@/components/portal/FunnelBuilder";
import { FunnelCardSkeleton } from "@/components/portal/Skeletons";
import { parseTimeRange } from "@/lib/time-range";
import { getServerSession } from "@/lib/auth";
import { cachedFetch, TTL } from "@/lib/cache";
import { getFunnelSteps, getPagesWithEntrances } from "@/lib/google-analytics";
import { FUNNEL_EVENT_CATALOG } from "@/lib/funnel-config";
import { LANDING_PAGE_TAG_MAP } from "@/lib/landing-page-tag-map";
import { getAllWPPages, getAllWPPosts } from "@/lib/wp-content-list";
import { listCourses } from "@/lib/thinkific";
import {
  listSavedFunnels,
  seedBuiltInFunnels,
  migrateGenericStepNames,
  type SavedFunnel,
} from "@/lib/saved-funnels";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

type GroupedPage = { path: string; label: string; sublabel?: string };

/**
 * Fast data — everything the SHELL needs to render. All cached or single-
 * row Supabase reads. Targets <500ms total.
 */
async function loadShellData(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;

  const session = (await getServerSession()) as any;
  const accessToken = session?.accessToken;

  // Seed/migrate run idempotently — both no-op fast on the common path.
  await seedBuiltInFunnels("if-missing").catch(() => null);
  await migrateGenericStepNames().catch(() => null);

  const [saved, wpPages, wpPosts, lmsCourses, gaWebPages, gaLmsPages] = await Promise.all([
    listSavedFunnels().catch(() => [] as SavedFunnel[]),
    getAllWPPages().catch(() => []),
    getAllWPPosts().catch(() => []),
    cachedFetch("thinkific:courses:250", TTL.THINKIFIC_COURSES, () =>
      listCourses({ limit: 250 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } }))
    ),
    accessToken
      ? cachedFetch(`ga4:pages:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getPagesWithEntrances(accessToken, "website", rangeKey, 100).catch(() => [])
        ).then((pages) => (pages as any[]).map((p) => ({ path: p.page, pageviews: p.pageviews })))
      : Promise.resolve([] as Array<{ path: string; pageviews: number }>),
    accessToken
      ? cachedFetch(`ga4:pages:lms:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getPagesWithEntrances(accessToken, "lms", rangeKey, 100).catch(() => [])
        ).then((pages) => (pages as any[]).map((p) => ({ path: p.page, pageviews: p.pageviews })))
      : Promise.resolve([] as Array<{ path: string; pageviews: number }>),
  ]);

  const pageGroups: Record<PageGroup, GroupedPage[]> = {
    "Mapped landing pages": [],
    "WordPress pages": [],
    "WordPress posts": [],
    "Thinkific courses": [],
    "Recent GA4 traffic": [],
  };
  const seen = new Set<string>();
  const dedupAdd = (group: PageGroup, path: string, label: string, sublabel?: string) => {
    const k = `${group}::${path}`;
    if (seen.has(k)) return;
    seen.add(k);
    pageGroups[group].push({ path, label, sublabel });
  };
  for (const lp of LANDING_PAGE_TAG_MAP) dedupAdd("Mapped landing pages", lp.path, lp.label, `tag ${lp.tagId}`);
  for (const p of wpPages) dedupAdd("WordPress pages", p.path, p.title || p.path, p.path);
  for (const p of wpPosts) dedupAdd("WordPress posts", p.path, p.title || p.path, p.path);
  for (const c of (lmsCourses as any).items || []) {
    if (c.slug) dedupAdd("Thinkific courses", `/courses/${c.slug}`, c.name || c.slug, `slug ${c.slug}`);
  }
  for (const p of [...gaWebPages, ...gaLmsPages]) {
    dedupAdd("Recent GA4 traffic", p.path, p.path, `${p.pageviews.toLocaleString()} views`);
  }

  return { range, accessToken: !!accessToken, saved, pageGroups };
}

/**
 * Slow data — GA4 funnel queries. Each saved funnel runs N step queries
 * in parallel (getFunnelSteps), and all funnels run in parallel via
 * Promise.all. This is the part that streams in via Suspense.
 */
async function FunnelsListSection({
  searchParams,
  saved,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  saved: SavedFunnel[];
}) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;

  const session = (await getServerSession()) as any;
  const accessToken = session?.accessToken;

  const funnelResults = await Promise.all(
    saved.map(async (f) => {
      if (!accessToken) {
        return {
          funnel: f,
          steps: f.steps.map((s) => ({ name: s.name, eventName: s.eventName, users: 0, events: 0 })),
        };
      }
      try {
        const steps = await cachedFetch(`ga4:funnel:${f.id}:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getFunnelSteps(accessToken, f.property, rangeKey, f.steps)
        );
        return { funnel: f, steps };
      } catch {
        return {
          funnel: f,
          steps: f.steps.map((s) => ({ name: s.name, eventName: s.eventName, users: 0, events: 0 })),
        };
      }
    })
  );

  return (
    <div id="report-content" className="bg-white dark:bg-[#1c1c1e] space-y-12">
      {funnelResults.map(({ funnel, steps }) => {
        const top = steps[0]?.users ?? 0;
        const last = steps[steps.length - 1]?.users ?? 0;
        const overallCvr = top > 0 ? (last / top) * 100 : 0;
        const totalDropoff = top - last;

        let biggestDropIdx = -1;
        let biggestDropAmount = 0;
        for (let i = 1; i < steps.length; i++) {
          const drop = steps[i - 1].users - steps[i].users;
          if (drop > biggestDropAmount) {
            biggestDropAmount = drop;
            biggestDropIdx = i;
          }
        }

        const matchingSaved = saved.find((s) => s.id === funnel.id);
        const entryPath = matchingSaved?.entryPath || funnel.steps.find((s) => s.pageMatch)?.pageMatch || null;
        const isCustom = !funnel.id.startsWith("seed-");

        const insights: Array<{ tone: "good" | "warn" | "alert" | "info"; title: string; body: string }> = [];
        if (top === 0) {
          insights.push({
            tone: "warn",
            title: "No traffic at the entry step",
            body: entryPath
              ? `The first step found 0 users in ${range.label.toLowerCase()}. Either the page didn't get visits, or the page filter doesn't match GA4's reported pagePath. Check ${entryPath} for typos or trailing slashes.`
              : `The first step found 0 users in ${range.label.toLowerCase()}.`,
          });
        } else if (top < 50) {
          insights.push({
            tone: "info",
            title: "Low entry traffic",
            body: `${top.toLocaleString()} entrants is too small to draw conclusions. Pick a longer date range or wait for more data before optimizing.`,
          });
        }
        if (biggestDropIdx > 0 && top > 0 && biggestDropAmount > 0) {
          const fromStep = steps[biggestDropIdx - 1];
          const toStep = steps[biggestDropIdx];
          const dropPct = (biggestDropAmount / Math.max(1, fromStep.users)) * 100;
          insights.push({
            tone: dropPct >= 80 ? "alert" : dropPct >= 50 ? "warn" : "info",
            title: `Biggest drop: "${fromStep.name}" → "${toStep.name}"`,
            body: `${biggestDropAmount.toLocaleString()} users (${dropPct.toFixed(1)}% of the previous step) didn't make it to the next step. This is where to focus optimization effort.`,
          });
        }
        if (overallCvr > 0 && overallCvr < 0.5 && top >= 100) {
          insights.push({
            tone: "alert",
            title: `End-to-end conversion is ${overallCvr.toFixed(2)}%`,
            body: "Below 0.5% is unusual even for cold traffic. Likely either a tracking gap (events not firing on later steps) or a real conversion problem.",
          });
        } else if (overallCvr >= 5 && top >= 100) {
          insights.push({
            tone: "good",
            title: `Strong ${overallCvr.toFixed(2)}% end-to-end conversion`,
            body: `${last.toLocaleString()} of ${top.toLocaleString()} entrants made it through the full funnel. Above typical course-funnel conversion (1-3%).`,
          });
        }

        return (
          <Section
            key={funnel.id}
            id={`section-funnel-${funnel.id}`}
            title={funnel.label}
            description={funnel.description}
            action={<ExportButton targetId={`section-funnel-${funnel.id}`} filename={`funnel-${funnel.id}`} />}
          >
            <Card>
              <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200/70 pb-4 dark:border-white/5">
                <div className="flex items-center gap-2 text-xs">
                  {isCustom ? (
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                      Custom
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-700 dark:bg-white/5 dark:text-gray-400">
                      Default
                    </span>
                  )}
                  <span className="text-gray-500">·</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {funnel.property === "lms" ? "LMS / Thinkific" : "Website"}
                  </span>
                </div>
                {entryPath && (
                  <div className="text-xs">
                    <span className="text-gray-500">Entry:</span>{" "}
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-900 dark:bg-white/10 dark:text-gray-100">{entryPath}</code>
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  {steps.length} step{steps.length === 1 ? "" : "s"}
                </div>
                <div className="text-xs text-gray-500">{range.label}</div>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Entrants</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">{top.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Conversions</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">{last.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">End-to-end CVR</div>
                  <div className={`mt-1 text-2xl font-semibold tabular-nums ${overallCvr >= 5 ? "text-emerald-700 dark:text-emerald-400" : overallCvr >= 1 ? "text-gray-900 dark:text-gray-50" : "text-rose-700 dark:text-rose-400"}`}>
                    {top > 0 ? overallCvr.toFixed(2) + "%" : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total drop-off</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                    {totalDropoff > 0 ? totalDropoff.toLocaleString() : "—"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {steps.map((s, i) => {
                  const cvrFromTop = top > 0 ? (s.users / top) * 100 : 0;
                  const prevUsers = i > 0 ? steps[i - 1].users : null;
                  const cvrFromPrev = prevUsers != null && prevUsers > 0 ? (s.users / prevUsers) * 100 : null;
                  const dropFromPrev = prevUsers != null ? prevUsers - s.users : 0;
                  const widthPct = top > 0 ? Math.max(2, Math.min(100, (s.users / top) * 100)) : 0;
                  const isBiggestDrop = i === biggestDropIdx && dropFromPrev > 0;
                  return (
                    <div key={`${s.eventName}-${i}`}>
                      {prevUsers != null && dropFromPrev > 0 && (
                        <div className={`mb-1 ml-[25%] flex items-center gap-1.5 text-[10px] ${isBiggestDrop ? "text-rose-600 dark:text-rose-400 font-medium" : "text-gray-500 dark:text-gray-500"}`}>
                          <span>↓</span>
                          <span>{dropFromPrev.toLocaleString()} dropped</span>
                          <span className="opacity-60">({((dropFromPrev / prevUsers) * 100).toFixed(1)}% of previous)</span>
                          {isBiggestDrop && <span className="ml-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">biggest drop</span>}
                        </div>
                      )}
                      <div className="grid grid-cols-12 items-center gap-3">
                        <div className="col-span-3 text-sm text-gray-700 dark:text-gray-300">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{s.name}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-500">
                            <code className="font-mono">{s.eventName}</code>
                            {(s as any).pageMatch && (
                              <>
                                <span>·</span>
                                <span>scoped to <code className="font-mono">{(s as any).pageMatch}</code></span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="col-span-6">
                          <div className="h-7 w-full overflow-hidden rounded-md bg-gray-100 dark:bg-white/5">
                            <div
                              className="h-full rounded-md bg-gradient-to-r from-blue-500/80 to-blue-600/80 dark:from-blue-400/70 dark:to-blue-500/70"
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        </div>
                        <div className="col-span-3 text-right text-xs">
                          <div className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                            {s.users.toLocaleString()} users
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {cvrFromTop.toFixed(1)}% of top
                            {cvrFromPrev != null && (
                              <span className="ml-2">· {cvrFromPrev.toFixed(1)}% of previous</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {insights.length > 0 && (
                <div className="mt-6 grid gap-3 border-t border-gray-200/70 pt-5 dark:border-white/5 md:grid-cols-2">
                  {insights.map((ins, idx) => {
                    const toneCls = {
                      good: "border-emerald-200 bg-emerald-50/50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200",
                      warn: "border-amber-200 bg-amber-50/50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200",
                      alert: "border-rose-200 bg-rose-50/50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200",
                      info: "border-blue-200 bg-blue-50/50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200",
                    }[ins.tone];
                    return (
                      <div key={idx} className={`rounded-lg border p-3 text-xs ${toneCls}`}>
                        <div className="font-semibold">{ins.title}</div>
                        <div className="mt-1 opacity-90">{ins.body}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </Section>
        );
      })}
    </div>
  );
}

export const metadata = { title: "Funnels — Z-Health Portal" };

export default async function FunnelsReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const shell = await loadShellData(searchParams);

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Funnels</h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <ExportButton targetId="report-content" filename="funnels-report" label="Export all" />
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
          Built-in cross-channel funnels plus your saved custom funnel reports. Click <strong>Build a new funnel</strong> to add one for any WP page, post, or Thinkific course.
        </p>
      </header>

      {!shell.accessToken && (
        <Card className="mb-8 border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>GA4 not connected.</strong> Sign in via <a href="/portal/analytics" className="underline">Analytics</a> first.
          </p>
        </Card>
      )}

      <div className="mb-10">
        <FunnelManager
          savedFunnels={shell.saved.map((f) => ({
            id: f.id,
            label: f.label,
            description: f.description,
            property: f.property,
            entryPath: f.entryPath,
            steps: f.steps,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
          }))}
          pageGroups={shell.pageGroups}
          eventCatalog={FUNNEL_EVENT_CATALOG}
        />
      </div>

      {/* Heavy GA4 funnel queries stream in here while the manager above is interactive */}
      <Suspense fallback={
        <div className="space-y-12">
          {shell.saved.slice(0, Math.max(2, shell.saved.length)).map((_, i) => (
            <FunnelCardSkeleton key={i} />
          ))}
        </div>
      }>
        <FunnelsListSection searchParams={searchParams} saved={shell.saved} />
      </Suspense>
    </main>
  );
}
