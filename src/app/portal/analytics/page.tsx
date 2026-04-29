import KPIGrid from "@/components/portal/KPIGrid";
import Tabs, { TabPanel } from "@/components/portal/Tabs";
import Section, { Card } from "@/components/portal/Section";
import BarList from "@/components/portal/BarList";
import Funnel from "@/components/portal/Funnel";
import DateRangePicker from "@/components/portal/DateRangePicker";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import { parseTimeRange, pctChange } from "@/lib/time-range";
import { getServerSession } from "@/lib/auth";
import {
  getTrafficOverview,
  getTopPages,
  getTrafficSources,
  getTrafficByDay,
} from "@/lib/google-analytics";
import {
  listContacts,
  listTags,
  listEmails,
  getContactsWithTag,
} from "@/lib/keap";
import {
  listCourses,
  listOrders,
  listEnrollments,
  listUsers,
} from "@/lib/thinkific";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COURSE_PATH_RE = /\/(courses?|course-list|enroll|product)\b/i;
const CHECKOUT_PATH_RE = /\/(checkout|cart|purchase|enroll|payment|order)\b/i;

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function pct(n: number, of: number): string {
  if (!of) return "—";
  return `${Math.round((n / of) * 1000) / 10}%`;
}

async function loadAnalytics(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;

  const session = (await getServerSession()) as any;
  const accessToken = session?.accessToken;
  const sessionError = session?.error;

  // Default empty GA4 result if not authenticated
  const ga4Empty = {
    overview: null as any,
    topPages: [] as any[],
    sources: [] as any[],
    daily: [] as any[],
  };

  const [keapContactsTotal, keapEmails, keapTagsAll, thinkificCourses, thinkificOrders, thinkificEnrollments, thinkificUsersP1, thinkificUsersP2, ga4] =
    await Promise.all([
      listContacts({ limit: 1 }).catch(() => ({ count: 0, contacts: [] })),
      listEmails({ limit: 30, since_sent_date: range.from.toISOString() }).catch(() => ({ emails: [] as any[], count: 0 })),
      listTags({ limit: 50 }).catch(() => ({ tags: [], count: 0 })),
      listCourses({ limit: 250 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } })),
      listOrders({ limit: 250 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } })),
      listEnrollments({ limit: 250 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } })),
      listUsers({ limit: 250, page: 1 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } })),
      listUsers({ limit: 250, page: 2 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } })),
      (async () => {
        if (!accessToken || sessionError) return ga4Empty;
        try {
          const [overview, topPages, sources, daily] = await Promise.all([
            getTrafficOverview(accessToken, "website", rangeKey),
            getTopPages(accessToken, "website", rangeKey, 50),
            getTrafficSources(accessToken, "website", rangeKey, 20),
            getTrafficByDay(accessToken, "website", rangeKey),
          ]);
          return { overview, topPages, sources, daily };
        } catch {
          return ga4Empty;
        }
      })(),
    ]);

  // ---- Date filter helpers ----
  const fromMs = range.from.getTime();
  const toMs = range.to.getTime();

  const ordersInPeriod = thinkificOrders.items.filter((o: any) => {
    const t = o.created_at ? new Date(o.created_at).getTime() : 0;
    return t >= fromMs && t <= toMs;
  });
  const enrollmentsInPeriod = thinkificEnrollments.items.filter((e: any) => {
    const t = e.created_at ? new Date(e.created_at).getTime() : 0;
    return t >= fromMs && t <= toMs;
  });

  // New Keap contacts in period (separate API call to use Keap's date filter)
  const keapContactsInPeriod = await listContacts({
    limit: 1,
    since: range.from.toISOString(),
    until: range.to.toISOString(),
  }).catch(() => ({ count: 0, contacts: [] }));

  // ---- Build Thinkific student email set (for Keap intersection) ----
  const thinkificUsers = [...thinkificUsersP1.items, ...thinkificUsersP2.items];
  const thinkificStudentEmails = new Set(
    thinkificUsers
      .map((u: any) => (u.email || "").toLowerCase().trim())
      .filter(Boolean)
  );

  // ---- Tag → buyer rate (sample-based) ----
  const tagSample = keapTagsAll.tags.slice(0, 8);
  const tagConversions = await Promise.all(
    tagSample.map(async (t: any) => {
      try {
        const result = await getContactsWithTag(t.id, { limit: 50 });
        const contactsInThinkific = result.contacts.filter((c: any) => {
          const email = (c.email_addresses?.[0]?.email || "").toLowerCase().trim();
          return email && thinkificStudentEmails.has(email);
        }).length;
        const sampleSize = result.contacts.length;
        return {
          name: t.name,
          totalCount: result.count,
          sampleSize,
          inThinkific: contactsInThinkific,
          rate: sampleSize > 0 ? contactsInThinkific / sampleSize : 0,
        };
      } catch {
        return { name: t.name, totalCount: 0, sampleSize: 0, inThinkific: 0, rate: 0 };
      }
    })
  );

  // ---- Refund correlation ----
  const refundedOrders = thinkificOrders.items.filter((o: any) =>
    (o.status || "").toLowerCase().includes("refund")
  );
  const refundsWithKeap = await Promise.all(
    refundedOrders.slice(0, 10).map(async (o: any) => {
      const email = (o.user_email || "").toLowerCase().trim();
      if (!email) return { order: o, keap: null as any };
      try {
        const lookup = await listContacts({ email, limit: 1 });
        return { order: o, keap: lookup.contacts[0] || null };
      } catch {
        return { order: o, keap: null };
      }
    })
  );

  // ---- Cohort: completion → next purchase ----
  const enrollmentsByUser = new Map<number, any[]>();
  for (const e of thinkificEnrollments.items) {
    const arr = enrollmentsByUser.get(e.user_id) || [];
    arr.push(e);
    enrollmentsByUser.set(e.user_id, arr);
  }

  let completersTotal = 0;
  let completersWhoRebought = 0;
  let totalDaysToNext = 0;
  let nextPurchaseSamples = 0;
  enrollmentsByUser.forEach((arr) => {
    const sorted = [...arr].sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      if (!e.completed_at) continue;
      completersTotal += 1;
      const completedTs = new Date(e.completed_at).getTime();
      const next = sorted.slice(i + 1).find((n) => {
        const ts = new Date(n.created_at || 0).getTime();
        return ts > completedTs;
      });
      if (next) {
        completersWhoRebought += 1;
        const days = Math.round(
          (new Date(next.created_at || 0).getTime() - completedTs) / (24 * 60 * 60 * 1000)
        );
        totalDaysToNext += days;
        nextPurchaseSamples += 1;
      }
    }
  });
  const repurchaseRate = completersTotal > 0 ? completersWhoRebought / completersTotal : 0;
  const avgDaysToNext = nextPurchaseSamples > 0 ? Math.round(totalDaysToNext / nextPurchaseSamples) : 0;

  // ---- Customer journey funnel ----
  const totalVisitors = ga4.overview?.totalUsers ?? 0;
  // Best-effort heuristic: sum users on pages whose path matches course/checkout patterns
  const usersOnCoursePages = ga4.topPages
    .filter((p: any) => COURSE_PATH_RE.test(p.page))
    .reduce((sum: number, p: any) => sum + (p.users || 0), 0);
  const usersOnCheckoutPages = ga4.topPages
    .filter((p: any) => CHECKOUT_PATH_RE.test(p.page))
    .reduce((sum: number, p: any) => sum + (p.users || 0), 0);
  const purchases = ordersInPeriod.filter((o: any) =>
    ["successful", "completed", "paid"].includes((o.status || "").toLowerCase())
  ).length;

  // ---- Page → enrollment matching ----
  const courseSlugs = new Map(
    thinkificCourses.items.map((c: any) => [c.slug?.toLowerCase() ?? "", c])
  );
  const enrollmentsByCourse = new Map<number, number>();
  for (const e of enrollmentsInPeriod) {
    enrollmentsByCourse.set(e.course_id, (enrollmentsByCourse.get(e.course_id) || 0) + 1);
  }
  const pagesWithEnrollments = ga4.topPages
    .map((p: any) => {
      const path = p.page.toLowerCase();
      let matched: any = null;
      for (const [slug, course] of Array.from(courseSlugs.entries())) {
        if (slug && path.includes(slug)) {
          matched = course;
          break;
        }
      }
      if (!matched) return null;
      const enrollments = enrollmentsByCourse.get(matched.id) || 0;
      return {
        page: p.page,
        course: matched,
        pageviews: p.pageviews,
        users: p.users,
        enrollments,
        conversion: p.users > 0 ? enrollments / p.users : 0,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.pageviews - a.pageviews);

  // ---- Email ↔ traffic overlay ----
  const trafficByDate = new Map<string, number>();
  for (const d of ga4.daily) {
    trafficByDate.set(d.date, d.users);
  }
  const avgDailyUsers =
    ga4.daily.length > 0
      ? ga4.daily.reduce((s: number, d: any) => s + d.users, 0) / ga4.daily.length
      : 0;
  const emailTrafficOverlay = keapEmails.emails
    .map((e: any) => {
      if (!e.sent_date) return null;
      const day = e.sent_date.slice(0, 10).replace(/-/g, "");
      const users = trafficByDate.get(day) || 0;
      const lift = avgDailyUsers > 0 ? Math.round(((users - avgDailyUsers) / avgDailyUsers) * 100) : 0;
      return { subject: e.subject || "(no subject)", day: e.sent_date, users, lift };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => (b.day || "").localeCompare(a.day || ""))
    .slice(0, 30);

  return {
    range,
    ga4,
    sessionError,
    accessToken: !!accessToken,
    keapContactsTotal: keapContactsTotal.count,
    keapContactsInPeriod: keapContactsInPeriod.count,
    keapEmails: keapEmails.emails,
    keapTagsAll: keapTagsAll.tags,
    keapTagsTotalCount: keapTagsAll.count,
    thinkificCoursesTotal: thinkificCourses.meta.pagination.total_items,
    thinkificStudentsTotal: thinkificUsersP1.meta.pagination.total_items,
    thinkificStudentsCount: thinkificStudentEmails.size,
    ordersInPeriod,
    enrollmentsInPeriod,
    purchases,
    totalVisitors,
    usersOnCoursePages,
    usersOnCheckoutPages,
    tagConversions,
    refundsWithKeap,
    cohort: {
      completersTotal,
      completersWhoRebought,
      repurchaseRate,
      avgDaysToNext,
    },
    pagesWithEnrollments,
    emailTrafficOverlay,
    avgDailyUsers,
  };
}

export const metadata = {
  title: "Analytics — Z-Health Portal",
};

export default async function AnalyticsPortalPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await loadAnalytics(searchParams);

  const updatedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Visitor → buyer rate (overall)
  const visitorToBuyer =
    data.totalVisitors > 0 ? data.purchases / data.totalVisitors : 0;
  const visitorToContact =
    data.totalVisitors > 0 ? data.keapContactsInPeriod / data.totalVisitors : 0;
  const contactToBuyer =
    data.keapContactsInPeriod > 0 ? data.purchases / data.keapContactsInPeriod : 0;

  // Sources sorted
  const sourcesRanked = [...data.ga4.sources].sort((a: any, b: any) => b.sessions - a.sessions);

  // Tag conversions ranked
  const tagConvRanked = [...data.tagConversions]
    .filter((t) => t.sampleSize > 0)
    .sort((a, b) => b.rate - a.rate);

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Analytics
          </h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <span className="text-xs text-gray-400 dark:text-gray-500">{updatedAt} PT</span>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          Cross-system reporting that joins GA4, Keap, and Thinkific data. {data.range.label.toLowerCase()}.
        </p>
      </header>

      {!data.accessToken && (
        <Card className="mb-8 border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>GA4 not connected.</strong>{" "}
            {data.sessionError === "RefreshAccessTokenError"
              ? "Your Google session expired. Sign out and back in to reconnect Analytics."
              : "Sign in with a Google account that has analytics.readonly access."}
            Acquisition, Funnel, and Pages reports need GA4 to populate.
          </p>
        </Card>
      )}

      <div className="mb-10">
        <KPIGrid
          accent="purple"
          kpis={[
            { label: "Visitors", value: data.totalVisitors || "—", hint: "GA4 in period" },
            { label: "New contacts", value: data.keapContactsInPeriod, hint: "Keap" },
            { label: "Buyers", value: data.purchases, hint: "Thinkific completed orders" },
            {
              label: "End-to-end conversion",
              value: visitorToBuyer ? pct(data.purchases, data.totalVisitors) : "—",
              hint: "Visitor → buyer",
            },
          ]}
        />
      </div>

      <Tabs
        tabs={[
          { id: "funnel", label: "Customer journey" },
          { id: "acquisition", label: "Acquisition" },
          { id: "pages", label: "Pages → Enrollments" },
          { id: "emails", label: "Emails ↔ Traffic" },
          { id: "audience", label: "Audience crossover" },
          { id: "cohorts", label: "Cohorts" },
          { id: "refunds", label: "Refunds" },
        ]}
      >
        {/* ===== Customer Journey Funnel ===== */}
        <TabPanel id="funnel">
          <Section
            title="Customer journey funnel"
            description="Visitors → reached a course page → reached checkout → purchased. Stage detection uses URL path heuristics; refine the regexes if your paths differ."
          >
            <Card>
              <Funnel
                color="blue"
                stages={[
                  {
                    label: "Visitors to site",
                    value: data.totalVisitors,
                    hint: "GA4 totalUsers",
                  },
                  {
                    label: "Reached a course page",
                    value: data.usersOnCoursePages,
                    hint: "Path matches /course/, /enroll/, /product/",
                  },
                  {
                    label: "Reached checkout",
                    value: data.usersOnCheckoutPages,
                    hint: "Path matches /checkout/, /cart/, /payment/",
                  },
                  {
                    label: "Purchased",
                    value: data.purchases,
                    hint: "Thinkific completed orders",
                  },
                ]}
              />
            </Card>
          </Section>

          <Section title="Conversion rates">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card>
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Visitor → contact
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                  {visitorToContact ? pct(data.keapContactsInPeriod, data.totalVisitors) : "—"}
                </div>
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">
                  {data.keapContactsInPeriod.toLocaleString()} of {data.totalVisitors.toLocaleString()}
                </div>
              </Card>
              <Card>
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Contact → buyer
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                  {contactToBuyer ? pct(data.purchases, data.keapContactsInPeriod) : "—"}
                </div>
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">
                  {data.purchases} of {data.keapContactsInPeriod.toLocaleString()}
                </div>
              </Card>
              <Card>
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Visitor → buyer
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
                  {visitorToBuyer ? pct(data.purchases, data.totalVisitors) : "—"}
                </div>
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">
                  End-to-end
                </div>
              </Card>
            </div>
          </Section>
        </TabPanel>

        {/* ===== Acquisition ===== */}
        <TabPanel id="acquisition">
          <Section
            title="Traffic sources"
            description="Where visitors came from in this period (GA4 source / medium)."
          >
            <Card>
              <BarList
                color="blue"
                items={sourcesRanked.slice(0, 15).map((s: any) => ({
                  label: `${s.source} / ${s.medium}`,
                  value: s.sessions,
                  sublabel: `${s.users} users`,
                }))}
                formatValue={(n) => `${n.toLocaleString()} sessions`}
                emptyMessage="No GA4 data — connect Google account."
              />
            </Card>
          </Section>

          <Section title="Period totals" description="Aggregate counts at each acquisition stage.">
            <KPIGrid
              kpis={[
                { label: "Visitors", value: data.totalVisitors || "—" },
                { label: "Contacts created", value: data.keapContactsInPeriod },
                { label: "Orders completed", value: data.purchases },
                { label: "Total contacts", value: data.keapContactsTotal, hint: "All time" },
              ]}
            />
          </Section>

          <InsightGrid>
            <Insight severity="info" title={`${sourcesRanked.length} sources sent traffic`}>
              Top three: {sourcesRanked.slice(0, 3).map((s: any) => `${s.source} / ${s.medium}`).join(", ") || "—"}.
            </Insight>
            {visitorToContact > 0 && (
              <Insight
                severity={visitorToContact > 0.05 ? "good" : "warn"}
                title={`Visitor → contact: ${pct(data.keapContactsInPeriod, data.totalVisitors)}`}
              >
                {visitorToContact > 0.05
                  ? "Healthy lead capture rate."
                  : "Low capture — review opt-in placement on top pages."}
              </Insight>
            )}
            {contactToBuyer > 0 && (
              <Insight severity="info" title={`Contact → buyer: ${pct(data.purchases, data.keapContactsInPeriod)}`}>
                {data.purchases} buyers from {data.keapContactsInPeriod.toLocaleString()} new contacts in period.
              </Insight>
            )}
          </InsightGrid>
        </TabPanel>

        {/* ===== Pages → Enrollments ===== */}
        <TabPanel id="pages">
          <Section
            title="Top pages with matching course enrollments"
            description="GA4 page paths matched to Thinkific course slugs. Conversion = enrollments / unique users on that page."
          >
            <Card padded={false}>
              {data.pagesWithEnrollments.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-500">
                  No matching pages found. Check that GA4 data is loading and that course slugs appear in WP page paths.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200/70 dark:border-white/5">
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <th className="px-5 py-3">Page</th>
                      <th className="px-5 py-3">Matched course</th>
                      <th className="px-5 py-3">Pageviews</th>
                      <th className="px-5 py-3">Users</th>
                      <th className="px-5 py-3">Enrollments</th>
                      <th className="px-5 py-3">Conversion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {data.pagesWithEnrollments.slice(0, 25).map((row: any, i: number) => (
                      <tr key={i} className="text-gray-700 dark:text-gray-300">
                        <td className="px-5 py-3 font-mono text-xs">{row.page}</td>
                        <td className="px-5 py-3 text-xs">{row.course?.name || "—"}</td>
                        <td className="px-5 py-3 text-xs tabular-nums">{row.pageviews?.toLocaleString() || 0}</td>
                        <td className="px-5 py-3 text-xs tabular-nums">{row.users?.toLocaleString() || 0}</td>
                        <td className="px-5 py-3 text-xs tabular-nums">{row.enrollments}</td>
                        <td className="px-5 py-3 text-xs tabular-nums">
                          {row.users > 0 ? `${(row.conversion * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </Section>
        </TabPanel>

        {/* ===== Emails ↔ Traffic ===== */}
        <TabPanel id="emails">
          <Section
            title="Email send dates overlaid on site traffic"
            description={`For each Keap broadcast in window, the day's GA4 user count and lift vs. period average (${Math.round(data.avgDailyUsers).toLocaleString()} users/day).`}
          >
            <Card padded={false}>
              {data.emailTrafficOverlay.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-500">
                  No emails in window or GA4 data missing.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200/70 dark:border-white/5">
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <th className="px-5 py-3">Sent date</th>
                      <th className="px-5 py-3">Subject</th>
                      <th className="px-5 py-3">Day&apos;s users</th>
                      <th className="px-5 py-3">Lift vs avg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {data.emailTrafficOverlay.map((row: any, i: number) => (
                      <tr key={i} className="text-gray-700 dark:text-gray-300">
                        <td className="px-5 py-3 text-xs">
                          {row.day ? new Date(row.day).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{row.subject}</td>
                        <td className="px-5 py-3 text-xs tabular-nums">{row.users.toLocaleString()}</td>
                        <td className="px-5 py-3 text-xs tabular-nums">
                          <span
                            className={
                              row.lift > 10
                                ? "text-emerald-600 dark:text-emerald-400"
                                : row.lift < -10
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-gray-500"
                            }
                          >
                            {row.lift > 0 ? "+" : ""}
                            {row.lift}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </Section>
        </TabPanel>

        {/* ===== Audience crossover ===== */}
        <TabPanel id="audience">
          <Section
            title="Keap → Thinkific conversion by tag"
            description={`Sample-based: for each tag, what share of the contact sample also exists as a Thinkific student. Sample size up to 50 per tag, intersected with ${data.thinkificStudentsCount.toLocaleString()} loaded Thinkific student emails.`}
          >
            <Card padded={false}>
              {tagConvRanked.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-500">
                  No tag samples available.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200/70 dark:border-white/5">
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <th className="px-5 py-3">Tag</th>
                      <th className="px-5 py-3">Total contacts</th>
                      <th className="px-5 py-3">Sample</th>
                      <th className="px-5 py-3">In Thinkific</th>
                      <th className="px-5 py-3">Conversion rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {tagConvRanked.map((t, i) => (
                      <tr key={i} className="text-gray-700 dark:text-gray-300">
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{t.name}</td>
                        <td className="px-5 py-3 text-xs tabular-nums">{t.totalCount.toLocaleString()}</td>
                        <td className="px-5 py-3 text-xs tabular-nums">{t.sampleSize}</td>
                        <td className="px-5 py-3 text-xs tabular-nums">{t.inThinkific}</td>
                        <td className="px-5 py-3 text-xs tabular-nums">
                          <span
                            className={
                              t.rate > 0.2
                                ? "rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : ""
                            }
                          >
                            {(t.rate * 100).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
              Note: Email match is exact and case-insensitive. Thinkific students sourced by paginating up to 500 records — for the full picture we&apos;ll add a Supabase-cached complete email index.
            </p>
          </Section>

          <InsightGrid>
            <Insight severity="info" title={`${data.thinkificStudentsCount.toLocaleString()} Thinkific student emails loaded`}>
              Out of {data.thinkificStudentsTotal.toLocaleString()} total. Adjust pagination or add caching to scan more.
            </Insight>
            {tagConvRanked.length > 0 && tagConvRanked[0].rate > 0 && (
              <Insight severity="good" title={`Best-converting sampled tag: ${tagConvRanked[0].name}`}>
                {(tagConvRanked[0].rate * 100).toFixed(1)}% of sample are also Thinkific students.
              </Insight>
            )}
          </InsightGrid>
        </TabPanel>

        {/* ===== Cohorts ===== */}
        <TabPanel id="cohorts">
          <Section title="Completion → next purchase" description="Within Thinkific. Of students who completed at least one course, how many enrolled in another course afterward.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card>
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Completers
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                  {data.cohort.completersTotal.toLocaleString()}
                </div>
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">
                  Completed at least one course
                </div>
              </Card>
              <Card>
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Repurchase rate
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
                  {data.cohort.completersTotal > 0 ? `${(data.cohort.repurchaseRate * 100).toFixed(1)}%` : "—"}
                </div>
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">
                  {data.cohort.completersWhoRebought.toLocaleString()} bought another course after
                </div>
              </Card>
              <Card>
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Avg days to next
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                  {data.cohort.avgDaysToNext > 0 ? `${data.cohort.avgDaysToNext}d` : "—"}
                </div>
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">
                  From completion to next enrollment
                </div>
              </Card>
            </div>
          </Section>

          <InsightGrid>
            {data.cohort.repurchaseRate > 0 && (
              <Insight
                severity={data.cohort.repurchaseRate > 0.3 ? "good" : "warn"}
                title={`${(data.cohort.repurchaseRate * 100).toFixed(1)}% of completers re-engage`}
              >
                {data.cohort.repurchaseRate > 0.3
                  ? "Healthy repurchase signal — your post-completion offers are working."
                  : "Lower than typical for course businesses (often 30%+). Consider a stronger next-step offer triggered on completion."}
              </Insight>
            )}
            {data.cohort.avgDaysToNext > 0 && (
              <Insight severity="info" title={`Average ${data.cohort.avgDaysToNext} days from completion to next enrollment`}>
                Time the upsell campaign to land within this window.
              </Insight>
            )}
          </InsightGrid>
        </TabPanel>

        {/* ===== Refunds ===== */}
        <TabPanel id="refunds">
          <Section
            title="Refunded orders + their Keap context"
            description={`Up to ${data.refundsWithKeap.length} most-recent refunds, with the Keap contact (if found by email) and what tags / opt-in status they have. Use this to spot patterns in which campaigns or sources produce refunds.`}
          >
            <Card padded={false}>
              {data.refundsWithKeap.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-500">
                  No refunds in current data window.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200/70 dark:border-white/5">
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <th className="px-5 py-3">Refund date</th>
                      <th className="px-5 py-3">Customer</th>
                      <th className="px-5 py-3">Course</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Keap tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {data.refundsWithKeap.map((row: any, i: number) => (
                      <tr key={i} className="text-gray-700 dark:text-gray-300">
                        <td className="px-5 py-3 text-xs">
                          {row.order.created_at ? new Date(row.order.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs">
                          {row.order.user_email || row.order.user_name || "—"}
                          {row.keap && (
                            <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                              In Keap
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {row.order.product_name || `#${row.order.product_id}`}
                        </td>
                        <td className="px-5 py-3 text-xs tabular-nums">{fmtMoney(row.order.amount_cents || 0)}</td>
                        <td className="px-5 py-3 text-xs">
                          {row.keap?.tag_ids && row.keap.tag_ids.length > 0
                            ? `${row.keap.tag_ids.length} tags`
                            : row.keap
                            ? "no tags"
                            : "not in Keap"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </Section>
        </TabPanel>
      </Tabs>
    </main>
  );
}
