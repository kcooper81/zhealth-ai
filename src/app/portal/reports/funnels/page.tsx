/**
 * Funnels report — built-in preset funnels + saved custom funnel reports.
 *
 * The "Build a new funnel" modal in FunnelManager creates/edits saved
 * funnels that persist via Supabase api_cache (see src/lib/saved-funnels.ts).
 * Each saved funnel renders as a Section card just like the presets.
 */
import Section, { Card } from "@/components/portal/Section";
import DateRangePicker from "@/components/portal/DateRangePicker";
import ExportButton from "@/components/portal/ExportButton";
import FunnelManager from "@/components/portal/FunnelManager";
import { type PageGroup } from "@/components/portal/FunnelBuilder";
import { parseTimeRange } from "@/lib/time-range";
import { getServerSession } from "@/lib/auth";
import { cachedFetch, TTL } from "@/lib/cache";
import { getFunnelSteps, getPagesWithEntrances } from "@/lib/google-analytics";
import {
  FUNNEL_EVENT_CATALOG,
  type FunnelDefinition,
} from "@/lib/funnel-config";
import { LANDING_PAGE_TAG_MAP } from "@/lib/landing-page-tag-map";
import { getAllWPPages, getAllWPPosts } from "@/lib/wp-content-list";
import { listCourses } from "@/lib/thinkific";
import { listSavedFunnels, seedBuiltInFunnels } from "@/lib/saved-funnels";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

async function loadFunnels(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;

  const session = (await getServerSession()) as any;
  const accessToken = session?.accessToken;

  // 0. Auto-seed any built-in preset funnels that aren't yet in the
  //    saved store. Adds new defaults on first load + any newly-shipped
  //    defaults later, without overwriting user customs or restoring
  //    defaults the user has explicitly deleted.
  await seedBuiltInFunnels("if-missing").catch(() => null);

  // 1. Load saved customs + page lists in parallel
  const [saved, wpPages, wpPosts, lmsCourses, gaWebPages, gaLmsPages] = await Promise.all([
    listSavedFunnels().catch(() => []),
    getAllWPPages().catch(() => []),
    getAllWPPosts().catch(() => []),
    cachedFetch("thinkific:courses:250", TTL.THINKIFIC_COURSES, () =>
      listCourses({ limit: 250 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } }))
    ),
    accessToken
      ? cachedFetch(`ga4:pages:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getPagesWithEntrances(accessToken, "website", rangeKey, 100).catch(() => [])
        ).then((pages) =>
          (pages as any[]).map((p) => ({ path: p.page, pageviews: p.pageviews }))
        )
      : Promise.resolve([] as Array<{ path: string; pageviews: number }>),
    accessToken
      ? cachedFetch(`ga4:pages:lms:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getPagesWithEntrances(accessToken, "lms", rangeKey, 100).catch(() => [])
        ).then((pages) =>
          (pages as any[]).map((p) => ({ path: p.page, pageviews: p.pageviews }))
        )
      : Promise.resolve([] as Array<{ path: string; pageviews: number }>),
  ]);

  // 2. Saved is the only source — built-ins are seeded into it on first load
  const allFunnels: FunnelDefinition[] = saved;

  // 3. Fetch GA4 funnel data for each
  const funnelResults = await Promise.all(
    allFunnels.map(async (f) => {
      if (!accessToken) {
        return {
          funnel: f,
          steps: f.steps.map((s) => ({ name: s.name, eventName: s.eventName, users: 0, events: 0 })),
        };
      }
      try {
        const cacheKey = `ga4:funnel:${f.id}:${rangeKey}`;
        const steps = await cachedFetch(cacheKey, TTL.GA4_REPORTS, () =>
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

  // 4. Build grouped, dedup'd page list for the picker
  const pageGroups: Record<PageGroup, Array<{ path: string; label: string; sublabel?: string }>> = {
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

  for (const lp of LANDING_PAGE_TAG_MAP) {
    dedupAdd("Mapped landing pages", lp.path, lp.label, `tag ${lp.tagId}`);
  }
  for (const p of wpPages) {
    dedupAdd("WordPress pages", p.path, p.title || p.path, p.path);
  }
  for (const p of wpPosts) {
    dedupAdd("WordPress posts", p.path, p.title || p.path, p.path);
  }
  for (const c of (lmsCourses as any).items || []) {
    if (c.slug) {
      dedupAdd("Thinkific courses", `/courses/${c.slug}`, c.name || c.slug, `slug ${c.slug}`);
    }
  }
  for (const p of [...gaWebPages, ...gaLmsPages]) {
    dedupAdd("Recent GA4 traffic", p.path, p.path, `${p.pageviews.toLocaleString()} views`);
  }

  return {
    range,
    accessToken: !!accessToken,
    funnels: funnelResults,
    saved,
    pageGroups,
  };
}

export const metadata = { title: "Funnels — Z-Health Portal" };

export default async function FunnelsReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await loadFunnels(searchParams);

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

      {!data.accessToken && (
        <Card className="mb-8 border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>GA4 not connected.</strong> Sign in via <a href="/portal/analytics" className="underline">Analytics</a> first.
          </p>
        </Card>
      )}

      <div className="mb-10">
        <FunnelManager
          savedFunnels={data.saved.map((f) => ({
            id: f.id,
            label: f.label,
            description: f.description,
            property: f.property,
            entryPath: f.entryPath,
            steps: f.steps,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
          }))}
          pageGroups={data.pageGroups}
          eventCatalog={FUNNEL_EVENT_CATALOG}
        />
      </div>

      <div id="report-content" className="bg-white dark:bg-[#1c1c1e] space-y-12">
        {data.funnels.map(({ funnel, steps }) => {
          const top = steps[0]?.users ?? 0;
          const last = steps[steps.length - 1]?.users ?? 0;
          const overallCvr = top > 0 ? (last / top) * 100 : 0;
          return (
            <Section
              key={funnel.id}
              id={`section-funnel-${funnel.id}`}
              title={funnel.label}
              description={funnel.description}
              action={<ExportButton targetId={`section-funnel-${funnel.id}`} filename={`funnel-${funnel.id}`} />}
            >
              <Card>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <span>{funnel.property === "lms" ? "LMS" : "Website"}</span>
                  </div>
                  <div className="text-sm">
                    Overall conversion:{" "}
                    <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {overallCvr.toFixed(2)}%
                    </span>
                    <span className="ml-2 text-xs text-gray-500">{top.toLocaleString()} → {last.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {steps.map((s, i) => {
                    const cvrFromTop = top > 0 ? (s.users / top) * 100 : 0;
                    const cvrFromPrev = i > 0 && steps[i - 1].users > 0 ? (s.users / steps[i - 1].users) * 100 : null;
                    const widthPct = top > 0 ? Math.max(2, Math.min(100, (s.users / top) * 100)) : 0;
                    return (
                      <div key={`${s.eventName}-${i}`} className="grid grid-cols-12 items-center gap-3">
                        <div className="col-span-3 text-sm text-gray-700 dark:text-gray-300">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{s.name}</div>
                          <div className="text-[10px] font-mono text-gray-400">{s.eventName}</div>
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
                    );
                  })}
                </div>
              </Card>
            </Section>
          );
        })}
      </div>
    </main>
  );
}
