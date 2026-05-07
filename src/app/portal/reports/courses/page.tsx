/**
 * Courses report — per-course attribution.
 *
 * For each Thinkific course:
 *   - Total enrollments (Thinkific API)
 *   - Orders + revenue in window (Thinkific API)
 *   - course_view + begin_checkout + purchase events (GA4)
 *   - Source breakdown via sessionCampaignName / sessionSource on purchase events
 */
import Section, { Card } from "@/components/portal/Section";
import DateRangePicker from "@/components/portal/DateRangePicker";
import ExportButton from "@/components/portal/ExportButton";
import KPIGrid from "@/components/portal/KPIGrid";
import BarList from "@/components/portal/BarList";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import { parseTimeRange } from "@/lib/time-range";
import { getServerSession } from "@/lib/auth";
import { cachedFetch, TTL, rangeCacheSegment } from "@/lib/cache";
import {
  getEventCounts,
  getEcommerce,
} from "@/lib/google-analytics";
import {
  listCourses,
  listOrders,
  listProducts,
  listEnrollments,
} from "@/lib/thinkific";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

async function loadCourses(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;
  const rangeSeg = rangeCacheSegment(range);

  const session = (await getServerSession()) as any;
  const accessToken = session?.accessToken;

  const [coursesRes, ordersRes, productsRes, enrollmentsRes, courseViews, beginCheckouts, purchasesByCampaign, purchasesBySource] = await Promise.all([
    cachedFetch("thinkific:courses:250", TTL.THINKIFIC_COURSES, () =>
      listCourses({ limit: 250 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } }))
    ),
    cachedFetch("thinkific:orders:250", TTL.THINKIFIC_ORDERS, () =>
      listOrders({ limit: 250 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } }))
    ),
    cachedFetch("thinkific:products:250", TTL.THINKIFIC_PRODUCTS, () =>
      listProducts({ limit: 250 }).catch(() => ({ items: [] }))
    ),
    cachedFetch("thinkific:enrollments:250", TTL.THINKIFIC_ENROLLMENTS, () =>
      listEnrollments({ limit: 250 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } }))
    ),
    accessToken
      ? cachedFetch(`ga4:event:course_view:bypath:${rangeKey}`, TTL.GA4_REPORTS, () =>
          // Use pagePath instead of customEvent:course_slug — pagePath works
          // out-of-the-box in GA4 without needing a custom dimension registered.
          getEventCounts(accessToken, "lms", rangeKey, "course_view", ["pagePath"], 200).catch(() => [])
        )
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:event:begin_checkout:bypath:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEventCounts(accessToken, "lms", rangeKey, "begin_checkout", ["pagePath"], 200).catch(() => [])
        )
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:ecom:campaign:lms:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEcommerce(accessToken, "lms", rangeKey, "sessionCampaignName", 100).catch(() => [])
        )
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:ecom:source:lms:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEcommerce(accessToken, "lms", rangeKey, "sessionSource", 100).catch(() => [])
        )
      : Promise.resolve([] as any[]),
  ]);

  const fromMs = range.from.getTime();
  const toMs = range.to.getTime();

  // Map products → courses for price lookup
  const productByCourseId = new Map<number, any>();
  for (const p of productsRes.items || []) {
    const courseIds: number[] | undefined = (p as any).related_course_ids || (p as any).course_ids;
    if (courseIds) {
      for (const cid of courseIds) productByCourseId.set(cid, p);
    }
  }

  // Index event counts by course slug, derived from pagePath
  // GA4 reports paths like "/courses/<slug>" or "/courses/<slug>/lessons/..."
  // We extract the slug from the first /courses/<X>/ segment.
  function slugFromPath(p: string): string | null {
    const m = (p || "").match(/^\/courses\/([^/?#]+)/i);
    return m ? m[1].toLowerCase() : null;
  }
  const viewsBySlug = new Map<string, number>();
  for (const r of courseViews) {
    const slug = slugFromPath(r.dims?.pagePath || "");
    if (slug) viewsBySlug.set(slug, (viewsBySlug.get(slug) ?? 0) + r.eventCount);
  }
  const checkoutsBySlug = new Map<string, number>();
  for (const r of beginCheckouts) {
    const slug = slugFromPath(r.dims?.pagePath || "");
    if (slug) checkoutsBySlug.set(slug, (checkoutsBySlug.get(slug) ?? 0) + r.eventCount);
  }

  // Orders in window — group by linked course (via product_id → course)
  const ordersInWindow = (ordersRes.items || []).filter((o: any) => {
    if (!o.created_at) return false;
    const t = new Date(o.created_at).getTime();
    return t >= fromMs && t <= toMs;
  });
  // Build product_id → course_id reverse map from productByCourseId
  const courseIdByProductId = new Map<number, number>();
  productByCourseId.forEach((product, courseId) => {
    if (product?.id) courseIdByProductId.set(product.id, courseId);
  });
  const ordersByCourseId = new Map<number, { count: number; revenue: number }>();
  for (const o of ordersInWindow) {
    const cid = courseIdByProductId.get(o.product_id);
    if (!cid) continue;
    const cur = ordersByCourseId.get(cid) || { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += (o.amount_cents ?? 0) / 100;
    ordersByCourseId.set(cid, cur);
  }

  // Enrollments in window — group by course
  const enrollmentsByCourseId = new Map<number, number>();
  for (const e of enrollmentsRes.items || []) {
    if (!e.created_at) continue;
    const t = new Date(e.created_at).getTime();
    if (t >= fromMs && t <= toMs) {
      enrollmentsByCourseId.set(e.course_id, (enrollmentsByCourseId.get(e.course_id) ?? 0) + 1);
    }
  }

  // Build per-course rollup
  const courses = (coursesRes.items || []).map((c: any) => {
    const p = productByCourseId.get(c.id);
    const orders = ordersByCourseId.get(c.id) || { count: 0, revenue: 0 };
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: p?.hidden ? "hidden" : (p ? "published" : "no product"),
      price: p?.price ? parseFloat(p.price) : 0,
      enrollmentsAll: c.user_count ?? 0,
      enrollmentsInWindow: enrollmentsByCourseId.get(c.id) ?? 0,
      ordersInWindow: orders.count,
      revenueInWindow: orders.revenue,
      courseViews: viewsBySlug.get((c.slug || "").toLowerCase()) ?? 0,
      checkouts: checkoutsBySlug.get((c.slug || "").toLowerCase()) ?? 0,
    };
  });

  // Sort: window-revenue desc, then enrollments-in-window
  courses.sort((a, b) => b.revenueInWindow - a.revenueInWindow || b.enrollmentsInWindow - a.enrollmentsInWindow);

  const totals = {
    courses: courses.length,
    enrollmentsInWindow: courses.reduce((s, c) => s + c.enrollmentsInWindow, 0),
    ordersInWindow: courses.reduce((s, c) => s + c.ordersInWindow, 0),
    revenueInWindow: courses.reduce((s, c) => s + c.revenueInWindow, 0),
    courseViews: courses.reduce((s, c) => s + c.courseViews, 0),
    checkouts: courses.reduce((s, c) => s + c.checkouts, 0),
  };

  return {
    range,
    accessToken: !!accessToken,
    courses,
    totals,
    purchasesByCampaign: purchasesByCampaign.filter((p: any) => p.purchases > 0).slice(0, 12),
    purchasesBySource: purchasesBySource.filter((p: any) => p.purchases > 0).slice(0, 12),
  };
}

export const metadata = { title: "Courses — Z-Health Portal" };

export default async function CoursesReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await loadCourses(searchParams);

  const insights: Array<{ severity: "good" | "warn" | "alert" | "info"; title: string; body: string }> = [];
  const topRev = data.courses.find((c) => c.revenueInWindow > 0);
  if (topRev) {
    insights.push({
      severity: "good",
      title: `Top revenue course: ${topRev.name}`,
      body: `${fmtMoney(topRev.revenueInWindow)} from ${topRev.ordersInWindow} order${topRev.ordersInWindow === 1 ? "" : "s"}, ${topRev.enrollmentsInWindow} new enrollment${topRev.enrollmentsInWindow === 1 ? "" : "s"} in ${data.range.label.toLowerCase()}.`,
    });
  }
  const noBuyers = data.courses.filter((c) => c.courseViews > 50 && c.ordersInWindow === 0);
  if (noBuyers.length > 0) {
    const top = noBuyers.sort((a, b) => b.courseViews - a.courseViews)[0];
    insights.push({
      severity: "warn",
      title: `${noBuyers.length} courses with views but no buyers in window`,
      body: `Biggest: ${top.name} — ${top.courseViews.toLocaleString()} course-page views, 0 purchases. Worth checking pricing, sales-page copy, or checkout friction.`,
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Courses</h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <ExportButton targetId="report-content" filename="courses-report" label="Export all" />
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
          Per-course performance for {data.range.label.toLowerCase()}: views → checkout → purchase, joined to Thinkific orders + enrollments.
        </p>
      </header>

      <div id="report-content" className="bg-white dark:bg-[#1c1c1e]">

      <div className="mb-10">
        <KPIGrid
          accent="purple"
          kpis={[
            { label: "Courses", value: data.totals.courses.toLocaleString() },
            { label: "Enrollments", value: data.totals.enrollmentsInWindow.toLocaleString(), hint: "in window" },
            { label: "Orders", value: data.totals.ordersInWindow.toLocaleString() },
            { label: "Revenue", value: data.totals.revenueInWindow > 0 ? fmtMoney(data.totals.revenueInWindow) : "—" },
          ]}
        />
      </div>

      {insights.length > 0 && (
        <Section
          id="section-insights"
          title="What stands out"
          description="Computed from current data."
          action={<ExportButton targetId="section-insights" filename="courses-insights" />}
        >
          <InsightGrid>
            {insights.map((i, idx) => (
              <Insight key={idx} severity={i.severity} title={i.title}>{i.body}</Insight>
            ))}
          </InsightGrid>
        </Section>
      )}

      <Section
        id="section-per-course"
        title="Per-course rollup"
        description="Sorted by revenue in window."
        action={<ExportButton targetId="section-per-course" filename="courses-rollup" />}
      >
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="px-5 py-3">Course</th>
                  <th className="px-5 py-3 text-right">Price</th>
                  <th className="px-5 py-3 text-right">Views</th>
                  <th className="px-5 py-3 text-right">Checkouts</th>
                  <th className="px-5 py-3 text-right">Orders</th>
                  <th className="px-5 py-3 text-right">Enrolls</th>
                  <th className="px-5 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {data.courses.map((c) => (
                  <tr key={c.id} className="text-gray-700 dark:text-gray-300">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{c.name}</div>
                      <div className="text-xs text-gray-500">
                        <span className="font-mono">{c.slug}</span>
                        <span className="mx-1.5">·</span>
                        <span>{c.status}</span>
                        <span className="mx-1.5">·</span>
                        <span>{c.enrollmentsAll.toLocaleString()} all-time enrolls</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.price > 0 ? fmtMoney(c.price) : <span className="text-gray-400">—</span>}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.courseViews.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.checkouts.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.ordersInWindow.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.enrollmentsInWindow.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold">{c.revenueInWindow > 0 ? fmtMoney(c.revenueInWindow) : <span className="text-gray-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          id="section-by-campaign"
          title="Revenue by UTM campaign"
          description="Which campaign attribute led to purchases?"
          action={<ExportButton targetId="section-by-campaign" filename="courses-by-campaign" />}
        >
          <Card>
            {data.purchasesByCampaign.length === 0 ? (
              <p className="text-sm text-gray-500">No campaign-attributed purchases in this window.</p>
            ) : (
              <BarList
                color="purple"
                items={data.purchasesByCampaign.map((p: any) => ({
                  label: p.dim,
                  value: p.purchases,
                  sublabel: fmtMoney(p.revenue),
                }))}
                formatValue={(n) => `${n} purchases`}
              />
            )}
          </Card>
        </Section>

        <Section
          id="section-by-source"
          title="Revenue by source"
          description="Where the buyer originally came from."
          action={<ExportButton targetId="section-by-source" filename="courses-by-source" />}
        >
          <Card>
            {data.purchasesBySource.length === 0 ? (
              <p className="text-sm text-gray-500">No source-attributed purchases in this window.</p>
            ) : (
              <BarList
                color="blue"
                items={data.purchasesBySource.map((p: any) => ({
                  label: p.dim,
                  value: p.purchases,
                  sublabel: fmtMoney(p.revenue),
                }))}
                formatValue={(n) => `${n} purchases`}
              />
            )}
          </Card>
        </Section>
      </div>

      </div>
    </main>
  );
}
