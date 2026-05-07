/**
 * Campaigns report — Keap campaign sequences enriched with the GA4 traffic
 * those campaigns drove and the Thinkific revenue attributable to them.
 *
 * Each Keap campaign exposes:
 *   - active_contact_count (people in the sequence right now)
 *   - published_status (live / draft / etc)
 *   - name (we match this to GA4 sessionCampaignName when set in outbound links)
 */
import Section, { Card } from "@/components/portal/Section";
import DateRangePicker from "@/components/portal/DateRangePicker";
import ExportButton from "@/components/portal/ExportButton";
import KPIGrid from "@/components/portal/KPIGrid";
import BarList from "@/components/portal/BarList";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import { parseTimeRange } from "@/lib/time-range";
import { getServerSession } from "@/lib/auth";
import { cachedFetch, TTL } from "@/lib/cache";
import { getEcommerce, getChannelRollup } from "@/lib/google-analytics";
import { listCampaigns } from "@/lib/keap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

/** Normalize for fuzzy match between Keap campaign name and GA4 sessionCampaignName */
function norm(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function loadCampaigns(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;

  const session = (await getServerSession()) as any;
  const accessToken = session?.accessToken;

  const [keapCampaigns, channelRollup, campaignRevenue] = await Promise.all([
    cachedFetch("keap:campaigns:200", TTL.KEAP_CAMPAIGNS, () =>
      listCampaigns({ limit: 200 }).catch(() => ({ count: 0, campaigns: [] }))
    ),
    accessToken
      ? cachedFetch(`ga4:channels:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getChannelRollup(accessToken, "website", rangeKey, 200).catch(() => [])
        )
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:ecom:campaign:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEcommerce(accessToken, "website", rangeKey, "sessionCampaignName", 100).catch(() => [])
        )
      : Promise.resolve([] as any[]),
  ]);

  // Index GA4 by normalized campaign name
  const sessionsByCampaign = new Map<string, number>();
  const usersByCampaign = new Map<string, number>();
  for (const c of channelRollup) {
    const k = norm(c.campaign);
    sessionsByCampaign.set(k, (sessionsByCampaign.get(k) ?? 0) + c.sessions);
    usersByCampaign.set(k, (usersByCampaign.get(k) ?? 0) + c.users);
  }
  const revByCampaign = new Map<string, { revenue: number; purchases: number }>();
  for (const r of campaignRevenue) {
    const k = norm(r.dim);
    const cur = revByCampaign.get(k) || { revenue: 0, purchases: 0 };
    cur.revenue += r.revenue;
    cur.purchases += r.purchases;
    revByCampaign.set(k, cur);
  }

  const campaigns = (keapCampaigns.campaigns || []).map((c: any) => {
    const k = norm(c.name);
    const rev = revByCampaign.get(k) || { revenue: 0, purchases: 0 };
    return {
      id: c.id,
      name: c.name,
      status: c.published_status || c.status || "—",
      activeContacts: c.active_contact_count ?? 0,
      sessions: sessionsByCampaign.get(k) ?? 0,
      users: usersByCampaign.get(k) ?? 0,
      purchases: rev.purchases,
      revenue: rev.revenue,
    };
  });

  campaigns.sort((a, b) => (b.activeContacts || 0) - (a.activeContacts || 0));

  const totals = {
    campaigns: campaigns.length,
    activeContacts: campaigns.reduce((s, c) => s + c.activeContacts, 0),
    sessions: campaigns.reduce((s, c) => s + c.sessions, 0),
    purchases: campaigns.reduce((s, c) => s + c.purchases, 0),
    revenue: campaigns.reduce((s, c) => s + c.revenue, 0),
  };

  return { range, accessToken: !!accessToken, campaigns, totals };
}

export const metadata = { title: "Campaigns — Z-Health Portal" };

export default async function CampaignsReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await loadCampaigns(searchParams);

  const insights: Array<{ severity: "good" | "warn" | "alert" | "info"; title: string; body: string }> = [];

  const dead = data.campaigns.filter((c) => c.activeContacts === 0).length;
  if (dead > 0) {
    insights.push({
      severity: "warn",
      title: `${dead} of ${data.campaigns.length} campaigns have no active contacts`,
      body: "These sequences aren't reaching anyone right now — candidates for archive or re-launch.",
    });
  }

  const topRev = data.campaigns.find((c) => c.revenue > 0);
  if (topRev) {
    insights.push({
      severity: "good",
      title: `Top revenue campaign: ${topRev.name}`,
      body: `${fmtMoney(topRev.revenue)} from ${topRev.purchases} purchases, ${topRev.sessions.toLocaleString()} sessions.`,
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
          Keap sequences with their active reach, plus GA4 traffic + revenue attributed to matching utm_campaign over {data.range.label.toLowerCase()}.
        </p>
      </header>

      <div id="report-content" className="bg-white dark:bg-[#1c1c1e]">

      <div className="mb-10">
        <KPIGrid
          accent="blue"
          kpis={[
            { label: "Campaigns", value: data.totals.campaigns.toLocaleString() },
            { label: "Active contacts", value: data.totals.activeContacts.toLocaleString(), hint: "across all sequences" },
            { label: "Attributed sessions", value: data.totals.sessions.toLocaleString() },
            { label: "Attributed revenue", value: data.totals.revenue > 0 ? fmtMoney(data.totals.revenue) : "—" },
          ]}
        />
      </div>

      {insights.length > 0 && (
        <Section
          id="section-insights"
          title="What stands out"
          description="Computed from current data."
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
                sublabel: c.revenue > 0 ? `${fmtMoney(c.revenue)} revenue` : c.status,
              }))}
            formatValue={(n) => `${n.toLocaleString()} active`}
          />
        </Card>
      </Section>

      <Section
        id="section-rollup"
        title="Per-campaign rollup"
        description="Keap sequence reach × GA4 traffic + revenue match (by utm_campaign normalized to the campaign name)."
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
                  <th className="px-5 py-3 text-right">Sessions</th>
                  <th className="px-5 py-3 text-right">Users</th>
                  <th className="px-5 py-3 text-right">Purchases</th>
                  <th className="px-5 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {data.campaigns.map((c) => (
                  <tr key={c.id} className="text-gray-700 dark:text-gray-300">
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
                    <td className="px-5 py-3 text-xs">{c.status}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.activeContacts.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.sessions.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.users.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.purchases.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.revenue > 0 ? fmtMoney(c.revenue) : <span className="text-gray-400">—</span>}</td>
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
