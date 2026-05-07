/**
 * Emails report — every Keap email broadcast in the window joined to the
 * downstream attribution from GA4 (utm_campaign), Keap tag activity, and
 * Thinkific orders that fired after links from each email.
 *
 * Important: Keap REST v1 doesn't expose open/click rates per-email — those
 * are only in the Keap admin UI. This report focuses on the parts we *can*
 * cross-stitch automatically: which emails went out, what utm_campaign they
 * presumably used, and what enrolled/purchased after links carrying that
 * campaign were clicked.
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
import { getEventCounts, getEcommerce } from "@/lib/google-analytics";
import { listEmails } from "@/lib/keap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

/** Best-effort: extract a UTM campaign hint from an email subject + body */
function inferCampaign(subject: string): string {
  const s = (subject || "").toLowerCase();
  if (/free webinar|pain neuroscience/.test(s)) return "free-webinar";
  if (/lower back|low back/.test(s)) return "lower-back";
  if (/blog|newsletter|weekly/.test(s)) return "weekly-blog";
  if (/neurofundamentals|e-?book/.test(s)) return "neurofundamentals";
  return "(unmatched)";
}

async function loadEmails(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const rangeKey = range.key === "custom" ? "30d" : range.key;
  const rangeSeg = rangeCacheSegment(range);

  const session = (await getServerSession()) as any;
  const accessToken = session?.accessToken;

  const [emailRes, emailMediumSessions, campaignRevenue, campaignPurchases, enrollClicks] = await Promise.all([
    cachedFetch(`keap:emails:since:${rangeSeg}`, TTL.KEAP_EMAILS, () =>
      listEmails({ limit: 100, since_sent_date: range.from.toISOString() }).catch(() => ({ emails: [], count: 0 }))
    ),
    accessToken
      ? cachedFetch(`ga4:medium=email:${rangeKey}`, TTL.GA4_REPORTS, () =>
          // Sessions where medium=email — proxy for "from email" traffic
          getEventCounts(accessToken, "website", rangeKey, "session_start", ["sessionMedium", "sessionCampaignName"], 200).catch(() => [])
        )
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:ecom:campaign:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEcommerce(accessToken, "website", rangeKey, "sessionCampaignName", 100).catch(() => [])
        )
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:ecom:campaign:lms:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEcommerce(accessToken, "lms", rangeKey, "sessionCampaignName", 100).catch(() => [])
        )
      : Promise.resolve([] as any[]),
    accessToken
      ? cachedFetch(`ga4:event:enroll_click:campaign:${rangeKey}`, TTL.GA4_REPORTS, () =>
          getEventCounts(accessToken, "website", rangeKey, "enroll_click", ["sessionCampaignName"], 100).catch(() => [])
        )
      : Promise.resolve([] as any[]),
  ]);

  // Email-medium traffic by campaign (proxy for outbound email clicks)
  const emailTrafficByCampaign = new Map<string, number>();
  for (const r of emailMediumSessions) {
    if ((r.dims.sessionMedium || "").toLowerCase() === "email") {
      const c = r.dims.sessionCampaignName || "(not set)";
      emailTrafficByCampaign.set(c, (emailTrafficByCampaign.get(c) ?? 0) + r.eventCount);
    }
  }

  // Combined revenue per campaign across both properties
  const revByCampaign = new Map<string, number>();
  const purchaseCountByCampaign = new Map<string, number>();
  for (const r of [...campaignRevenue, ...campaignPurchases]) {
    const k = r.dim || "(not set)";
    revByCampaign.set(k, (revByCampaign.get(k) ?? 0) + r.revenue);
    purchaseCountByCampaign.set(k, (purchaseCountByCampaign.get(k) ?? 0) + r.purchases);
  }

  const enrollClicksByCampaign = new Map<string, number>();
  for (const r of enrollClicks) {
    const k = r.dims.sessionCampaignName || "(not set)";
    enrollClicksByCampaign.set(k, (enrollClicksByCampaign.get(k) ?? 0) + r.eventCount);
  }

  const emails = (emailRes.emails || []).map((e: any) => {
    const inferred = inferCampaign(e.subject || "");
    return {
      id: e.id,
      subject: e.subject || "(no subject)",
      sent_date: e.sent_date,
      sent_to: e.sent_to_address || "",
      inferredCampaign: inferred,
      emailSessions: emailTrafficByCampaign.get(inferred) ?? 0,
      enrollClicks: enrollClicksByCampaign.get(inferred) ?? 0,
      purchases: purchaseCountByCampaign.get(inferred) ?? 0,
      revenue: revByCampaign.get(inferred) ?? 0,
    };
  });

  emails.sort((a, b) => {
    const ta = a.sent_date ? new Date(a.sent_date).getTime() : 0;
    const tb = b.sent_date ? new Date(b.sent_date).getTime() : 0;
    return tb - ta;
  });

  const totals = {
    emails: emails.length,
    emailSessions: Array.from(emailTrafficByCampaign.values()).reduce((s, n) => s + n, 0),
    purchases: Array.from(purchaseCountByCampaign.values()).reduce((s, n) => s + n, 0),
    revenue: Array.from(revByCampaign.values()).reduce((s, n) => s + n, 0),
  };

  return {
    range,
    accessToken: !!accessToken,
    emails,
    totals,
    emailTrafficByCampaign: Array.from(emailTrafficByCampaign.entries()).sort((a, b) => b[1] - a[1]),
  };
}

export const metadata = { title: "Emails — Z-Health Portal" };

export default async function EmailsReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await loadEmails(searchParams);

  const insights: Array<{ severity: "good" | "warn" | "alert" | "info"; title: string; body: string }> = [];
  if (data.emailTrafficByCampaign.length > 0) {
    const top = data.emailTrafficByCampaign[0];
    insights.push({
      severity: "info",
      title: `Best email-medium campaign: ${top[0]}`,
      body: `${top[1].toLocaleString()} sessions came from email links carrying utm_campaign=${top[0]}.`,
    });
  }
  const noUTMRev = data.totals.purchases === 0 && data.totals.emailSessions > 100;
  if (noUTMRev) {
    insights.push({
      severity: "warn",
      title: "Email traffic but no attributed purchases",
      body: "Either email links don't yet carry utm_medium=email or purchase events aren't firing on Thinkific. Visit Tracking Setup to confirm.",
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Emails</h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <ExportButton targetId="report-content" filename="emails-report" label="Export all" />
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
          Keap broadcasts in {data.range.label.toLowerCase()} cross-stitched against email-medium traffic and purchase attribution from GA4.
        </p>
        <p className="mt-2 max-w-2xl text-xs text-gray-500 dark:text-gray-500">
          Note: Keap REST API doesn&apos;t expose per-email open/click rates. The Weekly Report has manual fields for those numbers.
          The cross-stitch here uses utm_campaign on outbound email links — fill in <code className="rounded bg-gray-100 px-1 dark:bg-white/10">inferCampaign()</code> in the source if your subject patterns don&apos;t match yet.
        </p>
      </header>

      {!data.accessToken && (
        <Card className="mb-8 border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>GA4 not connected.</strong> Sign in via <a href="/portal/analytics" className="underline">Analytics</a> first.
          </p>
        </Card>
      )}

      <div id="report-content" className="bg-white dark:bg-[#1c1c1e]">

      <div className="mb-10">
        <KPIGrid
          accent="amber"
          kpis={[
            { label: "Emails sent", value: data.totals.emails.toLocaleString(), hint: "in window" },
            { label: "Email→site sessions", value: data.totals.emailSessions.toLocaleString(), hint: "medium=email" },
            { label: "Attributed purchases", value: data.totals.purchases.toLocaleString() },
            { label: "Attributed revenue", value: data.totals.revenue > 0 ? fmtMoney(data.totals.revenue) : "—" },
          ]}
        />
      </div>

      {insights.length > 0 && (
        <Section
          id="section-insights"
          title="What stands out"
          description="Computed from current data."
          action={<ExportButton targetId="section-insights" filename="emails-insights" />}
        >
          <InsightGrid>
            {insights.map((i, idx) => (
              <Insight key={idx} severity={i.severity} title={i.title}>{i.body}</Insight>
            ))}
          </InsightGrid>
        </Section>
      )}

      <Section
        id="section-by-campaign"
        title="Email traffic by campaign"
        description="Sessions that arrived from links carrying utm_medium=email."
        action={<ExportButton targetId="section-by-campaign" filename="emails-by-campaign" />}
      >
        <Card>
          {data.emailTrafficByCampaign.length === 0 ? (
            <p className="text-sm text-gray-500">No email-medium sessions in this window. Check your email link UTMs.</p>
          ) : (
            <BarList
              color="amber"
              items={data.emailTrafficByCampaign.slice(0, 12).map(([dim, value]) => ({
                label: dim,
                value,
                sublabel: `${(data.totals.revenue > 0 && dim ? `attributed: ${fmtMoney(0)}` : "")}`,
              }))}
              formatValue={(n) => `${n.toLocaleString()} sessions`}
            />
          )}
        </Card>
      </Section>

      <Section
        id="section-broadcasts"
        title="Broadcasts in window"
        description="From Keap, sorted newest first. Inferred campaign comes from subject pattern; tweak inferCampaign() in source to refine."
        action={<ExportButton targetId="section-broadcasts" filename="emails-broadcasts" />}
      >
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-5 py-3">Sent</th>
                  <th className="px-5 py-3">Inferred campaign</th>
                  <th className="px-5 py-3 text-right">Sessions</th>
                  <th className="px-5 py-3 text-right">Enroll clicks</th>
                  <th className="px-5 py-3 text-right">Purchases</th>
                  <th className="px-5 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {data.emails.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">
                      No Keap email broadcasts in window.
                    </td>
                  </tr>
                )}
                {data.emails.slice(0, 50).map((e) => (
                  <tr key={e.id} className="text-gray-700 dark:text-gray-300">
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{e.subject}</td>
                    <td className="px-5 py-3 text-xs">{e.sent_date ? new Date(e.sent_date).toLocaleDateString() : "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs">{e.inferredCampaign}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{e.emailSessions.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{e.enrollClicks.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{e.purchases.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{e.revenue > 0 ? fmtMoney(e.revenue) : <span className="text-gray-400">—</span>}</td>
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
