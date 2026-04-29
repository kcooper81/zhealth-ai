import KPIGrid from "@/components/portal/KPIGrid";
import Tabs, { TabPanel } from "@/components/portal/Tabs";
import Section, { Card } from "@/components/portal/Section";
import BarList from "@/components/portal/BarList";
import DateRangePicker from "@/components/portal/DateRangePicker";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import { parseTimeRange, pctChange } from "@/lib/time-range";
import { getServerSession } from "@/lib/auth";
import { cachedFetch, TTL } from "@/lib/cache";
import {
  getTrafficOverviewWithComparison,
  getTopPages,
  getTrafficSources,
  getTrafficByDay,
  getHighBouncePages,
} from "@/lib/google-analytics";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.WP_SITE_URL || "https://zhealtheducation.com";
const WP_USER = process.env.WP_USERNAME || "";
const WP_PASS = process.env.WP_APP_PASSWORD || "";

function basicAuth(): string {
  if (!WP_USER || !WP_PASS) return "";
  return "Basic " + Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");
}

async function fetchWPContent() {
  const auth = basicAuth();
  if (!auth) return { ok: false as const, error: "WP credentials missing" };

  try {
    const headers = { Authorization: auth };
    const [postsTotal, pagesTotal, mediaTotal, usersTotal, plugins] = await Promise.all([
      fetch(`${SITE_URL}/wp-json/wp/v2/posts?per_page=1`, { headers, next: { revalidate: 0 } }).then(
        (r) => parseInt(r.headers.get("x-wp-total") || "0", 10)
      ),
      fetch(`${SITE_URL}/wp-json/wp/v2/pages?per_page=1`, { headers, next: { revalidate: 0 } }).then(
        (r) => parseInt(r.headers.get("x-wp-total") || "0", 10)
      ),
      fetch(`${SITE_URL}/wp-json/wp/v2/media?per_page=1`, { headers, next: { revalidate: 0 } }).then(
        (r) => parseInt(r.headers.get("x-wp-total") || "0", 10)
      ),
      fetch(`${SITE_URL}/wp-json/wp/v2/users?per_page=1&context=edit`, {
        headers,
        next: { revalidate: 0 },
      }).then((r) => parseInt(r.headers.get("x-wp-total") || "0", 10)),
      fetch(`${SITE_URL}/wp-json/wp/v2/plugins`, { headers, next: { revalidate: 0 } }).then((r) =>
        r.ok ? r.json() : []
      ),
    ]);
    return {
      ok: true as const,
      counts: {
        posts: postsTotal,
        pages: pagesTotal,
        media: mediaTotal,
        users: usersTotal,
      },
      plugins: Array.isArray(plugins) ? plugins : [],
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "WP fetch failed",
    };
  }
}

async function loadWPContent() {
  return cachedFetch("wp:content-overview", TTL.WP_COUNTS, fetchWPContent);
}

async function loadGA4(rangeKey: string) {
  const session = (await getServerSession()) as any;
  const accessToken = session?.accessToken;
  const sessionError = session?.error;

  if (sessionError === "RefreshAccessTokenError") {
    return {
      ok: false as const,
      reason: "expired" as const,
      error:
        "Your Google session expired and could not be auto-refreshed. Sign out and back in to reconnect Analytics.",
    };
  }
  if (!accessToken) {
    return {
      ok: false as const,
      reason: "no-token" as const,
      error:
        "Not authenticated with Google. Sign out and back in to grant analytics.readonly access.",
    };
  }
  try {
    const [overview, topPages, sources, daily, highBounce] = await Promise.all([
      cachedFetch(
        `ga4:overview-with-comparison:website:${rangeKey}`,
        TTL.GA4_OVERVIEW,
        () => getTrafficOverviewWithComparison(accessToken, "website", rangeKey)
      ),
      cachedFetch(`ga4:top-pages:website:${rangeKey}:15`, TTL.GA4_REPORTS, () =>
        getTopPages(accessToken, "website", rangeKey, 15).catch(() => [])
      ),
      cachedFetch(`ga4:sources:website:${rangeKey}:12`, TTL.GA4_REPORTS, () =>
        getTrafficSources(accessToken, "website", rangeKey, 12).catch(() => [])
      ),
      cachedFetch(`ga4:daily:website:${rangeKey}`, TTL.GA4_REPORTS, () =>
        getTrafficByDay(accessToken, "website", rangeKey).catch(() => [])
      ),
      cachedFetch(
        `ga4:high-bounce:website:${rangeKey}:50`,
        TTL.GA4_REPORTS,
        () => getHighBouncePages(accessToken, "website", rangeKey, 50).catch(() => [])
      ),
    ]);
    return { ok: true as const, overview, topPages, sources, daily, highBounce };
  } catch (e) {
    return {
      ok: false as const,
      reason: "ga-error" as const,
      error: e instanceof Error ? e.message : "GA4 fetch failed",
    };
  }
}

function fmtSeconds(s: number): string {
  if (!s) return "0s";
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export const metadata = {
  title: "WordPress site — Z-Health Portal",
};

export default async function WPPortalPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;

  const [wp, ga] = await Promise.all([loadWPContent(), loadGA4(rangeKey)]);

  const updatedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const usersTrend = ga.ok
    ? pctChange(ga.overview.current.totalUsers, ga.overview.previous.totalUsers)
    : { value: 0, positive: true };
  const sessionsTrend = ga.ok
    ? pctChange(ga.overview.current.totalSessions, ga.overview.previous.totalSessions)
    : { value: 0, positive: true };
  const pageviewsTrend = ga.ok
    ? pctChange(ga.overview.current.totalPageviews, ga.overview.previous.totalPageviews)
    : { value: 0, positive: true };

  // Plugin health stats
  const pluginsActive = wp.ok ? wp.plugins.filter((p: any) => p.status === "active").length : 0;
  const pluginsInactive = wp.ok ? wp.plugins.filter((p: any) => p.status !== "active").length : 0;
  const wcStillActive = wp.ok
    ? wp.plugins.some((p: any) => p.plugin?.includes("woocommerce/") && p.status === "active")
    : false;

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            WordPress site
          </h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <span className="text-xs text-gray-400 dark:text-gray-500">{updatedAt} PT</span>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          zhealtheducation.com — content + lead generation. {range.label.toLowerCase()}.
        </p>
      </header>

      <div className="mb-10">
        <KPIGrid
          accent="purple"
          kpis={
            ga.ok
              ? [
                  {
                    label: "Users",
                    value: ga.overview.current.totalUsers,
                    trend: { value: usersTrend.value, positive: usersTrend.positive },
                    hint: `vs prior ${range.days}d`,
                  },
                  {
                    label: "Sessions",
                    value: ga.overview.current.totalSessions,
                    trend: { value: sessionsTrend.value, positive: sessionsTrend.positive },
                  },
                  {
                    label: "Pageviews",
                    value: ga.overview.current.totalPageviews,
                    trend: { value: pageviewsTrend.value, positive: pageviewsTrend.positive },
                  },
                  {
                    label: "Avg session",
                    value: fmtSeconds(ga.overview.current.avgSessionDuration),
                    hint: `Bounce ${fmtPct(ga.overview.current.bounceRate, 1)}`,
                  },
                ]
              : [
                  { label: "Users", value: "—", hint: "GA4 unavailable" },
                  { label: "Sessions", value: "—" },
                  { label: "Pageviews", value: "—" },
                  { label: "Avg session", value: "—" },
                ]
          }
        />
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "traffic", label: "Traffic" },
          { id: "content", label: "Content" },
          { id: "plugins", label: "Plugins", badge: wp.ok ? wp.plugins.length : 0 },
        ]}
      >
        <TabPanel id="overview">
          <Section title="Findings">
            <InsightGrid>
              {ga.ok ? (
                <>
                  <Insight
                    severity={usersTrend.positive ? "good" : "warn"}
                    title={`${usersTrend.positive ? "Traffic growing" : "Traffic declining"}: ${ga.overview.current.totalUsers.toLocaleString()} users`}
                  >
                    {usersTrend.positive ? "+" : "−"}{usersTrend.value}% vs prior {range.days} days. Prior had {ga.overview.previous.totalUsers.toLocaleString()} users.
                  </Insight>
                  <Insight
                    severity={ga.overview.current.bounceRate > 0.65 ? "warn" : "good"}
                    title={`Bounce rate: ${fmtPct(ga.overview.current.bounceRate, 1)}`}
                  >
                    {ga.overview.current.bounceRate > 0.65
                      ? "Higher than typical content-site benchmarks (~50–60%). Consider checking landing pages."
                      : "Within healthy range for content sites."}
                  </Insight>
                  <Insight severity="info" title={`Avg session: ${fmtSeconds(ga.overview.current.avgSessionDuration)}`}>
                    Pageviews per session: {(ga.overview.current.totalPageviews / Math.max(1, ga.overview.current.totalSessions)).toFixed(1)}.
                  </Insight>
                </>
              ) : (
                <Insight severity="alert" title="GA4 data unavailable">
                  {ga.error}
                </Insight>
              )}
              {wp.ok && wcStillActive && (
                <Insight severity="warn" title="WooCommerce still active in WordPress">
                  All ecommerce moved to Thinkific, but the Woo plugin stack is still loaded — costing performance and adding security surface. Candidate for removal.
                </Insight>
              )}
              {wp.ok && (
                <Insight severity="info" title={`${pluginsActive} active plugins`}>
                  {pluginsInactive} inactive. {pluginsActive > 40 ? "Active count is high — consider auditing for unused tools." : "Plugin count looks reasonable."}
                </Insight>
              )}
            </InsightGrid>
          </Section>

          <Section title="Content totals">
            {wp.ok ? (
              <KPIGrid
                kpis={[
                  { label: "Posts", value: wp.counts.posts },
                  { label: "Pages", value: wp.counts.pages },
                  { label: "Media items", value: wp.counts.media },
                  { label: "Users", value: wp.counts.users },
                ]}
              />
            ) : (
              <Card>
                <p className="text-sm text-rose-700 dark:text-rose-400">{wp.error}</p>
              </Card>
            )}
          </Section>
        </TabPanel>

        <TabPanel id="traffic">
          {!ga.ok ? (
            <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20">
              <div className="text-sm font-semibold text-rose-900 dark:text-rose-200">
                GA4 data unavailable
              </div>
              <p className="mt-2 text-xs text-rose-800 dark:text-rose-300">{ga.error}</p>
              {(ga.reason === "no-token" || ga.reason === "expired") && (
                <p className="mt-3 text-xs text-rose-700 dark:text-rose-400">
                  Sign out and sign back in.{" "}
                  {ga.reason === "expired"
                    ? "Your refresh token expired or was revoked."
                    : "The Google OAuth flow asks for analytics.readonly scope; some old sessions don't have it."}
                </p>
              )}
            </Card>
          ) : (
            <>
              <Section title="Daily traffic" description={`Users + sessions over ${range.label.toLowerCase()}.`}>
                <Card>
                  <BarList
                    color="blue"
                    items={ga.daily.slice(-30).map((d: any) => ({
                      label: d.date,
                      value: d.users,
                      sublabel: `${d.sessions} sessions, ${d.pageviews} pv`,
                    }))}
                    formatValue={(n) => `${n.toLocaleString()} users`}
                  />
                </Card>
              </Section>

              <Section title="Top pages" description={`The 15 most-viewed pages in period.`}>
                <Card>
                  <BarList
                    color="purple"
                    items={ga.topPages.map((p: any) => ({
                      label: p.page,
                      value: p.pageviews,
                      sublabel: `${p.users} users · ${fmtPct(p.bounceRate, 0)} bounce`,
                    }))}
                    formatValue={(n) => `${n.toLocaleString()} pv`}
                  />
                </Card>
              </Section>

              <Section title="Traffic sources" description="Acquisition channel + medium.">
                <Card>
                  <BarList
                    color="green"
                    items={ga.sources.map((s: any) => ({
                      label: `${s.source} / ${s.medium}`,
                      value: s.sessions,
                      sublabel: `${s.users} users`,
                    }))}
                    formatValue={(n) => `${n.toLocaleString()} sessions`}
                  />
                </Card>
              </Section>

              {ga.highBounce.length > 0 && (
                <Section
                  title="High-bounce pages"
                  description="Pages with high bounce rate and 50+ pageviews — UX/content review candidates."
                >
                  <Card>
                    <BarList
                      color="rose"
                      items={ga.highBounce.map((p: any) => ({
                        label: p.page,
                        value: Math.round(p.bounceRate * 100),
                        sublabel: `${p.pageviews} pageviews`,
                      }))}
                      formatValue={(n) => `${n}% bounce`}
                    />
                  </Card>
                </Section>
              )}
            </>
          )}
        </TabPanel>

        <TabPanel id="content">
          {wp.ok ? (
            <>
              <Section title="Content totals">
                <KPIGrid
                  kpis={[
                    { label: "Posts", value: wp.counts.posts },
                    { label: "Pages", value: wp.counts.pages },
                    { label: "Media items", value: wp.counts.media },
                    { label: "Users", value: wp.counts.users },
                  ]}
                />
              </Section>
              {ga.ok && ga.topPages.length > 0 && (
                <Section
                  title="Most-trafficked content"
                  description="From GA4 — same as on the Traffic tab, included here for context."
                >
                  <Card>
                    <BarList
                      color="blue"
                      items={ga.topPages.slice(0, 10).map((p: any) => ({
                        label: p.page,
                        value: p.pageviews,
                        sublabel: `${p.users} users`,
                      }))}
                      formatValue={(n) => `${n.toLocaleString()} pv`}
                    />
                  </Card>
                </Section>
              )}
            </>
          ) : (
            <Card>
              <p className="text-sm text-rose-700 dark:text-rose-400">{wp.error}</p>
            </Card>
          )}
        </TabPanel>

        <TabPanel id="plugins">
          {wp.ok ? (
            <>
              <Section
                title={`Active plugins`}
                description={`${pluginsActive} active, ${pluginsInactive} inactive of ${wp.plugins.length} total.`}
              >
                <Card padded={false}>
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200/70 dark:border-white/5">
                      <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        <th className="px-5 py-3">Plugin</th>
                        <th className="px-5 py-3">Version</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {wp.plugins
                        .sort((a: any, b: any) =>
                          a.status === b.status ? (a.name || "").localeCompare(b.name || "") : a.status === "active" ? -1 : 1
                        )
                        .map((p: any) => (
                          <tr key={p.plugin} className="text-gray-700 dark:text-gray-300">
                            <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                              {p.name || p.plugin}
                            </td>
                            <td className="px-5 py-3 text-xs tabular-nums">v{p.version}</td>
                            <td className="px-5 py-3 text-xs">
                              <span
                                className={
                                  p.status === "active"
                                    ? "rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    : "rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-white/5 dark:text-gray-300"
                                }
                              >
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </Card>
              </Section>
            </>
          ) : (
            <Card>
              <p className="text-sm text-rose-700 dark:text-rose-400">{wp.error}</p>
            </Card>
          )}
        </TabPanel>
      </Tabs>
    </main>
  );
}
