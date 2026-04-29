import StatusCard from "@/components/portal/StatusCard";
import QuestionCard from "@/components/portal/QuestionCard";
import DateRangePicker from "@/components/portal/DateRangePicker";
import { parseTimeRange, pctChange } from "@/lib/time-range";
import { getServerSession } from "@/lib/auth";
import { listContacts, listTags, listCampaigns, listOpportunities } from "@/lib/keap";
import { getLMSOverview, listCourses, listOrders, listEnrollments } from "@/lib/thinkific";
import { getTrafficOverviewWithComparison, getTrafficSources } from "@/lib/google-analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STATUS_OK = ["successful", "completed", "paid"];

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function fmtPct(n: number, of: number): string {
  if (!of) return "—";
  return `${Math.round((n / of) * 1000) / 10}%`;
}

async function loadOverviewData(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;
  const fromMs = range.from.getTime();
  const toMs = range.to.getTime();
  const priorFromMs = range.prior.from.getTime();
  const priorToMs = range.prior.to.getTime();

  const session = (await getServerSession()) as any;
  const accessToken = session?.accessToken;
  const sessionError = session?.error;

  // Parallel fetch across all systems
  const [
    keapContactsTotal,
    keapContactsInPeriod,
    keapContactsPrior,
    keapTags,
    keapCampaigns,
    keapOpps,
    thinkificCourses,
    thinkificOrders,
    thinkificEnrollments,
    thinkificOverview,
    ga4,
  ] = await Promise.all([
    listContacts({ limit: 1 }).catch(() => ({ count: 0, contacts: [] })),
    listContacts({ limit: 1, since: range.from.toISOString(), until: range.to.toISOString() }).catch(() => ({ count: 0, contacts: [] })),
    listContacts({ limit: 1, since: range.prior.from.toISOString(), until: range.prior.to.toISOString() }).catch(() => ({ count: 0, contacts: [] })),
    listTags({ limit: 1 }).catch(() => ({ count: 0, tags: [] })),
    listCampaigns({ limit: 200 }).catch(() => ({ count: 0, campaigns: [] })),
    listOpportunities({ limit: 200 }).catch(() => ({ count: 0, opportunities: [] })),
    listCourses({ limit: 250 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } })),
    listOrders({ limit: 250 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } })),
    listEnrollments({ limit: 250 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } })),
    getLMSOverview().catch(() => null),
    (async () => {
      if (!accessToken || sessionError) return null;
      try {
        const [overview, sources] = await Promise.all([
          getTrafficOverviewWithComparison(accessToken, "website", rangeKey),
          getTrafficSources(accessToken, "website", rangeKey, 5),
        ]);
        return { overview, sources };
      } catch {
        return null;
      }
    })(),
  ]);

  // ---- Period filtering on Thinkific data ----
  const ordersInPeriod = thinkificOrders.items.filter((o: any) => {
    const t = o.created_at ? new Date(o.created_at).getTime() : 0;
    return t >= fromMs && t <= toMs;
  });
  const ordersInPrior = thinkificOrders.items.filter((o: any) => {
    const t = o.created_at ? new Date(o.created_at).getTime() : 0;
    return t >= priorFromMs && t <= priorToMs;
  });
  const completedOrders = ordersInPeriod.filter((o: any) => STATUS_OK.includes((o.status || "").toLowerCase()));
  const completedOrdersPrior = ordersInPrior.filter((o: any) => STATUS_OK.includes((o.status || "").toLowerCase()));

  const revenue = completedOrders.reduce((s: number, o: any) => s + (o.amount_cents || 0), 0);
  const revenuePrior = completedOrdersPrior.reduce((s: number, o: any) => s + (o.amount_cents || 0), 0);
  const revTrend = pctChange(revenue, revenuePrior);

  // Top earner in period
  const productRevenue = new Map<number, { name: string; revenue: number }>();
  for (const o of ordersInPeriod) {
    if (!o.product_id) continue;
    const cur = productRevenue.get(o.product_id) || { name: o.product_name || `Product #${o.product_id}`, revenue: 0 };
    cur.revenue += o.amount_cents || 0;
    productRevenue.set(o.product_id, cur);
  }
  const topEarner = Array.from(productRevenue.values()).sort((a, b) => b.revenue - a.revenue)[0];

  // Top campaign in Keap
  const topCampaign = [...keapCampaigns.campaigns]
    .filter((c: any) => (c.active_contact_count ?? 0) > 0)
    .sort((a: any, b: any) => (b.active_contact_count ?? 0) - (a.active_contact_count ?? 0))[0];

  // Pipeline value
  const pipelineValue = keapOpps.opportunities.reduce(
    (s: number, opp: any) => s + (opp.projected_revenue_high ?? 0),
    0
  );

  // Top course by enrollment (lifetime, not period)
  const topCourse = [...thinkificCourses.items].sort(
    (a: any, b: any) => (b.user_count ?? 0) - (a.user_count ?? 0)
  )[0];

  // Stalled students
  const oneWeekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stalledStudents = thinkificEnrollments.items.filter((e: any) => {
    const enrolledMs = e.created_at ? new Date(e.created_at).getTime() : 0;
    return enrolledMs > 0 && enrolledMs < oneWeekAgoMs && (e.percentage_completed ?? 0) === 0 && !e.expired;
  }).length;

  // Repurchase rate (cohort)
  const enrollmentsByUser = new Map<number, any[]>();
  for (const e of thinkificEnrollments.items) {
    const arr = enrollmentsByUser.get(e.user_id) || [];
    arr.push(e);
    enrollmentsByUser.set(e.user_id, arr);
  }
  let completersTotal = 0;
  let completersWhoRebought = 0;
  enrollmentsByUser.forEach((arr) => {
    const sorted = [...arr].sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      if (!e.completed_at) continue;
      completersTotal += 1;
      const completedTs = new Date(e.completed_at).getTime();
      const next = sorted.slice(i + 1).find((n) => new Date(n.created_at || 0).getTime() > completedTs);
      if (next) completersWhoRebought += 1;
    }
  });
  const repurchaseRate = completersTotal > 0 ? completersWhoRebought / completersTotal : 0;

  // Course completion rate (sample)
  const courseCompletion = (() => {
    const total = thinkificEnrollments.items.length;
    const completed = thinkificEnrollments.items.filter((e: any) => e.completed_at).length;
    return total > 0 ? completed / total : 0;
  })();

  // Lead trend
  const leadsTrend = pctChange(keapContactsInPeriod.count, keapContactsPrior.count);

  return {
    range,
    keapContactsTotal: keapContactsTotal.count,
    keapContactsInPeriod: keapContactsInPeriod.count,
    leadsTrend,
    keapTagsTotal: keapTags.count,
    keapCampaignsTotal: keapCampaigns.count,
    pipelineValue,
    pipelineCount: keapOpps.opportunities.length,
    topCampaign,
    revenue,
    revenuePrior,
    revTrend,
    topEarner,
    aov: ordersInPeriod.length > 0 ? revenue / ordersInPeriod.length : 0,
    ordersInPeriod: ordersInPeriod.length,
    completedOrders: completedOrders.length,
    thinkificCoursesTotal: thinkificCourses.meta.pagination.total_items,
    thinkificStudentsTotal: thinkificOverview?.total_students ?? 0,
    thinkificEnrollmentsTotal: thinkificOverview?.total_enrollments ?? 0,
    topCourse,
    stalledStudents,
    repurchaseRate,
    completersTotal,
    courseCompletion,
    ga4: ga4
      ? {
          users: ga4.overview.current.totalUsers,
          usersPrior: ga4.overview.previous.totalUsers,
          usersTrend: pctChange(ga4.overview.current.totalUsers, ga4.overview.previous.totalUsers),
          topSource: ga4.sources?.[0],
          topSources: ga4.sources,
        }
      : null,
    sessionError,
    accessToken: !!accessToken,
  };
}

export const metadata = {
  title: "Portal Overview — Z-Health",
};

export default async function PortalOverviewPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await loadOverviewData(searchParams);

  const updatedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Conversion rates for cross-system questions
  const visitorToContact =
    data.ga4 && data.ga4.users > 0 ? data.keapContactsInPeriod / data.ga4.users : 0;
  const visitorToBuyer =
    data.ga4 && data.ga4.users > 0 ? data.completedOrders / data.ga4.users : 0;
  const contactToBuyer =
    data.keapContactsInPeriod > 0 ? data.completedOrders / data.keapContactsInPeriod : 0;

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Z-Health Portal
          </h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <span className="text-xs text-gray-400 dark:text-gray-500">{updatedAt} PT</span>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-600 dark:text-gray-400">
          The questions your team is asking, answered with live data from Keap, Thinkific, and
          GA4. {data.range.label.toLowerCase()}.
        </p>
      </header>

      {/* GROWTH — acquisition questions */}
      <section className="mb-12">
        <div className="mb-5 flex items-baseline gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Growth
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Where new business comes from
          </span>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <QuestionCard
            accent="blue"
            question="How many new leads did we capture?"
            answer={data.keapContactsInPeriod}
            context={`new contacts in Keap during ${data.range.label.toLowerCase()}`}
            trend={data.leadsTrend}
            detail={`vs ${data.range.prior.from.toLocaleDateString()} – ${data.range.prior.to.toLocaleDateString()}`}
            href="/portal/keap?tab=reports"
          />
          <QuestionCard
            accent="purple"
            question="How many people visited the site?"
            answer={data.ga4 ? data.ga4.users : "—"}
            context={data.ga4 ? "unique users from GA4" : "GA4 not connected — sign in with Google"}
            trend={data.ga4?.usersTrend}
            href="/portal/wp"
          />
          <QuestionCard
            accent="green"
            question="Where did most visitors come from?"
            answer={data.ga4?.topSource ? `${data.ga4.topSource.source} / ${data.ga4.topSource.medium}` : "—"}
            context={
              data.ga4?.topSource
                ? `${data.ga4.topSource.sessions.toLocaleString()} sessions from this source`
                : "GA4 traffic source data not available"
            }
            href="/portal/analytics?tab=acquisition"
          />
          <QuestionCard
            accent="amber"
            question="How well are visitors converting to leads?"
            answer={data.ga4 && data.ga4.users > 0 ? `${(visitorToContact * 100).toFixed(1)}%` : "—"}
            context={
              data.ga4 && data.ga4.users > 0
                ? `${data.keapContactsInPeriod.toLocaleString()} contacts from ${data.ga4.users.toLocaleString()} visitors`
                : "Needs GA4 + Keap"
            }
            href="/portal/analytics?tab=funnel"
          />
          <QuestionCard
            accent="purple"
            question="How big is our audience overall?"
            answer={data.keapContactsTotal}
            context="all-time contacts in Keap CRM"
            href="/portal/keap?tab=tags"
          />
          <QuestionCard
            accent="blue"
            question="What's our top campaign right now?"
            answer={data.topCampaign?.name || "—"}
            context={
              data.topCampaign
                ? `${data.topCampaign.active_contact_count?.toLocaleString()} contacts currently engaged`
                : "No active campaigns found"
            }
            href="/portal/keap?tab=campaigns"
          />
        </div>
      </section>

      {/* REVENUE */}
      <section className="mb-12">
        <div className="mb-5 flex items-baseline gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Revenue
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">What customers are buying</span>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <QuestionCard
            accent="green"
            question="How much did we make this period?"
            answer={fmtMoney(data.revenue)}
            context={`from ${data.completedOrders.toLocaleString()} completed orders on Thinkific`}
            trend={data.revTrend}
            detail={`vs ${fmtMoney(data.revenuePrior)} prior period`}
            href="/portal/thinkific?tab=reports"
          />
          <QuestionCard
            accent="green"
            question="What was our top-earning product?"
            answer={data.topEarner?.name || "—"}
            context={data.topEarner ? `${fmtMoney(data.topEarner.revenue)} in this period` : "No orders in period"}
            href="/portal/thinkific?tab=reports"
          />
          <QuestionCard
            accent="amber"
            question="What's the average order value?"
            answer={data.aov > 0 ? fmtMoney(data.aov) : "—"}
            context={`across ${data.ordersInPeriod.toLocaleString()} orders this period`}
            href="/portal/thinkific?tab=orders"
          />
          <QuestionCard
            accent="purple"
            question="What's in our sales pipeline?"
            answer={data.pipelineValue > 0 ? fmtMoney(data.pipelineValue * 100) : "—"}
            context={
              data.pipelineCount > 0
                ? `across ${data.pipelineCount.toLocaleString()} open opportunities in Keap`
                : "No opportunities found"
            }
            href="/portal/keap?tab=pipeline"
          />
          <QuestionCard
            accent="blue"
            question="How many courses do we sell?"
            answer={data.thinkificCoursesTotal}
            context="published + draft on Thinkific"
            href="/portal/thinkific?tab=courses"
          />
          <QuestionCard
            accent="green"
            question="What's our most-enrolled course?"
            answer={data.topCourse?.name || "—"}
            context={data.topCourse ? `${data.topCourse.user_count?.toLocaleString()} students enrolled lifetime` : "—"}
            href="/portal/thinkific?tab=courses"
          />
        </div>
      </section>

      {/* ENGAGEMENT & RETENTION */}
      <section className="mb-12">
        <div className="mb-5 flex items-baseline gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Engagement &amp; retention
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            How well existing customers are doing
          </span>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <QuestionCard
            accent="amber"
            question="How many students have stalled?"
            answer={data.stalledStudents}
            context="enrolled 7+ days ago with 0% progress — re-engagement targets"
            href="/portal/thinkific?tab=students"
          />
          <QuestionCard
            accent="green"
            question="Do students complete what they buy?"
            answer={`${(data.courseCompletion * 100).toFixed(0)}%`}
            context={`completion rate across ${data.thinkificEnrollmentsTotal.toLocaleString()} sampled enrollments`}
            href="/portal/thinkific?tab=reports"
          />
          <QuestionCard
            accent="purple"
            question="Do customers come back for more?"
            answer={data.completersTotal > 0 ? `${(data.repurchaseRate * 100).toFixed(0)}%` : "—"}
            context={
              data.completersTotal > 0
                ? `of ${data.completersTotal.toLocaleString()} completers buy another course`
                : "Need more completion data"
            }
            href="/portal/analytics?tab=cohorts"
          />
        </div>
      </section>

      {/* CONVERSION */}
      <section className="mb-12">
        <div className="mb-5 flex items-baseline gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            End-to-end conversion
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            How the funnel is performing across systems
          </span>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <QuestionCard
            accent="rose"
            question="What % of visitors become buyers?"
            answer={data.ga4 && data.ga4.users > 0 ? `${(visitorToBuyer * 100).toFixed(2)}%` : "—"}
            context={
              data.ga4 && data.ga4.users > 0
                ? `${data.completedOrders.toLocaleString()} buyers from ${data.ga4.users.toLocaleString()} visitors`
                : "Needs GA4"
            }
            href="/portal/analytics?tab=funnel"
          />
          <QuestionCard
            accent="amber"
            question="What % of leads become buyers?"
            answer={data.keapContactsInPeriod > 0 ? `${(contactToBuyer * 100).toFixed(1)}%` : "—"}
            context={
              data.keapContactsInPeriod > 0
                ? `${data.completedOrders.toLocaleString()} buyers from ${data.keapContactsInPeriod.toLocaleString()} new contacts`
                : "No new contacts in period"
            }
            href="/portal/analytics?tab=acquisition"
          />
          <QuestionCard
            accent="purple"
            question="Are emails driving traffic spikes?"
            answer={data.ga4 ? "See overlay" : "—"}
            context="Keap email send dates aligned with GA4 daily traffic to identify the broadcasts that landed"
            href="/portal/analytics?tab=emails"
          />
        </div>
      </section>

      {/* SYSTEM STATUS — compact at the bottom */}
      <section>
        <div className="mb-5 flex items-baseline gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            System status
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">All connected feeds</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard
            title="Keap CRM"
            href="/portal/keap"
            status="ok"
            description="Contacts, tags, campaigns, pipeline"
            stats={[
              { label: "Contacts", value: data.keapContactsTotal },
              { label: "Tags", value: data.keapTagsTotal },
            ]}
          />
          <StatusCard
            title="Thinkific LMS"
            href="/portal/thinkific"
            status="ok"
            description="Courses, students, enrollments, orders"
            stats={[
              { label: "Courses", value: data.thinkificCoursesTotal },
              { label: "Students", value: data.thinkificStudentsTotal },
            ]}
          />
          <StatusCard
            title="WordPress site"
            href="/portal/wp"
            status="ok"
            description="zhealtheducation.com — content, lead gen"
            stats={[
              { label: "Visitors", value: data.ga4?.users ?? 0 },
              { label: "Trend", value: data.ga4 ? `${data.ga4.usersTrend.positive ? "+" : "−"}${data.ga4.usersTrend.value}%` : "—" },
            ]}
          />
          <StatusCard
            title="Analytics"
            href="/portal/analytics"
            status={data.accessToken ? "ok" : "warn"}
            description="Cross-system funnels and reports"
            errorMessage={
              !data.accessToken
                ? "GA4 not connected — sign in with Google"
                : undefined
            }
          />
        </div>
      </section>
    </main>
  );
}
