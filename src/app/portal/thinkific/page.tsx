import KPIGrid from "@/components/portal/KPIGrid";
import MermaidDiagram from "@/components/MermaidDiagram";
import Tabs, { TabPanel } from "@/components/portal/Tabs";
import Section, { Card } from "@/components/portal/Section";
import BarList from "@/components/portal/BarList";
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
  Visit["Visitor on<br/>zuniversity"]:::appleBlue --> Browse["Browses courses<br/>(82 available)"]:::appleBlue
  Browse --> Pick["Picks a course<br/>or bundle"]:::appleAmber
  Pick --> Cart["Thinkific checkout"]:::appleGreen
  Cart --> Pay["Payment processed"]:::appleGreen
  Pay --> Order["Order created"]:::appleGreen
  Order --> Enroll["Enrollment created"]:::appleGreen
  Enroll --> Access["Course access granted"]:::appleGreen
  Access --> Progress["Progress tracked<br/>per lesson"]:::applePurple
  Progress --> Done["Course completed"]:::applePurple
  Done --> Cert["Certificate issued"]:::applePurple
  classDef appleBlue fill:#eff6ff,stroke:#3b82f6,color:#1e40af,stroke-width:1.5px
  classDef appleGreen fill:#ecfdf5,stroke:#10b981,color:#065f46,stroke-width:1.5px
  classDef appleAmber fill:#fffbeb,stroke:#f59e0b,color:#92400e,stroke-width:1.5px
  classDef applePurple fill:#f5f3ff,stroke:#8b5cf6,color:#5b21b6,stroke-width:1.5px
`;

function centsToDollars(c: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
}

async function loadThinkificData() {
  try {
    const [overview, allCourses, allOrders, products, recentEnrollments, coupons] =
      await Promise.all([
        getLMSOverview().catch(() => null),
        listCourses({ limit: 250 }),
        listOrders({ limit: 250 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } })),
        listProducts({ limit: 100 }).catch(() => ({ items: [] })),
        listEnrollments({ limit: 50 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } })),
        listCoupons({ limit: 100 }).catch(() => ({ items: [] })),
      ]);

    return {
      ok: true as const,
      overview,
      courses: allCourses.items,
      coursesTotal: allCourses.meta.pagination.total_items,
      ordersTotal: allOrders.meta.pagination.total_items,
      orders: allOrders.items,
      products: products.items,
      recentEnrollments: recentEnrollments.items,
      enrollmentsTotal: recentEnrollments.meta.pagination.total_items,
      coupons: coupons.items,
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Unknown Thinkific error",
    };
  }
}

export const metadata = {
  title: "Thinkific LMS — Z-Health Portal",
};

export default async function ThinkificPortalPage() {
  const data = await loadThinkificData();

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

  // Computed insights
  const publishedCourses = data.courses.filter((c) => c.status === "published").length;
  const draftCourses = data.courses.filter((c) => c.status !== "published").length;

  const topCoursesByEnrollment = [...data.courses]
    .sort((a, b) => (b.user_count ?? 0) - (a.user_count ?? 0))
    .slice(0, 10);

  const dormantCourses = data.courses.filter((c) => (c.user_count ?? 0) === 0);

  const totalRevenueCents = data.orders.reduce((sum, o) => sum + (o.amount_cents || 0), 0);
  const completedOrders = data.orders.filter((o) => o.status === "successful" || o.status === "completed");
  const completedRevenueCents = completedOrders.reduce((sum, o) => sum + (o.amount_cents || 0), 0);

  const ordersByMonth = new Map<string, { count: number; revenue: number }>();
  for (const o of data.orders) {
    if (!o.created_at) continue;
    const month = o.created_at.slice(0, 7); // "YYYY-MM"
    const cur = ordersByMonth.get(month) || { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += o.amount_cents || 0;
    ordersByMonth.set(month, cur);
  }
  const monthlyOrders = Array.from(ordersByMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12);

  const productPopularity = data.products.map((p) => ({
    label: p.name,
    value: p.related_course_ids?.length || 0,
    sublabel: `$${p.price}`,
  }));

  const couponUsage = data.coupons
    .filter((c) => (c.quantity_used ?? 0) > 0)
    .sort((a, b) => (b.quantity_used ?? 0) - (a.quantity_used ?? 0))
    .slice(0, 10)
    .map((c) => ({
      label: c.code,
      value: c.quantity_used ?? 0,
      sublabel: c.percentage ? `${c.percentage}% off` : c.amount_cents ? `$${(c.amount_cents / 100).toFixed(2)} off` : undefined,
    }));

  const recentEnrollmentsForView = [...data.recentEnrollments]
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 20);

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Thinkific LMS
          </h1>
          <span className="text-xs text-gray-400 dark:text-gray-500">Updated {updatedAt} PT</span>
        </div>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          zuniversity.zhealtheducation.com — sole ecommerce + course delivery platform.
        </p>
      </header>

      <div className="mb-10">
        <KPIGrid
          accent="green"
          kpis={[
            { label: "Courses", value: data.coursesTotal, hint: `${publishedCourses} published, ${draftCourses} draft` },
            { label: "Students", value: data.overview?.total_students ?? "—" },
            { label: "Enrollments", value: data.overview?.total_enrollments ?? data.enrollmentsTotal, hint: "Lifetime" },
            { label: "Orders", value: data.overview?.total_orders ?? data.ordersTotal },
          ]}
        />
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "reports", label: "Reports" },
          { id: "courses", label: "Courses", badge: data.coursesTotal },
          { id: "products", label: "Products", badge: data.products.length },
          { id: "orders", label: "Orders", badge: data.ordersTotal },
          { id: "coupons", label: "Coupons", badge: data.coupons.length },
        ]}
      >
        <TabPanel id="overview">
          <Section title="Purchase + access flow" description="The path every paying customer takes from browse to course access.">
            <MermaidDiagram chart={THINKIFIC_FLOW_DIAGRAM} caption="Browse → checkout → enrollment → completion" />
          </Section>

          <Section title="Top courses by enrollment" description={`The 10 most-enrolled courses out of ${data.coursesTotal} total.`}>
            <Card>
              <BarList
                color="green"
                items={topCoursesByEnrollment.map((c) => ({
                  label: c.name,
                  value: c.user_count ?? 0,
                  sublabel: c.status === "published" ? undefined : "draft",
                }))}
              />
            </Card>
          </Section>

          {dormantCourses.length > 0 && (
            <Section title="Heads up" description="Courses with zero enrollments — candidates for review or unpublishing.">
              <Card>
                <ul className="space-y-1 text-sm">
                  {dormantCourses.slice(0, 8).map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                      <span className="truncate">{c.name}</span>
                      <span className="ml-3 flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        {c.status}
                      </span>
                    </li>
                  ))}
                  {dormantCourses.length > 8 && (
                    <li className="pt-2 text-xs text-gray-500 dark:text-gray-500">
                      …and {dormantCourses.length - 8} more
                    </li>
                  )}
                </ul>
              </Card>
            </Section>
          )}
        </TabPanel>

        <TabPanel id="reports">
          <Section title="Revenue (sample)" description={`Computed from the most recent ${data.orders.length} orders.`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card>
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Gross volume
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-gray-900 dark:text-gray-50">
                  {centsToDollars(totalRevenueCents)}
                </div>
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">
                  {data.orders.length.toLocaleString()} orders
                </div>
              </Card>
              <Card>
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Completed revenue
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
                  {centsToDollars(completedRevenueCents)}
                </div>
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">
                  {completedOrders.length.toLocaleString()} completed
                </div>
              </Card>
              <Card>
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Avg order value
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-gray-900 dark:text-gray-50">
                  {data.orders.length > 0 ? centsToDollars(totalRevenueCents / data.orders.length) : "—"}
                </div>
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">
                  All-orders mean
                </div>
              </Card>
            </div>
          </Section>

          {monthlyOrders.length > 0 && (
            <Section title="Orders by month" description={`Last ${monthlyOrders.length} months from sample.`}>
              <Card>
                <BarList
                  color="green"
                  items={monthlyOrders.map(([month, m]) => ({
                    label: month,
                    value: m.count,
                    sublabel: centsToDollars(m.revenue),
                  }))}
                  formatValue={(n) => `${n} orders`}
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
                  value: c.user_count ?? 0,
                  sublabel: c.chapter_count ? `${c.chapter_count} chapters` : undefined,
                }))}
              />
            </Card>
          </Section>

          {couponUsage.length > 0 && (
            <Section title="Most-used coupons" description="Coupons by redemption count.">
              <Card>
                <BarList color="amber" items={couponUsage} />
              </Card>
            </Section>
          )}

          {productPopularity.length > 0 && (
            <Section title="Products by linked courses" description="Products sorted by how many courses they bundle.">
              <Card>
                <BarList color="purple" items={productPopularity.slice(0, 10)} />
              </Card>
            </Section>
          )}
        </TabPanel>

        <TabPanel id="courses">
          <Section title="Course catalog" description={`Showing ${data.courses.length} of ${data.coursesTotal}.`}>
            <Card padded={false}>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200/70 dark:border-white/5">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-3">ID</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Students</th>
                    <th className="px-5 py-3">Chapters</th>
                    <th className="px-5 py-3">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {data.courses.map((c) => (
                    <tr key={c.id} className="text-gray-700 dark:text-gray-300">
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{c.id}</td>
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
                      <td className="px-5 py-3 text-xs">
                        <span
                          className={
                            c.status === "published"
                              ? "rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-white/5 dark:text-gray-300"
                          }
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs tabular-nums">{c.user_count?.toLocaleString() ?? "—"}</td>
                      <td className="px-5 py-3 text-xs tabular-nums">{c.chapter_count ?? "—"}</td>
                      <td className="px-5 py-3 text-xs tabular-nums">{c.price || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>
        </TabPanel>

        <TabPanel id="products">
          <Section title="Products" description={`Showing ${data.products.length} of ${data.products.length}.`}>
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
          <Section title="Recent orders" description={`Most recent ${Math.min(50, data.orders.length)} orders.`}>
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
                  {data.orders.slice(0, 50).map((o) => (
                    <tr key={o.id} className="text-gray-700 dark:text-gray-300">
                      <td className="px-5 py-3 text-xs">
                        {o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-3 text-xs">{o.user_email || o.user_name || "—"}</td>
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {o.product_name || `#${o.product_id}`}
                      </td>
                      <td className="px-5 py-3 text-xs tabular-nums">{centsToDollars(o.amount_cents || 0)}</td>
                      <td className="px-5 py-3 text-xs">{o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>

          {recentEnrollmentsForView.length > 0 && (
            <Section title="Recent enrollments" description={`Last ${recentEnrollmentsForView.length} students enrolled.`}>
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
                    {recentEnrollmentsForView.map((e) => (
                      <tr key={e.id} className="text-gray-700 dark:text-gray-300">
                        <td className="px-5 py-3 text-xs">
                          {e.created_at ? new Date(e.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs">{e.user_email || e.user_name || "—"}</td>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {e.course_name || `#${e.course_id}`}
                        </td>
                        <td className="px-5 py-3 text-xs tabular-nums">
                          {e.percentage_completed != null ? `${Math.round(e.percentage_completed * 100)}%` : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs">{e.completed_at ? "✓" : "—"}</td>
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
                          {c.percentage ? `${c.percentage}% off` : c.amount_cents ? `$${(c.amount_cents / 100).toFixed(2)} off` : "—"}
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
