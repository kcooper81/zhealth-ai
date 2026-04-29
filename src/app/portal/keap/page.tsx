import KPIGrid from "@/components/portal/KPIGrid";
import MermaidDiagram from "@/components/MermaidDiagram";
import Tabs, { TabPanel } from "@/components/portal/Tabs";
import Section, { Card } from "@/components/portal/Section";
import BarList from "@/components/portal/BarList";
import DateRangePicker from "@/components/portal/DateRangePicker";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import TagCountsTable from "@/components/portal/TagCountsTable";
import { parseTimeRange, isoDate, monthKey, pctChange } from "@/lib/time-range";
import { cachedFetch, TTL, rangeCacheSegment } from "@/lib/cache";
import {
  listContacts,
  listTags,
  listCampaigns,
  listPipelineStages,
  listOpportunities,
  listEmails,
  listOrders,
  getAccountInfo,
  getTagsWithCounts,
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
  classDef appleSlate fill:#f8fafc,stroke:#94a3b8,color:#475569,stroke-width:1.5px,stroke-dasharray:4 3
  classDef applePurple fill:#f5f3ff,stroke:#8b5cf6,color:#5b21b6,stroke-width:1.5px
`;

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

async function loadKeapData(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const rangeSeg = rangeCacheSegment(range);
  const priorSeg = rangeCacheSegment({ key: `prior-${range.key}`, from: range.prior.from, to: range.prior.to });

  try {
    const [
      account,
      contactsTotal,
      tagsTotal,
      campaignsAll,
      contactsInRange,
      contactsPriorRange,
      pipelineStages,
      opportunities,
      emails,
      ordersInRange,
      ordersPriorRange,
      tagSample,
    ] = await Promise.all([
      cachedFetch("keap:account-info", TTL.KEAP_ACCOUNT, () =>
        getAccountInfo().catch(() => null)
      ),
      cachedFetch("keap:contacts:total", TTL.KEAP_STATS, () => listContacts({ limit: 1 })),
      cachedFetch("keap:tags:count", TTL.KEAP_TAGS, () => listTags({ limit: 1 })),
      cachedFetch("keap:campaigns:200", TTL.KEAP_CAMPAIGNS, () => listCampaigns({ limit: 200 })),
      cachedFetch(`keap:contacts:in-period:${rangeSeg}`, TTL.KEAP_STATS, () =>
        listContacts({ limit: 1, since: isoDate(range.from), until: isoDate(range.to) }).catch(
          () => ({ count: 0, contacts: [] })
        )
      ),
      cachedFetch(`keap:contacts:in-period:${priorSeg}`, TTL.KEAP_STATS, () =>
        listContacts({
          limit: 1,
          since: isoDate(range.prior.from),
          until: isoDate(range.prior.to),
        }).catch(() => ({ count: 0, contacts: [] }))
      ),
      cachedFetch("keap:pipeline-stages", TTL.KEAP_OPPORTUNITIES, () =>
        listPipelineStages().catch(() => [])
      ),
      cachedFetch("keap:opportunities:200", TTL.KEAP_OPPORTUNITIES, () =>
        listOpportunities({ limit: 200 }).catch(() => ({ opportunities: [], count: 0 }))
      ),
      cachedFetch(`keap:emails:since:${rangeSeg}`, TTL.KEAP_EMAILS, () =>
        listEmails({ limit: 100, since_sent_date: isoDate(range.from) }).catch(() => ({
          emails: [],
          count: 0,
        }))
      ),
      cachedFetch(`keap:orders:in-period:${rangeSeg}`, TTL.KEAP_STATS, () =>
        listOrders({ limit: 100, since: isoDate(range.from), until: isoDate(range.to) }).catch(
          () => ({ orders: [], count: 0 })
        )
      ),
      cachedFetch(`keap:orders:in-period:${priorSeg}`, TTL.KEAP_STATS, () =>
        listOrders({
          limit: 100,
          since: isoDate(range.prior.from),
          until: isoDate(range.prior.to),
        }).catch(() => ({ orders: [], count: 0 }))
      ),
      cachedFetch("keap:tags:200", TTL.KEAP_TAGS, () => listTags({ limit: 200 })),
    ]);

    // Fetch all tag counts (paid for once per cache TTL — heavy but cached for 30 min)
    const tagsWithCounts = await cachedFetch(
      "keap:tags:counts:200",
      TTL.KEAP_TAGS,
      () => getTagsWithCounts(200).catch(() => [])
    );

    return {
      ok: true as const,
      range,
      account,
      counts: {
        contacts: contactsTotal.count,
        tags: tagsTotal.count,
        campaigns: campaignsAll.count,
      },
      window: {
        newContacts: contactsInRange.count,
        priorNewContacts: contactsPriorRange.count,
        emailsSent: emails.count,
        emailsSample: emails.emails ?? [],
        orders: ordersInRange.orders,
        ordersCount: ordersInRange.count,
        ordersPriorCount: ordersPriorRange.count,
      },
      tags: tagSample.tags,
      tagsWithCounts,
      campaigns: campaignsAll.campaigns ?? [],
      pipelineStages: Array.isArray(pipelineStages) ? pipelineStages : [],
      opportunities: opportunities.opportunities ?? [],
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Unknown Keap error",
      range,
    };
  }
}

export const metadata = {
  title: "Keap CRM — Z-Health Portal",
};

export default async function KeapPortalPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await loadKeapData(searchParams);

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
        </Card>
      </main>
    );
  }

  const updatedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });

  // ---- Computed metrics & insights ----
  const newContactsTrend = pctChange(data.window.newContacts, data.window.priorNewContacts);
  const ordersTrend = pctChange(data.window.ordersCount, data.window.ordersPriorCount);

  const topCampaigns = [...data.campaigns]
    .filter((c: any) => (c.active_contact_count ?? 0) > 0)
    .sort((a: any, b: any) => (b.active_contact_count ?? 0) - (a.active_contact_count ?? 0))
    .slice(0, 12);

  const deadCampaigns = data.campaigns.filter((c: any) => (c.active_contact_count ?? 0) === 0);
  const publishedCampaigns = data.campaigns.filter((c: any) =>
    (c.published_status || c.status || "").toString().toLowerCase().includes("publish")
  ).length;

  // Tag categories distribution
  const tagsByCategory = new Map<string, number>();
  for (const t of data.tags) {
    const cat = t.category?.name || "Uncategorized";
    tagsByCategory.set(cat, (tagsByCategory.get(cat) ?? 0) + 1);
  }
  const tagCategoryItems = Array.from(tagsByCategory.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Pipeline distribution + value
  const opportunitiesByStage = new Map<string, { count: number; value: number }>();
  let totalPipelineValue = 0;
  for (const opp of data.opportunities) {
    const stage = opp.stage?.name || "Unstaged";
    const value = (opp.projected_revenue_high ?? 0) + 0;
    const cur = opportunitiesByStage.get(stage) || { count: 0, value: 0 };
    cur.count += 1;
    cur.value += value;
    totalPipelineValue += value;
    opportunitiesByStage.set(stage, cur);
  }
  const stageItems = Array.from(opportunitiesByStage.entries())
    .map(([label, m]) => ({
      label,
      value: m.count,
      sublabel: m.value > 0 ? fmtMoney(m.value * 100) : undefined,
    }))
    .sort((a, b) => b.value - a.value);

  // Email volume by week (last weeks within range)
  const emailsByWeek = new Map<string, number>();
  for (const e of data.window.emailsSample) {
    if (!e.sent_date) continue;
    const d = new Date(e.sent_date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    emailsByWeek.set(key, (emailsByWeek.get(key) ?? 0) + 1);
  }
  const weeklyEmails = Array.from(emailsByWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8);

  // Orders by month (within window)
  const ordersByMonth = new Map<string, { count: number; revenue: number }>();
  for (const o of data.window.orders) {
    if (!o.order_date) continue;
    const m = monthKey(o.order_date);
    const cur = ordersByMonth.get(m) || { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += o.total ?? 0;
    ordersByMonth.set(m, cur);
  }
  const monthlyOrders = Array.from(ordersByMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const orderRevenueInPeriod = data.window.orders.reduce((s, o) => s + (o.total ?? 0), 0);

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Keap CRM
          </h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <span className="text-xs text-gray-400 dark:text-gray-500">{updatedAt} PT</span>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          {data.account?.name || "Z-Health"} · {data.range.label.toLowerCase()}
        </p>
      </header>

      <div className="mb-10">
        <KPIGrid
          accent="blue"
          kpis={[
            {
              label: "Total contacts",
              value: data.counts.contacts,
              hint: "All time",
            },
            {
              label: `New (${data.range.label.toLowerCase()})`,
              value: data.window.newContacts,
              trend: { value: newContactsTrend.value, positive: newContactsTrend.positive },
              hint: `vs prior ${data.range.days}d`,
            },
            {
              label: "Active campaigns",
              value: data.campaigns.filter((c: any) => (c.active_contact_count ?? 0) > 0).length,
              hint: `${publishedCampaigns} published, ${deadCampaigns.length} dead`,
            },
            {
              label: "Pipeline value",
              value: totalPipelineValue > 0 ? fmtMoney(totalPipelineValue * 100) : "—",
              hint: `${data.opportunities.length} opportunities`,
            },
          ]}
        />
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "reports", label: "Reports" },
          { id: "tag-counts", label: "Tag counts" },
          { id: "tags", label: "Tags", badge: data.counts.tags },
          { id: "campaigns", label: "Campaigns", badge: data.counts.campaigns },
          { id: "pipeline", label: "Pipeline", badge: data.opportunities.length },
        ]}
      >
        <TabPanel id="overview">
          <Section
            title="Lifecycle flow"
            description="The typical path a lead takes through Keap. Click to expand."
          >
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
          {/* Insights row */}
          <Section title="Findings" description={`Computed from ${data.range.label.toLowerCase()} of activity.`}>
            <InsightGrid>
              <Insight
                severity={newContactsTrend.positive ? "good" : "warn"}
                title={`${newContactsTrend.positive ? "Lead growth" : "Lead decline"}: ${data.window.newContacts.toLocaleString()} new contacts`}
              >
                {newContactsTrend.positive ? "Up" : "Down"} {newContactsTrend.value}% vs prior {data.range.days} days. Prior period had {data.window.priorNewContacts.toLocaleString()} new contacts.
              </Insight>
              {deadCampaigns.length > 0 && (
                <Insight severity="warn" title={`${deadCampaigns.length} campaigns have no active contacts`}>
                  These campaigns aren&apos;t reaching anyone right now — candidates for cleanup or re-launch. {publishedCampaigns} of {data.campaigns.length} campaigns are marked published.
                </Insight>
              )}
              <Insight
                severity={ordersTrend.positive ? "good" : "warn"}
                title={`Orders in Keap: ${data.window.ordersCount.toLocaleString()}`}
              >
                {ordersTrend.positive ? "+" : "−"}{ordersTrend.value}% vs prior period. Note: most ecom is on Thinkific; Keap orders may reflect legacy or one-off products.
              </Insight>
              {totalPipelineValue > 0 && (
                <Insight severity="info" title={`Pipeline: ${fmtMoney(totalPipelineValue * 100)} across ${data.opportunities.length} opportunities`}>
                  Distributed across {opportunitiesByStage.size} stages. See the Pipeline tab for the breakdown.
                </Insight>
              )}
              {data.window.emailsSent > 0 && (
                <Insight severity="info" title={`${data.window.emailsSent.toLocaleString()} emails sent in period`}>
                  Includes broadcasts and campaign emails captured in the timeline.
                </Insight>
              )}
              {tagCategoryItems.length > 0 && (
                <Insight severity="info" title={`${tagCategoryItems.length} tag categories in use`}>
                  Top: {tagCategoryItems.slice(0, 3).map((t) => t.label).join(", ")}. See Tags tab.
                </Insight>
              )}
            </InsightGrid>
          </Section>

          <Section title="New contacts in period" description={`Compared to prior ${data.range.days} days.`}>
            <Card>
              <BarList
                color="green"
                items={[
                  {
                    label: data.range.label,
                    value: data.window.newContacts,
                    sublabel: `${data.window.newContacts.toLocaleString()} contacts`,
                  },
                  {
                    label: `Prior ${data.range.days} days`,
                    value: data.window.priorNewContacts,
                    sublabel: `${data.window.priorNewContacts.toLocaleString()} contacts`,
                  },
                ]}
              />
            </Card>
          </Section>

          <Section
            title="Top campaigns by active contacts"
            description={`The ${topCampaigns.length} largest campaigns out of ${data.counts.campaigns.toLocaleString()} total.`}
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

          {tagCategoryItems.length > 0 && (
            <Section title="Tags by category" description={`${data.tags.length} tags grouped.`}>
              <Card>
                <BarList color="purple" items={tagCategoryItems} />
              </Card>
            </Section>
          )}

          {stageItems.length > 0 && (
            <Section
              title="Pipeline distribution"
              description={`Opportunities by stage. Total value: ${fmtMoney(totalPipelineValue * 100)}.`}
            >
              <Card>
                <BarList color="purple" items={stageItems} />
              </Card>
            </Section>
          )}

          {monthlyOrders.length > 0 && (
            <Section title="Orders by month" description={`${data.window.orders.length} orders within window.`}>
              <Card>
                <BarList
                  color="green"
                  items={monthlyOrders.map(([m, v]) => ({
                    label: m,
                    value: v.count,
                    sublabel: v.revenue > 0 ? fmtMoney(v.revenue * 100) : undefined,
                  }))}
                  formatValue={(n) => `${n} orders`}
                />
                {orderRevenueInPeriod > 0 && (
                  <p className="mt-4 text-xs text-gray-500 dark:text-gray-500">
                    Revenue in period: <strong className="tabular-nums">{fmtMoney(orderRevenueInPeriod * 100)}</strong>
                  </p>
                )}
              </Card>
            </Section>
          )}

          {weeklyEmails.length > 0 && (
            <Section title="Email send volume" description="By week, in current period.">
              <Card>
                <BarList
                  color="amber"
                  items={weeklyEmails.map(([wk, n]) => ({
                    label: `Week of ${wk}`,
                    value: n,
                  }))}
                  formatValue={(n) => `${n} emails`}
                />
              </Card>
            </Section>
          )}

          {data.window.emailsSample.length > 0 && (
            <Section title="Recent broadcast emails" description={`${Math.min(15, data.window.emailsSample.length)} most recent in period.`}>
              <Card padded={false}>
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200/70 dark:border-white/5">
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <th className="px-5 py-3">Subject</th>
                      <th className="px-5 py-3">Sent</th>
                      <th className="px-5 py-3">To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {data.window.emailsSample.slice(0, 15).map((e: any) => (
                      <tr key={e.id} className="text-gray-700 dark:text-gray-300">
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {e.subject || "(no subject)"}
                        </td>
                        <td className="px-5 py-3 text-xs">
                          {e.sent_date ? new Date(e.sent_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500">{e.sent_to_address || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </Section>
          )}
        </TabPanel>

        <TabPanel id="tag-counts">
          <Section
            title="Tag counts — course registrations and beyond"
            description={`Live contact counts for the first ${data.tagsWithCounts.length} tags out of ${data.counts.tags.toLocaleString()} total. Use the search and quick filters to find your course-registration tags wherever they live in the tag tree.`}
          >
            <TagCountsTable tags={data.tagsWithCounts} />
          </Section>
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
            description={`Showing ${data.campaigns.length} of ${data.counts.campaigns.toLocaleString()}. Sorted by active contacts.`}
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
                  {[...data.campaigns]
                    .sort((a: any, b: any) => (b.active_contact_count ?? 0) - (a.active_contact_count ?? 0))
                    .map((c: any) => (
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
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Total pipeline
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-gray-900 dark:text-gray-50">
                {totalPipelineValue > 0 ? fmtMoney(totalPipelineValue * 100) : "—"}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                {data.opportunities.length} opportunities
              </div>
            </Card>
            <Card className="md:col-span-2">
              <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Stages
              </div>
              <div className="mt-3">
                <BarList color="purple" items={stageItems} emptyMessage="No opportunities returned." />
              </div>
            </Card>
          </div>

          <div className="mt-8" />

          <Section title="Pipeline stages config" description="Stages defined in Keap.">
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
