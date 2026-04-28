import StatusCard from "@/components/portal/StatusCard";
import { listContacts, listTags, listCampaigns } from "@/lib/keap";
import { getLMSOverview, listCourses } from "@/lib/thinkific";

export const dynamic = "force-dynamic";

async function getKeapStatus() {
  try {
    const [contacts, tags, campaigns] = await Promise.all([
      listContacts({ limit: 1 }),
      listTags({ limit: 1 }),
      listCampaigns({ limit: 1 }),
    ]);
    return {
      ok: true as const,
      stats: [
        { label: "Contacts", value: contacts.count },
        { label: "Tags", value: tags.count },
        { label: "Campaigns", value: campaigns.count },
      ],
    };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

async function getThinkificStatus() {
  try {
    const [overview, courses] = await Promise.all([
      getLMSOverview().catch(() => null),
      listCourses({ limit: 1 }),
    ]);
    return {
      ok: true as const,
      stats: [
        { label: "Courses", value: courses.meta.pagination.total_items },
        { label: "Students", value: overview?.total_students ?? "—" },
        { label: "Enrollments", value: overview?.total_enrollments ?? "—" },
      ],
    };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

async function getWPStatus() {
  try {
    const url = process.env.WP_SITE_URL;
    const username = process.env.WP_USERNAME;
    const password = process.env.WP_APP_PASSWORD;
    if (!url || !username || !password) {
      return { ok: false as const, error: "WP credentials missing" };
    }
    const auth = Buffer.from(`${username}:${password}`).toString("base64");
    const [postsResp, pagesResp] = await Promise.all([
      fetch(`${url}/wp-json/wp/v2/posts?per_page=1`, {
        headers: { Authorization: `Basic ${auth}` },
        next: { revalidate: 0 },
      }),
      fetch(`${url}/wp-json/wp/v2/pages?per_page=1`, {
        headers: { Authorization: `Basic ${auth}` },
        next: { revalidate: 0 },
      }),
    ]);
    const postsTotal = parseInt(postsResp.headers.get("x-wp-total") || "0", 10);
    const pagesTotal = parseInt(pagesResp.headers.get("x-wp-total") || "0", 10);
    return {
      ok: true as const,
      stats: [
        { label: "Posts", value: postsTotal },
        { label: "Pages", value: pagesTotal },
      ],
    };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export const metadata = {
  title: "Portal Overview — Z-Health",
};

export default async function PortalOverviewPage() {
  const [keap, thinkific, wp] = await Promise.all([
    getKeapStatus(),
    getThinkificStatus(),
    getWPStatus(),
  ]);

  const updatedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-12">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Z-Health Portal
          </h1>
          <span className="text-xs text-gray-400 dark:text-gray-500">Updated {updatedAt} PT</span>
        </div>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-600 dark:text-gray-400">
          Live status of every system in the Z-Health stack. Click any card to drill into
          inventories, flows, and reports.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Connected systems
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <StatusCard
            title="Keap CRM"
            href="/portal/keap"
            status={keap.ok ? "ok" : "error"}
            description="Contacts, tags, campaigns, lifecycle automation"
            stats={keap.ok ? keap.stats : []}
            errorMessage={!keap.ok ? keap.error : undefined}
          />
          <StatusCard
            title="Thinkific LMS"
            href="/portal/thinkific"
            status={thinkific.ok ? "ok" : "error"}
            description="Courses, students, enrollments, completions"
            stats={thinkific.ok ? thinkific.stats : []}
            errorMessage={!thinkific.ok ? thinkific.error : undefined}
          />
          <StatusCard
            title="WordPress site"
            href="/portal/wp"
            status="soon"
            description="zhealtheducation.com — content, lead gen, trainer pages"
            stats={wp.ok ? wp.stats : []}
            errorMessage={!wp.ok ? wp.error : undefined}
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Cross-system
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatusCard
            title="Customer Flows"
            href="/portal/customer-flows"
            status="warn"
            description="Audit of lead-gen, purchase, and lifecycle flows across all systems"
            stats={[{ label: "Status", value: "Scaffold" }, { label: "Pass", value: "0 of 1" }]}
          />
          <StatusCard
            title="Analytics"
            href="/portal/analytics"
            status="soon"
            description="Cross-system reporting engine — funnels, cohorts, LTV"
          />
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm dark:border-gray-700 dark:bg-[#1f1f21]">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">About this portal</h3>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          This is the internal Z-Health team portal. Each card above pulls live data from the
          underlying system on every page load. Drill in to see inventories, flows, and computed
          insights. Access is restricted to <code>@zhealth.net</code> Google accounts.
        </p>
      </section>
    </main>
  );
}
