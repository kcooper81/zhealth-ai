import KPIGrid from "@/components/portal/KPIGrid";
import MermaidDiagram from "@/components/MermaidDiagram";
import Tabs, { TabPanel } from "@/components/portal/Tabs";
import Section, { Card } from "@/components/portal/Section";
import BarList from "@/components/portal/BarList";
import DateRangePicker from "@/components/portal/DateRangePicker";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import { parseTimeRange, monthKey, pctChange } from "@/lib/time-range";
import { cachedFetch, TTL } from "@/lib/cache";
import {
  listCourses,
  listOrders,
  listProducts,
  listEnrollments,
  listCoupons,
  getLMSOverview,
} from "@/lib/thinkific";

export const dynamic = "force-dynamic";

const THINKIFIC_FLOW_DIAGRAM = `
flowchart TD
  Visit["Visitor on<br/>zuniversity"]:::appleBlue --> Browse["Browses courses"]:::appleBlue
  Browse --> Pick["Picks a course<br/>or bundle"]:::appleAmber
  Pick --> Cart["Thinkific checkout"]:::appleGreen
  Cart --> Pay["Payment processed"]:::appleGreen
  Pay --> Order["Order created"]:::appleGreen
  Order --> Enroll["Enrollment created"]:::appleGreen
  Enroll --> Access["Course access granted"]:::appleGreen
  Access --> Progress["Progress tracked"]:::applePurple
  Progress --> Done["Course completed"]:::applePurple
  Done --> Cert["Certificate issued"]:::applePurple
  classDef appleBlue fill:#eff6ff,stroke:#3b82f6,color:#1e40af,stroke-width:1.5px
  classDef appleGreen fill:#ecfdf5,stroke:#10b981,color:#065f46,stroke-width:1.5px
  classDef appleAmber fill:#fffbeb,stroke:#f59e0b,color:#92400e,stroke-width:1.5px
  classDef applePurple fill:#f5f3ff,stroke:#8b5cf6,color:#5b21b6,stroke-width:1.5px
`;

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const STATUS_OK = ["successful", "completed", "paid"];

async function loadThinkificData(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const courseFilter = Array.isArray(searchParams.course) ? searchParams.course[0] : searchParams.course;

  try {
    const [overview, allCourses, ordersPage1, ordersPage2, products, recentEnrollments, coupons] =
      await Promise.all([
        cachedFetch("thinkific:overview", TTL.THINKIFIC_OVERVIEW, () =>
          getLMSOverview().catch(() => null)
        ),
        cachedFetch("thinkific:courses:250", TTL.THINKIFIC_COURSES, () =>
          listCourses({ limit: 250 })
        ),
        cachedFetch("thinkific:orders:p1:250", TTL.THINKIFIC_ORDERS, () =>
          listOrders({ limit: 250, page: 1 }).catch(() => ({
            items: [],
            meta: { pagination: { total_items: 0 } },
          }))
        ),
        cachedFetch("thinkific:orders:p2:250", TTL.THINKIFIC_ORDERS, () =>
          listOrders({ limit: 250, page: 2 }).catch(() => ({
            items: [],
            meta: { pagination: { total_items: 0 } },
          }))
        ),
        cachedFetch("thinkific:products:250", TTL.THINKIFIC_PRODUCTS, () =>
          listProducts({ limit: 250 }).catch(() => ({ items: [] }))
        ),
        cachedFetch("thinkific:enrollments:250", TTL.THINKIFIC_ENROLLMENTS, () =>
          listEnrollments({ limit: 250 }).catch(() => ({
            items: [],
            meta: { pagination: { total_items: 0 } },
          }))
        ),
        cachedFetch("thinkific:coupons:250", TTL.THINKIFIC_COUPONS, () =>
          listCoupons({ limit: 250 }).catch(() => ({ items: [] }))
        ),
      ]);

    const allOrders = [...ordersPage1.items, ...ordersPage2.items];

    // Thinkific's /courses endpoint does NOT return user_count/status/price.
    // Fetch true enrollment count per course via /enrollments?query[course_id]=X
    // (one call per course; cached individually for 30 min).
    const courseEnrollmentCounts = new Map<number, number>();
    await Promise.all(
      allCourses.items.map(async (c) => {
        try {
          const result = await cachedFetch(
            `thinkific:course-enroll-count:${c.id}`,
            TTL.THINKIFIC_COURSES,
            async () => {
              const r = await listEnrollments({ course_id: c.id, limit: 1 });
              return r.meta.pagination.total_items ?? 0;
            }
          );
          courseEnrollmentCounts.set(c.id, result);
        } catch {
          courseEnrollmentCounts.set(c.id, 0);
        }
      })
    );

    // Build a course → product → price lookup so we can show price even
    // though /courses no longer returns it.
    const productByCourseId = new Map<number, any>();
    for (const p of products.items) {
      for (const cid of p.related_course_ids || []) {
        productByCourseId.set(cid, p);
      }
    }

    return {
      ok: true as const,
      range,
      courseFilter,
      overview,
      courses: allCourses.items,
      coursesTotal: allCourses.meta.pagination.total_items,
      courseEnrollmentCounts,
      productByCourseId,
      ordersTotal: ordersPage1.meta.pagination.total_items,
      orders: allOrders,
      products: products.items,
      recentEnrollments: recentEnrollments.items,
      enrollmentsTotal: recentEnrollments.meta.pagination.total_items,
      coupons: coupons.items,
    };
  } catch (e) {
    return {
      ok: false as const,
      range,
      error: e instanceof Error ? e.message : "Unknown Thinkific error",
    };
  }
}

export const metadata = {
  title: "Thinkific LMS — Z-Health Portal",
};

export default async function ThinkificPortalPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await loadThinkificData(searchParams);

  if (!data.ok) {
    return (
      <main className="mx-auto max-w-7xl px-8 py-12">
        <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
          Thinkific LMS
        </h1>
        <Card className="mt-8 border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20">
          <div className="font-semibold text-rose-900 dark:text-rose-200">
            Could not load Thinkific data
          </div>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-rose-800 dark:text-rose-300">
            {data.error}
          </pre>
        </Card>
      </main>
    );
  }

  const updatedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });

  // ---- Date filtering ----
  const fromMs = data.range.from.getTime();
  const toMs = data.range.to.getTime();
  const priorFromMs = data.range.prior.from.getTime();
  const priorToMs = data.range.prior.to.getTime();

  const ordersInPeriod = data.orders.filter((o) => {
    if (!o.created_at) return false;
    const t = new Date(o.created_at).getTime();
    return t >= fromMs && t <= toMs;
  });
  const ordersInPrior = data.orders.filter((o) => {
    if (!o.created_at) return false;
    const t = new Date(o.created_at).getTime();
    return t >= priorFromMs && t <= priorToMs;
  });

  const enrollmentsInPeriod = data.recentEnrollments.filter((e) => {
    if (!e.created_at) return false;
    const t = new Date(e.created_at).getTime();
    return t >= fromMs && t <= toMs;
  });
  const enrollmentsInPrior = data.recentEnrollments.filter((e) => {
    if (!e.created_at) return false;
    const t = new Date(e.created_at).getTime();
    return t >= priorFromMs && t <= priorToMs;
  });

  // ---- Computed metrics ----
  // Thinkific's /courses endpoint omits status; derive it from the linked product.
  const enrollCount = (courseId: number) => data.courseEnrollmentCounts.get(courseId) ?? 0;
  const productStatus = (courseId: number) =>
    data.productByCourseId.get(courseId)?.status || null;
  const productPrice = (courseId: number) =>
    data.productByCourseId.get(courseId)?.price || null;

  const publishedCourses = data.courses.filter(
    (c) => productStatus(c.id) === "published"
  ).length;
  const draftCourses = data.courses.length - publishedCourses;

  const completedOrdersInPeriod = ordersInPeriod.filter((o) =>
    STATUS_OK.includes((o.status || "").toLowerCase())
  );
  const grossRevenue = ordersInPeriod.reduce((s, o) => s + (o.amount_cents || 0), 0);
  const completedRevenue = completedOrdersInPeriod.reduce((s, o) => s + (o.amount_cents || 0), 0);
  const completedRevenuePrior = ordersInPrior
    .filter((o) => STATUS_OK.includes((o.status || "").toLowerCase()))
    .reduce((s, o) => s + (o.amount_cents || 0), 0);
  const revTrend = pctChange(completedRevenue, completedRevenuePrior);
  const enrollTrend = pctChange(enrollmentsInPeriod.length, enrollmentsInPrior.length);
  const aov = ordersInPeriod.length > 0 ? grossRevenue / ordersInPeriod.length : 0;

  // ---- Revenue by product (in period) ----
  const productRevenue = new Map<number, { name: string; revenue: number; orders: number }>();
  for (const o of ordersInPeriod) {
    if (!o.product_id) continue;
    const cur = productRevenue.get(o.product_id) || {
      name: o.product_name || `Product #${o.product_id}`,
      revenue: 0,
      orders: 0,
    };
    cur.revenue += o.amount_cents || 0;
    cur.orders += 1;
    productRevenue.set(o.product_id, cur);
  }
  const topRevenueProducts = Array.from(productRevenue.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ---- Top courses by enrollment ----
  const topCoursesByEnrollment = [...data.courses]
    .sort((a, b) => enrollCount(b.id) - enrollCount(a.id))
    .slice(0, 10);

  const dormantCourses = data.courses.filter((c) => enrollCount(c.id) === 0);

  // ---- Course completion rate (sample-based) ----
  const enrollmentsByCourse = new Map<number, { total: number; completed: number; courseName: string }>();
  for (const e of data.recentEnrollments) {
    const cur = enrollmentsByCourse.get(e.course_id) || {
      total: 0,
      completed: 0,
      courseName: e.course_name || `Course #${e.course_id}`,
    };
    cur.total += 1;
    if (e.completed_at) cur.completed += 1;
    enrollmentsByCourse.set(e.course_id, cur);
  }
  const courseCompletionRates = Array.from(enrollmentsByCourse.entries())
    .filter(([_, m]) => m.total >= 3) // need at least 3 enrollments to be meaningful
    .map(([id, m]) => ({
      label: m.courseName,
      value: Math.round((m.completed / m.total) * 100),
      sublabel: `${m.completed}/${m.total} completed`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // ---- Stalled students (enrolled in period, 0% complete) ----
  const oneWeekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stalledStudents = data.recentEnrollments.filter((e) => {
    const enrolledMs = e.created_at ? new Date(e.created_at).getTime() : 0;
    const isOldEnough = enrolledMs > 0 && enrolledMs < oneWeekAgoMs;
    const noProgress = (e.percentage_completed ?? 0) === 0;
    const notExpired = !e.expired;
    return isOldEnough && noProgress && notExpired;
  });

  // ---- Cross-purchases (students with multiple enrollments) ----
  const enrollmentsByUser = new Map<number, { count: number; email?: string }>();
  for (const e of data.recentEnrollments) {
    const cur = enrollmentsByUser.get(e.user_id) || { count: 0, email: e.user_email };
    cur.count += 1;
    if (!cur.email) cur.email = e.user_email;
    enrollmentsByUser.set(e.user_id, cur);
  }
  const multiCourseStudents = Array.from(enrollmentsByUser.entries()).filter(([_, m]) => m.count >= 2);
  const studentCoursesDistribution = (() => {
    const buckets: Record<string, number> = { "1 course": 0, "2 courses": 0, "3+ courses": 0 };
    enrollmentsByUser.forEach((m) => {
      if (m.count === 1) buckets["1 course"] += 1;
      else if (m.count === 2) buckets["2 courses"] += 1;
      else buckets["3+ courses"] += 1;
    });
    return Object.entries(buckets).map(([label, value]) => ({ label, value }));
  })();

  // ---- Monthly revenue trend (within range) ----
  const ordersByMonth = new Map<string, { count: number; revenue: number }>();
  for (const o of ordersInPeriod) {
    if (!o.created_at) continue;
    const m = monthKey(o.created_at);
    const cur = ordersByMonth.get(m) || { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += o.amount_cents || 0;
    ordersByMonth.set(m, cur);
  }
  const monthlyOrders = Array.from(ordersByMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  // ---- Coupons used in period ----
  const couponsUsedInPeriod = data.coupons
    .filter((c) => (c.quantity_used ?? 0) > 0)
    .sort((a, b) => (b.quantity_used ?? 0) - (a.quantity_used ?? 0))
    .slice(0, 10)
    .map((c) => ({
      label: c.code,
      value: c.quantity_used ?? 0,
      sublabel: c.percentage
        ? `${c.percentage}% off`
        : c.amount_cents
        ? `$${(c.amount_cents / 100).toFixed(0)} off`
        : undefined,
    }));

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Thinkific LMS
          </h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <span className="text-xs text-gray-400 dark:text-gray-500">{updatedAt} PT</span>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          zuniversity.zhealtheducation.com · {data.range.label.toLowerCase()}
        </p>
      </header>

      <div className="mb-10">
        <KPIGrid
          accent="green"
          kpis={[
            {
              label: "Revenue (period)",
              value: completedRevenue > 0 ? fmtMoney(completedRevenue) : "—",
              trend: { value: revTrend.value, positive: revTrend.positive },
              hint: `${completedOrdersInPeriod.length} completed orders`,
            },
            {
              label: "New enrollments",
              value: enrollmentsInPeriod.length,
              trend: { value: enrollTrend.value, positive: enrollTrend.positive },
              hint: `vs prior ${data.range.days}d`,
            },
            {
              label: "Avg order value",
              value: aov > 0 ? fmtMoney(aov) : "—",
              hint: "All orders mean",
            },
            {
              label: "Catalog",
              value: data.coursesTotal,
              hint: `${publishedCourses} published, ${draftCourses} draft`,
            },
          ]}
        />
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "reports", label: "Reports" },
          { id: "courses", label: "Courses", badge: data.coursesTotal },
          { id: "products", label: "Products", badge: data.products.length },
          { id: "orders", label: "Orders", badge: ordersInPeriod.length },
          { id: "students", label: "Students" },
          { id: "coupons", label: "Coupons", badge: data.coupons.length },
        ]}
      >
        <TabPanel id="overview">
          <Section title="Purchase + access flow" description="From browse to course access. Click to expand.">
            <MermaidDiagram chart={THINKIFIC_FLOW_DIAGRAM} caption="Browse → checkout → enrollment → completion" />
          </Section>

          <Section title="Top courses by enrollment" description={`The 10 most-enrolled out of ${data.coursesTotal}.`}>
            <Card>
              <BarList
                color="green"
                items={topCoursesByEnrollment.map((c) => ({
                  label: c.name,
                  value: enrollCount(c.id),
                  sublabel: productStatus(c.id) ? undefined : "no linked product",
                }))}
              />
            </Card>
          </Section>
        </TabPanel>

        <TabPanel id="reports">
          {/* Insights row */}
          <Section title="Findings" description={`Computed from ${data.range.label.toLowerCase()} of activity.`}>
            <InsightGrid>
              <Insight
                severity={revTrend.positive ? "good" : "warn"}
                title={`${revTrend.positive ? "Revenue up" : "Revenue down"} ${revTrend.value}% vs prior period`}
              >
                {fmtMoney(completedRevenue)} in this {data.range.days}-day window vs {fmtMoney(completedRevenuePrior)} in the prior {data.range.days} days. {completedOrdersInPeriod.length} completed orders.
              </Insight>
              <Insight
                severity={enrollTrend.positive ? "good" : "warn"}
                title={`${enrollmentsInPeriod.length} new enrollments`}
              >
                {enrollTrend.positive ? "Up" : "Down"} {enrollTrend.value}% vs prior {data.range.days} days ({enrollmentsInPrior.length} prior).
              </Insight>
              {dormantCourses.length > 0 && (
                <Insight severity="warn" title={`${dormantCourses.length} courses have zero enrollments`}>
                  These never got off the ground. Candidates for review, marketing push, or unpublishing. {Math.round((dormantCourses.length / data.courses.length) * 100)}% of catalog.
                </Insight>
              )}
              {stalledStudents.length > 0 && (
                <Insight severity="warn" title={`${stalledStudents.length} stalled students detected`}>
                  Enrolled more than 7 days ago with 0% progress. Re-engagement opportunity — drop them into a Keap nurture sequence.
                </Insight>
              )}
              {multiCourseStudents.length > 0 && (
                <Insight severity="good" title={`${multiCourseStudents.length} students bought multiple courses`}>
                  Cross-purchase rate: {Math.round((multiCourseStudents.length / Math.max(1, enrollmentsByUser.size)) * 100)}% of students. These are your power users — prime upsell + testimonial targets.
                </Insight>
              )}
              {topRevenueProducts.length > 0 && (
                <Insight severity="info" title={`Top earner: ${topRevenueProducts[0].name}`}>
                  {fmtMoney(topRevenueProducts[0].revenue)} from {topRevenueProducts[0].orders} orders this period — {Math.round((topRevenueProducts[0].revenue / Math.max(1, grossRevenue)) * 100)}% of gross.
                </Insight>
              )}
            </InsightGrid>
          </Section>

          <Section title="Revenue summary">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card>
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Gross volume
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-gray-900 dark:text-gray-50">
                  {fmtMoney(grossRevenue)}
                </div>
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">
                  {ordersInPeriod.length.toLocaleString()} orders (all statuses)
                </div>
              </Card>
              <Card>
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Completed revenue
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
                  {fmtMoney(completedRevenue)}
                </div>
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">
                  {completedOrdersInPeriod.length.toLocaleString()} successful orders
                </div>
              </Card>
              <Card>
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Avg order value
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-gray-900 dark:text-gray-50">
                  {aov > 0 ? fmtMoney(aov) : "—"}
                </div>
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">
                  Across {ordersInPeriod.length.toLocaleString()} orders
                </div>
              </Card>
            </div>
          </Section>

          {monthlyOrders.length > 0 && (
            <Section title="Revenue by month" description="Trend within current range.">
              <Card>
                <BarList
                  color="green"
                  items={monthlyOrders.map(([m, v]) => ({
                    label: m,
                    value: v.revenue,
                    sublabel: `${v.count} orders`,
                  }))}
                  formatValue={(n) => fmtMoney(n)}
                />
              </Card>
            </Section>
          )}

          {topRevenueProducts.length > 0 && (
            <Section title="Top revenue products in period" description="Products generating the most revenue.">
              <Card>
                <BarList
                  color="green"
                  items={topRevenueProducts.map((p) => ({
                    label: p.name,
                    value: p.revenue,
                    sublabel: `${p.orders} orders`,
                  }))}
                  formatValue={(n) => fmtMoney(n)}
                />
              </Card>
            </Section>
          )}

          <Section title="Top courses by enrollment">
            <Card>
              <BarList
                color="blue"
                items={topCoursesByEnrollment.map((c) => ({
                  label: c.name,
                  value: enrollCount(c.id),
                  sublabel: productPrice(c.id) ? `$${productPrice(c.id)}` : undefined,
                }))}
              />
            </Card>
          </Section>

          {courseCompletionRates.length > 0 && (
            <Section
              title="Course completion rate"
              description={`Sample-based. Showing courses with 3+ enrollments in the data window.`}
            >
              <Card>
                <BarList
                  color="purple"
                  items={courseCompletionRates}
                  formatValue={(n) => `${n}%`}
                />
              </Card>
            </Section>
          )}

          <Section title="Student-cohort distribution" description="Number of distinct courses per student in window.">
            <Card>
              <BarList color="amber" items={studentCoursesDistribution} formatValue={(n) => `${n} students`} />
            </Card>
          </Section>

          {couponsUsedInPeriod.length > 0 && (
            <Section title="Most-used coupons">
              <Card>
                <BarList color="amber" items={couponsUsedInPeriod} />
              </Card>
            </Section>
          )}

          {dormantCourses.length > 0 && (
            <Section title="Dormant courses" description="Zero lifetime enrollments — review or archive.">
              <Card>
                <ul className="space-y-1 text-sm">
                  {dormantCourses.slice(0, 12).map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                      <span className="truncate">{c.name}</span>
                      <span className="ml-3 flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        {productStatus(c.id) || "no product"}
                      </span>
                    </li>
                  ))}
                  {dormantCourses.length > 12 && (
                    <li className="pt-2 text-xs text-gray-500 dark:text-gray-500">
                      …and {dormantCourses.length - 12} more
                    </li>
                  )}
                </ul>
              </Card>
            </Section>
          )}
        </TabPanel>

        <TabPanel id="courses">
          <Section title="Course catalog" description={`Showing ${data.courses.length} of ${data.coursesTotal}. Status and price are derived from the linked Thinkific product.`}>
            <Card padded={false}>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200/70 dark:border-white/5">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-3">ID</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Enrollments</th>
                    <th className="px-5 py-3">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {[...data.courses]
                    .sort((a, b) => enrollCount(b.id) - enrollCount(a.id))
                    .map((c) => {
                      const status = productStatus(c.id);
                      const price = productPrice(c.id);
                      return (
                      <tr key={c.id} className="text-gray-700 dark:text-gray-300">
                        <td className="px-5 py-3 font-mono text-xs text-gray-500">{c.id}</td>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
                        <td className="px-5 py-3 text-xs">
                          {status ? (
                            <span
                              className={
                                status === "published"
                                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-white/5 dark:text-gray-300"
                              }
                            >
                              {status}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-600">no product</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs tabular-nums">{enrollCount(c.id).toLocaleString()}</td>
                        <td className="px-5 py-3 text-xs tabular-nums">{price ? `$${price}` : "—"}</td>
                      </tr>
                      );
                    })}
                </tbody>
              </table>
            </Card>
          </Section>
        </TabPanel>

        <TabPanel id="products">
          <Section title="Products" description={`${data.products.length} total.`}>
            <Card padded={false}>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200/70 dark:border-white/5">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-3">ID</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Price</th>
                    <th className="px-5 py-3">Linked courses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {data.products.map((p) => (
                    <tr key={p.id} className="text-gray-700 dark:text-gray-300">
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{p.id}</td>
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{p.name}</td>
                      <td className="px-5 py-3 text-xs">{p.status}</td>
                      <td className="px-5 py-3 text-xs tabular-nums">{p.price}</td>
                      <td className="px-5 py-3 text-xs tabular-nums">{p.related_course_ids?.length ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>
        </TabPanel>

        <TabPanel id="orders">
          <Section
            title="Orders in period"
            description={`${ordersInPeriod.length} orders within ${data.range.label.toLowerCase()}.`}
          >
            <Card padded={false}>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200/70 dark:border-white/5">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {[...ordersInPeriod]
                    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
                    .slice(0, 100)
                    .map((o) => (
                      <tr key={o.id} className="text-gray-700 dark:text-gray-300">
                        <td className="px-5 py-3 text-xs">
                          {o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs">{o.user_email || o.user_name || "—"}</td>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {o.product_name || `#${o.product_id}`}
                        </td>
                        <td className="px-5 py-3 text-xs tabular-nums">{fmtMoney(o.amount_cents || 0)}</td>
                        <td className="px-5 py-3 text-xs">{o.status}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Card>
          </Section>
        </TabPanel>

        <TabPanel id="students">
          <Section
            title="Recent enrollments"
            description={`Latest ${Math.min(50, data.recentEnrollments.length)} students.`}
          >
            <Card padded={false}>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200/70 dark:border-white/5">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Student</th>
                    <th className="px-5 py-3">Course</th>
                    <th className="px-5 py-3">Progress</th>
                    <th className="px-5 py-3">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {[...data.recentEnrollments]
                    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
                    .slice(0, 50)
                    .map((e) => (
                      <tr key={e.id} className="text-gray-700 dark:text-gray-300">
                        <td className="px-5 py-3 text-xs">
                          {e.created_at ? new Date(e.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs">{e.user_email || e.user_name || "—"}</td>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {e.course_name || `#${e.course_id}`}
                        </td>
                        <td className="px-5 py-3 text-xs tabular-nums">
                          {e.percentage_completed != null
                            ? `${Math.round(e.percentage_completed * 100)}%`
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs">{e.completed_at ? "✓" : "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Card>
          </Section>

          {stalledStudents.length > 0 && (
            <Section
              title="Stalled students"
              description={`Enrolled 7+ days ago with 0% progress. ${stalledStudents.length} found.`}
            >
              <Card padded={false}>
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200/70 dark:border-white/5">
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <th className="px-5 py-3">Enrolled</th>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Course</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {stalledStudents.slice(0, 30).map((e) => (
                      <tr key={e.id} className="text-gray-700 dark:text-gray-300">
                        <td className="px-5 py-3 text-xs">
                          {e.created_at ? new Date(e.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs">{e.user_email || e.user_name || "—"}</td>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {e.course_name || `#${e.course_id}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </Section>
          )}
        </TabPanel>

        <TabPanel id="coupons">
          <Section title="Coupons" description={`${data.coupons.length} total. Sorted by usage.`}>
            <Card padded={false}>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200/70 dark:border-white/5">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Discount</th>
                    <th className="px-5 py-3">Used / Cap</th>
                    <th className="px-5 py-3">Expires</th>
                    <th className="px-5 py-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {[...data.coupons]
                    .sort((a, b) => (b.quantity_used ?? 0) - (a.quantity_used ?? 0))
                    .slice(0, 50)
                    .map((c) => (
                      <tr key={c.id} className="text-gray-700 dark:text-gray-300">
                        <td className="px-5 py-3 font-mono text-xs text-gray-900 dark:text-gray-100">{c.code}</td>
                        <td className="px-5 py-3 text-xs">
                          {c.percentage
                            ? `${c.percentage}% off`
                            : c.amount_cents
                            ? `$${(c.amount_cents / 100).toFixed(2)} off`
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs tabular-nums">
                          {c.quantity_used ?? 0}
                          {c.quantity ? ` / ${c.quantity}` : ""}
                        </td>
                        <td className="px-5 py-3 text-xs">
                          {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500">{c.note || ""}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Card>
          </Section>
        </TabPanel>
      </Tabs>
    </main>
  );
}
