import KPIGrid from "@/components/portal/KPIGrid";
import MermaidDiagram from "@/components/MermaidDiagram";
import { listContacts, listTags, listCampaigns, getAccountInfo } from "@/lib/keap";

export const dynamic = "force-dynamic";

const KEAP_FLOW_DIAGRAM = `
flowchart LR
  Lead["New lead<br/>(WP form, ad, etc.)"] --> Contact["Contact created<br/>in Keap"]
  Contact --> Tag["Tag applied<br/>(by source)"]
  Tag --> Campaign["Campaign / sequence<br/>triggered"]
  Campaign --> Email["Email sent"]
  Email --> Open["Opened?"]
  Open -- yes --> Engaged["Tag: engaged"]
  Open -- no --> Stale["Tag: stale<br/>after N days"]
  Engaged --> Buy["Buys course<br/>on Thinkific"]
  Buy --> Customer["Tag: customer<br/>+ post-purchase sequence"]

  classDef sys fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
  class Contact,Tag,Campaign,Email sys
`;

async function loadKeapData() {
  try {
    const [account, contacts, tags, campaigns, tagSample, campaignSample] = await Promise.all([
      getAccountInfo().catch(() => null),
      listContacts({ limit: 1 }),
      listTags({ limit: 1 }),
      listCampaigns({ limit: 1 }),
      listTags({ limit: 20 }),
      listCampaigns({ limit: 20 }),
    ]);
    return {
      ok: true as const,
      account,
      counts: {
        contacts: contacts.count,
        tags: tags.count,
        campaigns: campaigns.count,
      },
      tags: tagSample.tags,
      campaigns: campaignSample.campaigns ?? [],
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Unknown Keap error",
    };
  }
}

export const metadata = {
  title: "Keap CRM — Z-Health Portal",
};

export default async function KeapPortalPage() {
  const data = await loadKeapData();

  if (!data.ok) {
    return (
      <main className="mx-auto max-w-6xl px-8 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Keap CRM
        </h1>
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-sm dark:border-red-900 dark:bg-red-950/30">
          <div className="font-medium text-red-900 dark:text-red-200">
            Could not load Keap data
          </div>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-red-800 dark:text-red-300">
            {data.error}
          </pre>
          <p className="mt-3 text-xs text-red-700 dark:text-red-400">
            Check that <code>KEAP_API_KEY</code> is set in <code>.env.local</code> and the dev
            server has been restarted since adding it.
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
            Keap CRM
          </h1>
          <span className="text-xs text-gray-400 dark:text-gray-500">Updated {updatedAt} PT</span>
        </div>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
          {data.account?.name || "Z-Health"} — contacts, tags, and email automation.
        </p>
      </header>

      <section className="mb-10">
        <KPIGrid
          kpis={[
            { label: "Contacts", value: data.counts.contacts, hint: "Total in CRM" },
            { label: "Tags", value: data.counts.tags, hint: "Across all categories" },
            { label: "Campaigns", value: data.counts.campaigns, hint: "All time" },
            { label: "Time zone", value: data.account?.time_zone || "—" },
          ]}
        />
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Typical lifecycle flow
        </h2>
        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
          Curated diagram — needs validation against actual campaigns during pass 1.
        </p>
        <MermaidDiagram chart={KEAP_FLOW_DIAGRAM} caption="Lead → contact → tag → campaign → customer" />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Tags <span className="text-sm font-normal text-gray-500">(first 20 of {data.counts.tags.toLocaleString()})</span>
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[#1c1c1e]">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-[#202022]">
              {data.tags.map((t) => (
                <tr key={t.id} className="text-gray-700 dark:text-gray-300">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{t.id}</td>
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{t.name}</td>
                  <td className="px-4 py-2 text-xs">{t.category?.name || "—"}</td>
                  <td className="px-4 py-2 truncate text-xs text-gray-500">{t.description || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Campaigns <span className="text-sm font-normal text-gray-500">(first 20 of {data.counts.campaigns.toLocaleString()})</span>
        </h2>
        {data.campaigns.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700">
            No campaigns returned by the API. Either none are configured, or the API key&apos;s
            scopes don&apos;t include campaign read access.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#1c1c1e]">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-2 font-medium">ID</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Active contacts</th>
                  <th className="px-4 py-2 font-medium">Published</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-[#202022]">
                {data.campaigns.map((c: any) => (
                  <tr key={c.id} className="text-gray-700 dark:text-gray-300">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{c.id}</td>
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{c.name || "(unnamed)"}</td>
                    <td className="px-4 py-2 text-xs">{c.active_contact_count ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{c.published_status || c.status || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm dark:border-gray-700 dark:bg-[#1f1f21]">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Coming next</h3>
        <ul className="ml-5 mt-2 list-disc space-y-1 text-gray-600 dark:text-gray-400">
          <li>Per-tag drill-down with contact lists and "tag has no active campaign" anomalies</li>
          <li>Per-campaign performance: active contacts, completion rate, last-sent date</li>
          <li>Custom-fields inventory (helpful for segmenting trainer leads vs. course leads)</li>
          <li>30/60/90-day contact growth chart</li>
          <li>Stale-lead detection (in CRM, no engagement, no tag movement)</li>
        </ul>
      </section>
    </main>
  );
}
