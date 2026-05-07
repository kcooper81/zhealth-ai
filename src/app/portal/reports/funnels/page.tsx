/**
 * Funnels report — predefined cross-channel funnels.
 *
 * Each funnel in src/lib/funnel-config.ts is rendered as a step card showing
 * users at each step + conversion vs the first step. Add new flows there.
 */
import Section, { Card } from "@/components/portal/Section";
import DateRangePicker from "@/components/portal/DateRangePicker";
import ExportButton from "@/components/portal/ExportButton";
import { parseTimeRange } from "@/lib/time-range";
import { getServerSession } from "@/lib/auth";
import { cachedFetch, TTL } from "@/lib/cache";
import { getFunnelSteps } from "@/lib/google-analytics";
import { FUNNELS } from "@/lib/funnel-config";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

async function loadFunnels(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;

  const session = (await getServerSession()) as any;
  const accessToken = session?.accessToken;

  const results = await Promise.all(
    FUNNELS.map(async (f) => {
      if (!accessToken) {
        return { funnel: f, steps: f.steps.map((s) => ({ name: s.name, eventName: s.eventName, users: 0, events: 0 })) };
      }
      try {
        const steps = await cachedFetch(
          `ga4:funnel:${f.id}:${rangeKey}`,
          TTL.GA4_REPORTS,
          () => getFunnelSteps(accessToken, f.property, rangeKey, f.steps)
        );
        return { funnel: f, steps };
      } catch {
        return { funnel: f, steps: f.steps.map((s) => ({ name: s.name, eventName: s.eventName, users: 0, events: 0 })) };
      }
    })
  );

  return { range, accessToken: !!accessToken, funnels: results };
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
          Predefined cross-channel funnels. Edit <code className="rounded bg-gray-100 px-1 dark:bg-white/10">src/lib/funnel-config.ts</code> to add new flows.
        </p>
      </header>

      {!data.accessToken && (
        <Card className="mb-8 border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>GA4 not connected.</strong> Sign in via <a href="/portal/analytics" className="underline">Analytics</a> first.
          </p>
        </Card>
      )}

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
                <div className="mb-4 flex items-baseline justify-between">
                  <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Property: <span className="font-mono text-gray-700 dark:text-gray-300">{funnel.property}</span>
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
