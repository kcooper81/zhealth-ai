/**
 * Campaigns report — Keap sequences with their actual reach + status.
 *
 * Previously this report attempted a fuzzy match between Keap campaign
 * names and GA4 `sessionCampaignName` to attribute traffic and revenue.
 * That matched almost nothing in practice (Keap names are ad-hoc text,
 * GA4 campaigns come from utm_campaign on outbound links — they only
 * align if the team consistently sets utm_campaign to a normalized
 * version of the Keap name). To avoid showing misleading $0 columns,
 * we now show only what Keap actually returns.
 *
 * To see attribution for an email/sequence, set utm_campaign=<slug> on
 * its outbound links and check the Channels or Funnels report.
 */
import Section, { Card } from "@/components/portal/Section";
import DateRangePicker from "@/components/portal/DateRangePicker";
import ExportButton from "@/components/portal/ExportButton";
import KPIGrid from "@/components/portal/KPIGrid";
import BarList from "@/components/portal/BarList";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import { parseTimeRange } from "@/lib/time-range";
import { cachedFetch, TTL } from "@/lib/cache";
import { listCampaigns } from "@/lib/keap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function loadCampaigns(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);

  const keapCampaigns = await cachedFetch("keap:campaigns:200", TTL.KEAP_CAMPAIGNS, () =>
    listCampaigns({ limit: 200 }).catch(() => ({ count: 0, campaigns: [] }))
  );

  const campaigns = (keapCampaigns.campaigns || []).map((c: any) => ({
    id: c.id,
    name: c.name || "(unnamed)",
    status: c.published_status || c.status || "—",
    activeContacts: c.active_contact_count ?? 0,
    publishedAt: c.published_time_set || c.date_created || null,
    completedContactCount: c.completed_contact_count ?? 0,
    historicalContactCount: c.historical_contact_count ?? c.completed_contact_count ?? 0,
  }));

  campaigns.sort((a, b) => (b.activeContacts || 0) - (a.activeContacts || 0));

  const totals = {
    campaigns: campaigns.length,
    activeContacts: campaigns.reduce((s, c) => s + c.activeContacts, 0),
    publishedCount: campaigns.filter((c) => /publish/i.test(c.status)).length,
    deadCount: campaigns.filter((c) => c.activeContacts === 0).length,
  };

  return { range, campaigns, totals };
}

export const metadata = { title: "Campaigns — Z-Health Portal" };

export default async function CampaignsReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await loadCampaigns(searchParams);

  const insights: Array<{ severity: "good" | "warn" | "alert" | "info"; title: string; body: string }> = [];

  if (data.totals.deadCount > 0) {
    const deadShare = Math.round((data.totals.deadCount / data.totals.campaigns) * 100);
    insights.push({
      severity: deadShare >= 50 ? "alert" : "warn",
      title: `${data.totals.deadCount} of ${data.totals.campaigns} campaigns have no active contacts (${deadShare}%)`,
      body: "Empty sequences either finished their job or were never published. Worth archiving or relaunching to keep the Keap workspace tidy.",
    });
  }

  const topActive = data.campaigns[0];
  if (topActive && topActive.activeContacts > 0) {
    insights.push({
      severity: "info",
      title: `Most-reached sequence: ${topActive.name}`,
      body: `${topActive.activeContacts.toLocaleString()} contacts currently in the sequence. Status: ${topActive.status}.`,
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Campaigns</h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <ExportButton targetId="report-content" filename="campaigns-report" label="Export all" />
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
          Keap sequences with their active reach and lifecycle. To attribute traffic or revenue
          to a specific campaign, tag its outbound emails with{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-white/10">utm_campaign=&lt;slug&gt;</code>{" "}
          and check the Channels or Funnels report.
        </p>
      </header>

      <div id="report-content" className="bg-white dark:bg-[#1c1c1e]">

      <div className="mb-10">
        <KPIGrid
          accent="blue"
          kpis={[
            { label: "Total campaigns", value: data.totals.campaigns.toLocaleString() },
            { label: "Published", value: data.totals.publishedCount.toLocaleString() },
            { label: "Active reach", value: data.totals.activeContacts.toLocaleString(), hint: "contacts in sequences right now" },
            { label: "No active contacts", value: data.totals.deadCount.toLocaleString(), hint: "candidates for cleanup" },
          ]}
        />
      </div>

      {insights.length > 0 && (
        <Section
          id="section-insights"
          title="What stands out"
          description="Computed from the current Keap campaign list."
          action={<ExportButton targetId="section-insights" filename="campaigns-insights" />}
        >
          <InsightGrid>
            {insights.map((i, idx) => (
              <Insight key={idx} severity={i.severity} title={i.title}>{i.body}</Insight>
            ))}
          </InsightGrid>
        </Section>
      )}

      <Section
        id="section-top-active"
        title="Top campaigns by active contacts"
        description="Where most contacts currently sit in your sequences."
        action={<ExportButton targetId="section-top-active" filename="campaigns-top-active" />}
      >
        <Card>
          <BarList
            color="blue"
            items={data.campaigns
              .filter((c) => c.activeContacts > 0)
              .slice(0, 15)
              .map((c) => ({
                label: c.name,
                value: c.activeContacts,
                sublabel: c.status,
              }))}
            formatValue={(n) => `${n.toLocaleString()} active`}
            emptyMessage="No campaigns with active contacts in Keap right now."
          />
        </Card>
      </Section>

      <Section
        id="section-rollup"
        title="All campaigns"
        description={`${data.campaigns.length.toLocaleString()} sequences ranked by current active reach.`}
        action={<ExportButton targetId="section-rollup" filename="campaigns-rollup" />}
      >
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="px-5 py-3">Campaign</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Active</th>
                  <th className="px-5 py-3 text-right">Completed</th>
                  <th className="px-5 py-3 text-right">Lifetime reach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {data.campaigns.map((c) => (
                  <tr key={c.id} className="text-gray-700 dark:text-gray-300">
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
                    <td className="px-5 py-3 text-xs">{c.status}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold">{c.activeContacts.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.completedContactCount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.historicalContactCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      </div>
    </main>
  );
}
