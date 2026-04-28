import KPIGrid from "@/components/portal/KPIGrid";
import MermaidDiagram from "@/components/MermaidDiagram";
import Tabs, { TabPanel } from "@/components/portal/Tabs";
import Section, { Card } from "@/components/portal/Section";
import BarList from "@/components/portal/BarList";
import {
  listContacts,
  listTags,
  listCampaigns,
  listPipelineStages,
  listOpportunities,
  listEmails,
  getAccountInfo,
} from "@/lib/keap";

export const dynamic = "force-dynamic";

const KEAP_FLOW_DIAGRAM = `
flowchart TD
  Lead["New lead<br/>(WP form, ad, etc.)"]:::appleBlue --> Contact["Contact created<br/>in Keap"]:::appleGreen
  Contact --> Tag["Tag applied<br/>(by source)"]:::appleGreen
  Tag --> Campaign["Campaign / sequence<br/>triggered"]:::appleGreen
  Campaign --> Email["Email sent"]:::appleGreen
  Email --> Open{Opened?}:::appleAmber
  Open -- yes --> Engaged["Tag: engaged"]:::applePurple
  Open -- no --> Stale["Tag: stale<br/>after N days"]:::appleSlate
  Engaged --> Buy["Buys course<br/>on Thinkific"]:::appleBlue
  Buy --> Customer["Tag: customer<br/>+ post-purchase sequence"]:::applePurple
  Stale --> WinBack["Win-back sequence"]:::applePurple
  classDef appleBlue fill:#eff6ff,stroke:#3b82f6,color:#1e40af,stroke-width:1.5px
  classDef appleGreen fill:#ecfdf5,stroke:#10b981,color:#065f46,stroke-width:1.5px
  classDef appleAmber fill:#fffbeb,stroke:#f59e0b,color:#92400e,stroke-width:1.5px
  classDef appleRose fill:#fff1f2,stroke:#f43f5e,color:#9f1239,stroke-width:1.5px
  classDef appleSlate fill:#f8fafc,stroke:#94a3b8,color:#475569,stroke-width:1.5px,stroke-dasharray:4 3
  classDef applePurple fill:#f5f3ff,stroke:#8b5cf6,color:#5b21b6,stroke-width:1.5px
`;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function loadKeapData() {
  try {
    const [account, contactsTotal, tagsTotal, campaignsAll, contacts7d, contacts30d, contacts90d, pipelineStages, opportunities, emails, tagSample] =
      await Promise.all([
        getAccountInfo().catch(() => null),
        listContacts({ limit: 1 }),
        listTags({ limit: 1 }),
        listCampaigns({ limit: 200 }),
        listContacts({ limit: 1, since: isoDaysAgo(7) }).catch(() => ({ count: 0, contacts: [] })),
        listContacts({ limit: 1, since: isoDaysAgo(30) }).catch(() => ({ count: 0, contacts: [] })),
        listContacts({ limit: 1, since: isoDaysAgo(90) }).catch(() => ({ count: 0, contacts: [] })),
        listPipelineStages().catch(() => []),
        listOpportunities({ limit: 200 }).catch(() => ({ opportunities: [], count: 0 })),
        listEmails({ limit: 50 }).catch(() => ({ emails: [], count: 0 })),
        listTags({ limit: 200 }),
      ]);

    return {
      ok: true as const,
      account,
      counts: {
        contacts: contactsTotal.count,
        tags: tagsTotal.count,
        campaigns: campaignsAll.count,
      },
      growth: {
        last7d: contacts7d.count,
        last30d: contacts30d.count,
        last90d: contacts90d.count,
      },
      tags: tagSample.tags,
      campaigns: campaignsAll.campaigns ?? [],
      pipelineStages: Array.isArray(pipelineStages) ? pipelineStages : [],
      opportunities: opportunities.opportunities ?? [],
      emails: emails.emails ?? [],
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
      <main className="mx-auto max-w-7xl px-8 py-12">
        <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
          Keap CRM
        </h1>
        <Card className="mt-8 border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20">
          <div className="font-semibold text-rose-900 dark:text-rose-200">
            Could not load Keap data
          </div>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-rose-800 dark:text-rose-300">
            {data.error}
          </pre>
          <p className="mt-3 text-xs text-rose-700 dark:text-rose-400">
            Check that <code>KEAP_API_KEY</code> is set in <code>.env.local</code> and the dev
            server has been restarted since adding it.
          </p>
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
  const topCampaigns = [...data.campaigns]
    .filter((c: any) => (c.active_contact_count ?? 0) > 0)
    .sort((a: any, b: any) => (b.active_contact_count ?? 0) - (a.active_contact_count ?? 0))
    .slice(0, 10);

  const publishedCampaigns = data.campaigns.filter(
    (c: any) => (c.published_status || c.status || "").toString().toLowerCase().includes("publish")
  ).length;

  const opportunitiesByStage = new Map<string, number>();
  for (const opp of data.opportunities) {
    const stage = opp.stage?.name || "Unstaged";
    opportunitiesByStage.set(stage, (opportunitiesByStage.get(stage) ?? 0) + 1);
  }
  const stageItems = Array.from(opportunitiesByStage.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Keap CRM
          </h1>
          <span className="text-xs text-gray-400 dark:text-gray-500">Updated {updatedAt} PT</span>
        </div>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          {data.account?.name || "Z-Health"} — contacts, tags, automation, and pipeline.
        </p>
      </header>

      <div className="mb-10">
        <KPIGrid
          accent="blue"
          kpis={[
            {
              label: "Contacts",
              value: data.counts.contacts,
              hint: `${data.growth.last30d.toLocaleString()} new in 30 days`,
            },
            {
              label: "Tags",
              value: data.counts.tags,
              hint: "Across all categories",
            },
            {
              label: "Campaigns",
              value: data.counts.campaigns,
              hint: `${publishedCampaigns} published`,
            },
            {
              label: "Opportunities",
              value: data.opportunities.length,
              hint: stageItems.length ? `${stageItems.length} stages` : "—",
            },
          ]}
        />
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "reports", label: "Reports" },
          { id: "tags", label: "Tags", badge: data.counts.tags },
          { id: "campaigns", label: "Campaigns", badge: data.counts.campaigns },
          { id: "pipeline", label: "Pipeline", badge: data.opportunities.length },
        ]}
      >
        <TabPanel id="overview">
          <Section title="Lifecycle flow" description="Curated diagram — the typical path a lead takes through Keap.">
            <MermaidDiagram chart={KEAP_FLOW_DIAGRAM} caption="Lead → contact → tag → campaign → customer" />
          </Section>

          <Section title="Account">
            <Card>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Business name</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{data.account?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Email</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{data.account?.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Time zone</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{data.account?.time_zone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Website</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{data.account?.website ?? "—"}</dd>
                </div>
              </dl>
            </Card>
          </Section>
        </TabPanel>

        <TabPanel id="reports">
          <Section title="Contact growth" description="New contacts added to Keap over time.">
            <Card>
              <BarList
                color="green"
                items={[
                  { label: "Last 7 days", value: data.growth.last7d },
                  { label: "Last 30 days", value: data.growth.last30d },
                  { label: "Last 90 days", value: data.growth.last90d },
                ]}
              />
            </Card>
          </Section>

          <Section
            title="Top campaigns by active contacts"
            description={`The ${topCampaigns.length} largest active campaigns out of ${data.counts.campaigns.toLocaleString()} total.`}
          >
            <Card>
              <BarList
                color="blue"
                items={topCampaigns.map((c: any) => ({
                  label: c.name || "(unnamed)",
                  value: c.active_contact_count ?? 0,
                  sublabel: c.published_status || c.status || undefined,
                }))}
                emptyMessage="No active campaigns returned by API."
              />
            </Card>
          </Section>

          {stageItems.length > 0 && (
            <Section title="Pipeline distribution" description="Opportunities grouped by stage.">
              <Card>
                <BarList color="purple" items={stageItems} />
              </Card>
            </Section>
          )}

          {data.emails.length > 0 && (
            <Section title="Recent broadcast emails" description={`Last ${data.emails.length} emails sent.`}>
              <Card padded={false}>
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200/70 dark:border-white/5">
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <th className="px-5 py-3">Subject</th>
                      <th className="px-5 py-3">Sent</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {data.emails.slice(0, 15).map((e: any) => (
                      <tr key={e.id} className="text-gray-700 dark:text-gray-300">
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {e.subject || "(no subject)"}
                        </td>
                        <td className="px-5 py-3 text-xs">
                          {e.sent_date ? new Date(e.sent_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs">{e.status ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </Section>
          )}
        </TabPanel>

        <TabPanel id="tags">
          <Section
            title="All tags"
            description={`Showing ${data.tags.length} of ${data.counts.tags.toLocaleString()} total.`}
          >
            <Card padded={false}>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200/70 dark:border-white/5">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-3">ID</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {data.tags.map((t) => (
                    <tr key={t.id} className="text-gray-700 dark:text-gray-300">
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{t.id}</td>
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{t.name}</td>
                      <td className="px-5 py-3 text-xs">{t.category?.name || "—"}</td>
                      <td className="px-5 py-3 truncate text-xs text-gray-500">{t.description || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>
        </TabPanel>

        <TabPanel id="campaigns">
          <Section
            title="All campaigns"
            description={`Showing ${data.campaigns.length} of ${data.counts.campaigns.toLocaleString()} total.`}
          >
            <Card padded={false}>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200/70 dark:border-white/5">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-3">ID</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Active contacts</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {data.campaigns.map((c: any) => (
                    <tr key={c.id} className="text-gray-700 dark:text-gray-300">
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{c.id}</td>
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{c.name || "(unnamed)"}</td>
                      <td className="px-5 py-3 text-xs tabular-nums">
                        {(c.active_contact_count ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-xs">{c.published_status || c.status || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>
        </TabPanel>

        <TabPanel id="pipeline">
          <Section title="Pipeline stages">
            <Card padded={false}>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200/70 dark:border-white/5">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-3">Stage</th>
                    <th className="px-5 py-3">Order</th>
                    <th className="px-5 py-3">Probability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {data.pipelineStages.map((s: any) => (
                    <tr key={s.id} className="text-gray-700 dark:text-gray-300">
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{s.name}</td>
                      <td className="px-5 py-3 text-xs">{s.stage_order ?? "—"}</td>
                      <td className="px-5 py-3 text-xs">{s.probability ?? "—"}</td>
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
