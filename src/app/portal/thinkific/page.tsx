import KPIGrid from "@/components/portal/KPIGrid";
import MermaidDiagram from "@/components/MermaidDiagram";
import { listCourses, listOrders, listProducts, getLMSOverview } from "@/lib/thinkific";

export const dynamic = "force-dynamic";

const THINKIFIC_FLOW_DIAGRAM = `
flowchart LR
  Visit["Visitor on<br/>zuniversity"] --> Browse["Browses courses<br/>(82 available)"]
  Browse --> Pick["Picks a course<br/>or bundle"]
  Pick --> Cart["Thinkific checkout"]
  Cart --> Pay["Payment processed"]
  Pay --> Order["Order created"]
  Order --> Enroll["Enrollment created"]
  Enroll --> Access["Course access granted"]
  Access --> Progress["Progress tracked<br/>per lesson"]
  Progress --> Done["Course completed"]
  Done --> Cert["Certificate issued"]

  classDef sys fill:#dcfce7,stroke:#15803d,color:#052e16
  class Cart,Pay,Order,Enroll,Access sys
`;

async function loadThinkificData() {
  try {
    const [overview, courses, orders, products] = await Promise.all([
      getLMSOverview().catch(() => null),
      listCourses({ limit: 50 }),
      listOrders({ limit: 1 }).catch(() => ({ items: [], meta: { pagination: { total_items: 0 } } })),
      listProducts({ limit: 10 }).catch(() => ({ items: [] })),
    ]);
    return {
      ok: true as const,
      overview,
      courses: courses.items,
      coursesTotal: courses.meta.pagination.total_items,
      ordersTotal: orders.meta.pagination.total_items,
      products: products.items,
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
      <main className="mx-auto max-w-6xl px-8 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Thinkific LMS
        </h1>
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-sm dark:border-red-900 dark:bg-red-950/30">
          <div className="font-medium text-red-900 dark:text-red-200">
            Could not load Thinkific data
          </div>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-red-800 dark:text-red-300">
            {data.error}
          </pre>
          <p className="mt-3 text-xs text-red-700 dark:text-red-400">
            Check that <code>THINKIFIC_API_TOKEN</code> is set in <code>.env.local</code> and the
            dev server has been restarted since adding it.
          </p>
        </div>
      </main>
    );
  }

  const updatedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="mx-auto max-w-6xl px-8 py-10">
      <header className="mb-8">
        <div className="flex items-baseline justify-between">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Thinkific LMS
          </h1>
          <span className="text-xs text-gray-400 dark:text-gray-500">Updated {updatedAt} PT</span>
        </div>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
          zuniversity.zhealtheducation.com — sole ecommerce + course delivery platform.
        </p>
      </header>

      <section className="mb-10">
        <KPIGrid
          kpis={[
            { label: "Courses", value: data.coursesTotal, hint: "Published + draft" },
            { label: "Students", value: data.overview?.total_students ?? "—" },
            { label: "Enrollments", value: data.overview?.total_enrollments ?? "—", hint: "Lifetime" },
            { label: "Orders", value: data.overview?.total_orders ?? data.ordersTotal },
          ]}
        />
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Purchase + access flow
        </h2>
        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
          The path every paying customer takes from browse to course access.
        </p>
        <MermaidDiagram chart={THINKIFIC_FLOW_DIAGRAM} caption="Browse → checkout → enrollment → completion" />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Course catalog <span className="text-sm font-normal text-gray-500">(showing {data.courses.length} of {data.coursesTotal})</span>
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[#1c1c1e]">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Students</th>
                <th className="px-4 py-2 font-medium">Chapters</th>
                <th className="px-4 py-2 font-medium">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-[#202022]">
              {data.courses.map((c) => (
                <tr key={c.id} className="text-gray-700 dark:text-gray-300">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{c.id}</td>
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
                  <td className="px-4 py-2 text-xs">
                    <span
                      className={
                        c.status === "published"
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : "rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      }
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">{c.user_count?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{c.chapter_count ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{c.price || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.products.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
            Products <span className="text-sm font-normal text-gray-500">(top {data.products.length})</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#1c1c1e]">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-2 font-medium">ID</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Price</th>
                  <th className="px-4 py-2 font-medium">Linked courses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-[#202022]">
                {data.products.map((p) => (
                  <tr key={p.id} className="text-gray-700 dark:text-gray-300">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{p.id}</td>
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{p.name}</td>
                    <td className="px-4 py-2 text-xs">{p.status}</td>
                    <td className="px-4 py-2 text-xs">{p.price}</td>
                    <td className="px-4 py-2 text-xs">{p.related_course_ids?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm dark:border-gray-700 dark:bg-[#1f1f21]">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Coming next</h3>
        <ul className="ml-5 mt-2 list-disc space-y-1 text-gray-600 dark:text-gray-400">
          <li>Per-course completion funnel (chapter-by-chapter drop-off)</li>
          <li>Recent enrollments stream (last 100, with email + course)</li>
          <li>Revenue rollup (orders × price, by month and by course)</li>
          <li>Coupon performance (uses, conversion, attached products)</li>
          <li>Stalled-learner detection (enrolled, no progress in 30+ days)</li>
          <li>Cross-system: which Keap tag did each enrolled student come from?</li>
        </ul>
      </section>
    </main>
  );
}
