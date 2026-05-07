/**
 * Weekly Report — auto-pulled from Keap where possible, with insights computed live each render.
 *
 * Data sources:
 *   - Total contacts (engaged-list proxy):     Keap REST listContacts({limit:1}) — auto
 *   - Weekly list change:                      Keap REST listContacts({until:7daysAgo}) — auto
 *   - Upcoming event registrations:            Keap REST getContactsWithTag — auto
 *   - New contacts in window + their tags:     Keap REST listContacts({since,until,optional_properties:tag_ids,lead_source_id}) — auto
 *   - Lead magnet counts (per tag):            derived from new-contacts list — auto
 *   - Lead source counts (per source_id):      derived from new-contacts list — auto
 *   - Total all-time unsubs:                   getContactsWithTag(SYSTEM_TAGS.optedOut, {limit:1}) — auto
 *
 *   - Email open / click / complaint rate:     NOT EXPOSED by Keap REST v1. Manual entry until Keap
 *                                              webhook integration is built. Form persists to Supabase.
 *   - Unsubscribe reasons (verbatim):          NOT EXPOSED by Keap REST v1. Manual entry — paste from
 *                                              Keap admin → Reports → Unsubscribes.
 */
import { listContacts, getContactsWithTag, listAllContactsInRange } from "@/lib/keap";
import { cachedFetch, TTL, cacheGet } from "@/lib/cache";
import Section, { Card } from "@/components/portal/Section";
import DateRangePicker from "@/components/portal/DateRangePicker";
import EmailMetricsForm from "@/components/portal/EmailMetricsForm";
import Insight, { InsightGrid } from "@/components/portal/Insight";
import { parseTimeRange, pctChange } from "@/lib/time-range";
import {
  UPCOMING_EVENTS,
  LEAD_MAGNET_ROWS,
  LEAD_SOURCE_ID_ROWS,
  SYSTEM_TAGS,
} from "@/lib/weekly-report-config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function loadReportData(searchParams: Record<string, string | string[] | undefined>) {
  const range = parseTimeRange(searchParams);
  const sinceISO = range.key === "7d" ? isoDaysAgo(7) : range.from.toISOString();
  const untilISO = range.to.toISOString();
  const priorUntilISO = isoDaysAgo(7);

  const [totalContacts, contactsLastWeek, newContacts, events, totalUnsubs, emailMetrics] = await Promise.all([
    cachedFetch("keap:contacts:total", TTL.KEAP_STATS, () =>
      listContacts({ limit: 1 }).catch(() => ({ count: 0, contacts: [] }))
    ),
    cachedFetch("keap:contacts:total-up-to-7d-ago", TTL.KEAP_STATS, () =>
      listContacts({ limit: 1, until: priorUntilISO }).catch(() => ({ count: 0, contacts: [] }))
    ),
    cachedFetch(
      `keap:weekly-report:new-contacts:${sinceISO.slice(0, 10)}:${untilISO.slice(0, 10)}`,
      TTL.KEAP_STATS,
      () => listAllContactsInRange(sinceISO, untilISO).catch(() => [])
    ),
    Promise.all(
      UPCOMING_EVENTS.map(async (e) => {
        try {
          const reg = await cachedFetch(
            `keap:contacts-with-tag:${e.registeredTagId}:count`,
            TTL.KEAP_TAGS,
            () => getContactsWithTag(e.registeredTagId, { limit: 1 })
          );
          let attended: number | null = null;
          if (e.attendedTagId) {
            const att = await cachedFetch(
              `keap:contacts-with-tag:${e.attendedTagId}:count`,
              TTL.KEAP_TAGS,
              () => getContactsWithTag(e.attendedTagId!, { limit: 1 })
            );
            attended = att.count;
          }
          return { ...e, registered: reg.count, attended };
        } catch {
          return { ...e, registered: 0, attended: null };
        }
      })
    ),
    cachedFetch(
      `keap:contacts-with-tag:${SYSTEM_TAGS.optedOut}:count`,
      TTL.KEAP_TAGS,
      () => getContactsWithTag(SYSTEM_TAGS.optedOut, { limit: 1 }).catch(() => ({ count: 0, contacts: [] }))
    ),
    cacheGet<any[]>("weekly-report:email-metrics:history"),
  ]);

  // ---- Tag/source counts derived from new-contacts list ----
  const tagToCount = new Map<number, number>();
  const sourceToCount = new Map<number, number>();
  for (const c of newContacts) {
    if (c.tag_ids) for (const t of c.tag_ids) tagToCount.set(t, (tagToCount.get(t) ?? 0) + 1);
    if (c.lead_source_id) sourceToCount.set(c.lead_source_id, (sourceToCount.get(c.lead_source_id) ?? 0) + 1);
  }

  const leadMagnetCounts = LEAD_MAGNET_ROWS.map((r) => ({
    label: r.label,
    count: tagToCount.get(r.tagId) ?? 0,
    tagId: r.tagId,
  }));
  const leadSourceCounts = LEAD_SOURCE_ID_ROWS.map((r) => ({
    label: r.label,
    count: sourceToCount.get(r.sourceId) ?? 0,
    sourceId: r.sourceId,
  }));

  const knownIds = new Set(LEAD_SOURCE_ID_ROWS.map((r) => r.sourceId));
  const unknownSources = Array.from(sourceToCount.entries())
    .filter(([id]) => !knownIds.has(id))
    .map(([sourceId, count]) => ({ sourceId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const grandTotalLeads = leadMagnetCounts.reduce((s, r) => s + r.count, 0) + leadSourceCounts.reduce((s, r) => s + r.count, 0);
  const weeklyChange = totalContacts.count - contactsLastWeek.count;

  return {
    range,
    totalEngaged: totalContacts.count,
    weeklyChange,
    lastWeekTotal: contactsLastWeek.count,
    totalUnsubsAllTime: totalUnsubs.count,
    events,
    leadMagnetCounts,
    leadSourceCounts,
    unknownSources,
    grandTotalLeads,
    newContactsTotal: newContacts.length,
    emailMetricsHistory: emailMetrics ?? [],
  };
}

function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function MetricRow({
  label,
  current,
  prior,
  format,
  isPercent = false,
  source,
  higherIsWorse = false,
}: {
  label: string;
  current: number | null;
  prior: number | null;
  format: (n: number) => string;
  isPercent?: boolean;
  source: "Auto" | "Manual";
  higherIsWorse?: boolean;
}) {
  // Compute delta + display
  let deltaCell: React.ReactNode = <span className="text-gray-400">—</span>;
  if (current != null && prior != null) {
    const diff = current - prior;
    if (Math.abs(diff) > 1e-9) {
      const isUp = diff > 0;
      // For "higherIsWorse" metrics like complaint rate, up = bad
      const isBadDirection = higherIsWorse ? isUp : !isUp;
      const cls = isBadDirection ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400";
      const arrow = isUp ? "▲" : "▼";
      const display = isPercent ? `${(diff * 100).toFixed(2)}%` : format(Math.abs(diff));
      deltaCell = (
        <span className={`tabular-nums font-medium ${cls}`}>
          {arrow} {isPercent ? display.replace(/^-/, "") : display}
        </span>
      );
    } else {
      deltaCell = <span className="text-gray-500">no change</span>;
    }
  } else if (current != null && prior == null) {
    deltaCell = <span className="text-xs text-gray-400">no prior week</span>;
  }

  return (
    <tr className="text-gray-700 dark:text-gray-300">
      <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{label}</td>
      <td className="px-5 py-3 text-right tabular-nums font-semibold">
        {current != null ? format(current) : <span className="text-gray-400">Pending</span>}
      </td>
      <td className="px-5 py-3 text-right">{deltaCell}</td>
      <td className="px-5 py-3 text-right tabular-nums text-gray-500">
        {prior != null ? format(prior) : <span className="text-gray-400">—</span>}
      </td>
      <td className="px-5 py-3 text-xs">
        {source === "Auto" ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            Auto
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Manual
          </span>
        )}
      </td>
    </tr>
  );
}

/**
 * Generate insights dynamically from the data each render.
 * Returns an array of {severity, title, body} objects.
 */
function generateInsights(data: any): Array<{ severity: "good" | "warn" | "alert" | "info"; title: string; body: string }> {
  const out: Array<{ severity: "good" | "warn" | "alert" | "info"; title: string; body: string }> = [];

  // 1) Email-list movement
  if (data.weeklyChange < 0) {
    const dropPct = data.lastWeekTotal > 0 ? ((Math.abs(data.weeklyChange) / data.lastWeekTotal) * 100).toFixed(2) : "—";
    out.push({
      severity: data.weeklyChange < -100 ? "alert" : "warn",
      title: `List shrunk by ${Math.abs(data.weeklyChange).toLocaleString()} this week (${dropPct}%)`,
      body: `${data.lastWeekTotal.toLocaleString()} contacts last week → ${data.totalEngaged.toLocaleString()} now. Net loss usually means unsubscribes outpaced new signups.`,
    });
  } else if (data.weeklyChange > 0) {
    out.push({
      severity: "good",
      title: `List grew by ${data.weeklyChange.toLocaleString()} this week`,
      body: `${data.lastWeekTotal.toLocaleString()} contacts last week → ${data.totalEngaged.toLocaleString()} now. New signups outpaced unsubscribes.`,
    });
  }

  // 2) Unsubscribe-reason theme detection (only when the user has captured them)
  const reasonsRaw: string = data.emailMetrics?.unsubscribe_reasons || "";
  if (reasonsRaw.trim()) {
    const reasons = reasonsRaw.split(/\n+/).map((r: string) => r.trim()).filter(Boolean);
    const tooManyRe = /too many|too often|spam|flood|every day|daily|frequen|overwhelming/i;
    const duplicateRe = /already|duplicate|other (account|email)/i;
    const priceRe = /afford|too expensive|cost|price|money/i;
    const timeRe = /no time|busy|don't have time/i;

    const matches = {
      "Email frequency": reasons.filter((r: string) => tooManyRe.test(r)).length,
      "Duplicate signup": reasons.filter((r: string) => duplicateRe.test(r)).length,
      "Pricing / can't afford": reasons.filter((r: string) => priceRe.test(r)).length,
      "Lack of time": reasons.filter((r: string) => timeRe.test(r)).length,
    };
    const top = Object.entries(matches).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] > 0) {
      const pct = Math.round((top[1] / reasons.length) * 100);
      const messages: Record<string, string> = {
        "Email frequency": `${pct}% of write-in unsubscribers (${top[1]} of ${reasons.length}) cite frequency. Worth testing reduced cadence or a preference center.`,
        "Duplicate signup": `${pct}% (${top[1]} of ${reasons.length}) say they're already subscribed under another email. May indicate list hygiene + dedupe is needed.`,
        "Pricing / can't afford": `${pct}% (${top[1]} of ${reasons.length}) cite pricing. Consider a low-tier or content-only segment.`,
        "Lack of time": `${pct}% (${top[1]} of ${reasons.length}) cite time. Shorter or summary-style emails may help retention.`,
      };
      out.push({
        severity: pct >= 50 ? "alert" : "warn",
        title: `Top unsubscribe theme: ${top[0]}`,
        body: messages[top[0]] || "",
      });
    }
  }

  // 3) Top lead magnet of the week
  const topMagnet = [...data.leadMagnetCounts].sort((a: any, b: any) => b.count - a.count)[0];
  if (topMagnet && topMagnet.count > 0) {
    const totalFromMagnets = data.leadMagnetCounts.reduce((s: number, r: any) => s + r.count, 0);
    const pct = totalFromMagnets > 0 ? Math.round((topMagnet.count / totalFromMagnets) * 100) : 0;
    out.push({
      severity: "info",
      title: `Top lead magnet: ${topMagnet.label.replace(/^Lead Magnet:\s*/, "")}`,
      body: `${topMagnet.count} new contacts (${pct}% of all lead-magnet signups in window).`,
    });
  }

  // 4) Email rate context (only if rates entered)
  const m = data.emailMetrics;
  if (m?.open_rate != null) {
    if (m.open_rate < 0.20) {
      out.push({ severity: "alert", title: `Open rate ${fmtPct(m.open_rate)} is below typical benchmark`, body: "Education / health niches typically see 25–45%. Consider re-engagement campaign or list cleanup." });
    } else if (m.open_rate < 0.30) {
      out.push({ severity: "warn", title: `Open rate ${fmtPct(m.open_rate)} is below median`, body: "Subject-line testing may help." });
    } else if (m.open_rate > 0.40) {
      out.push({ severity: "good", title: `Open rate ${fmtPct(m.open_rate)} is strong`, body: "Above the 30–35% median for educational lists." });
    }
  }
  if (m?.complaint_rate != null && m.complaint_rate > 0.001) {
    out.push({
      severity: m.complaint_rate > 0.005 ? "alert" : "warn",
      title: `Complaint rate ${fmtPct(m.complaint_rate, 3)}`,
      body: m.complaint_rate > 0.005
        ? "Above 0.5% — risks deliverability. Investigate which sends generated complaints."
        : "Above 0.1% — keep an eye on this; the threshold for problems is around 0.5%.",
    });
  }

  // 5) Unmapped lead sources signal
  if (data.unknownSources.length > 0) {
    const total = data.unknownSources.reduce((s: number, u: any) => s + u.count, 0);
    out.push({
      severity: "info",
      title: `${data.unknownSources.length} unmapped lead-source ID${data.unknownSources.length === 1 ? "" : "s"} this week (${total} contact${total === 1 ? "" : "s"})`,
      body: "Add labels in src/lib/weekly-report-config.ts so they roll up correctly in future reports.",
    });
  }

  return out;
}

export const metadata = { title: "Weekly Report — Z-Health Portal" };

export default async function WeeklyReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await loadReportData(searchParams);
  // Latest record + previous record for week-over-week delta math
  const m = data.emailMetricsHistory[0] || null;
  const prev = data.emailMetricsHistory[1] || null;
  const insights = generateInsights({ ...data, emailMetrics: m, prevEmailMetrics: prev });
  const updatedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const reasonsRaw: string = m?.unsubscribe_reasons || "";
  const reasons = reasonsRaw ? reasonsRaw.split(/\n+/).map((r: string) => r.trim()).filter(Boolean) : [];

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Weekly Report
          </h1>
          <div className="flex items-center gap-3">
            <DateRangePicker />
            <span className="text-xs text-gray-400 dark:text-gray-500">{updatedAt} PT</span>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
          Auto-pulled from Keap on each visit. {data.range.label.toLowerCase()} — {data.newContactsTotal.toLocaleString()} new contacts in window.
        </p>
      </header>

      {/* ===== INSIGHTS — dynamic, regenerated each render ===== */}
      {insights.length > 0 && (
        <Section title="What stands out this report" description="Computed live from current data — wording changes as the numbers do.">
          <InsightGrid>
            {insights.map((i, idx) => (
              <Insight key={idx} severity={i.severity} title={i.title}>
                {i.body}
              </Insight>
            ))}
          </InsightGrid>
        </Section>
      )}

      {/* ===== UPCOMING EVENTS ===== */}
      <Section
        title="Upcoming Events"
        description="Auto-pulled from Keap registration tags. Add an attendedTagId in config when an event has happened to show attendance."
      >
        <Card padded={false}>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="px-5 py-3">Event</th>
                <th className="px-5 py-3 text-right">Registered</th>
                <th className="px-5 py-3 text-right">Attended</th>
                <th className="px-5 py-3 text-xs font-mono text-gray-400">Tag IDs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {data.events.map((e: any) => (
                <tr key={e.registeredTagId} className="text-gray-700 dark:text-gray-300">
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{e.label}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{e.registered.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {e.attended != null ? e.attended.toLocaleString() : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-400">
                    reg: {e.registeredTagId}
                    {e.attendedTagId ? ` · att: ${e.attendedTagId}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      {/* ===== EMAIL STUFF ===== */}
      <Section
        title="Email Performance"
        description="Auto-pulled where possible. Click / open / complaint rates are not in Keap's REST API — manual entry until webhook integration is built. Once you've saved metrics for two weeks, weekly change will compute automatically."
      >
        {/* Spreadsheet-style table: Metric | TOTAL | WEEKLY CHANGE | LAST WEEK | SOURCE */}
        <Card padded={false}>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="px-5 py-3">Metric</th>
                <th className="px-5 py-3 text-right">Total / Current</th>
                <th className="px-5 py-3 text-right">Weekly Change</th>
                <th className="px-5 py-3 text-right">Last Week</th>
                <th className="px-5 py-3 text-xs">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              <MetricRow
                label="Total Engaged Email List"
                current={data.totalEngaged}
                prior={data.lastWeekTotal}
                format={(n) => n.toLocaleString()}
                source="Auto"
              />
              <MetricRow
                label="Email Click Rate (last 7 days)"
                current={m?.click_rate ?? null}
                prior={prev?.click_rate ?? null}
                format={(n) => fmtPct(n, 2)}
                isPercent
                source="Manual"
              />
              <MetricRow
                label="Email Open Rate (last 7 days)"
                current={m?.open_rate ?? null}
                prior={prev?.open_rate ?? null}
                format={(n) => fmtPct(n, 2)}
                isPercent
                source="Manual"
              />
              <MetricRow
                label="Email Complaint Rate"
                current={m?.complaint_rate ?? null}
                prior={prev?.complaint_rate ?? null}
                format={(n) => fmtPct(n, 3)}
                isPercent
                source="Manual"
                higherIsWorse
              />
            </tbody>
          </table>
        </Card>

        {/* Unsubscribes split: all-time auto-pulled from tag, 30-day delta + reasons manual */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Total Unsubs (all-time)
            </div>
            <div className="mt-2 text-5xl font-semibold tracking-tight text-rose-700 dark:text-rose-400">
              {data.totalUnsubsAllTime.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
              Tag #{SYSTEM_TAGS.optedOut} · Auto-pulled
            </div>
          </Card>

          <Card>
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Unsubs (last 30 days)
            </div>
            <div className="mt-2 text-5xl font-semibold tracking-tight text-rose-700 dark:text-rose-400">
              {m?.unsubscribes_30d != null ? m.unsubscribes_30d.toLocaleString() : "Pending"}
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
              {m?.week_of ? `As of ${m.week_of} · Manual` : "Update via form below"}
            </div>
          </Card>

          <Card>
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Unsub Rate (last 30 days)
            </div>
            <div className="mt-2 text-5xl font-semibold tracking-tight text-rose-700 dark:text-rose-400">
              {m?.unsubscribes_30d != null && data.totalEngaged > 0
                ? fmtPct(m.unsubscribes_30d / data.totalEngaged, 2)
                : "—"}
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
              30d unsubs ÷ current list size
            </div>
          </Card>
        </div>

        {/* Verbatim unsubscribe reasons */}
        {reasons.length > 0 && (
          <div className="mt-6">
            <Card>
              <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                What unsubscribers said ({reasons.length} write-in responses)
              </div>
              <ul className="max-h-72 space-y-2 overflow-y-auto text-sm text-gray-700 dark:text-gray-300">
                {reasons.map((r: string, i: number) => {
                  const isFreq = /too many|too often|spam|flood|every day|daily|frequen|overwhelming/i.test(r);
                  return (
                    <li
                      key={i}
                      className={[
                        "rounded-md border-l-2 py-1 pl-3",
                        isFreq ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20" : "border-gray-200 dark:border-white/10",
                      ].join(" ")}
                    >
                      &ldquo;{r}&rdquo;
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        )}

        <div className="mt-6">
          <EmailMetricsForm initial={m} />
        </div>
      </Section>

      {/* ===== NEW LEADS ===== */}
      <Section
        title="New Leads"
        description={`Auto-derived from new Keap contacts in window (${data.newContactsTotal.toLocaleString()} total). Each row counts contacts created in window with the matching tag or lead_source_id.`}
      >
        <Card padded={false}>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200/70 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3 text-right">Count</th>
                <th className="px-5 py-3 text-xs font-mono text-gray-400">Mapping</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {data.leadMagnetCounts
                .sort((a: any, b: any) => b.count - a.count)
                .map((r: any) => (
                  <tr key={`tag-${r.tagId}`} className="text-gray-700 dark:text-gray-300">
                    <td className="px-5 py-3 text-gray-900 dark:text-gray-100">{r.label}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{r.count}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-400">tag {r.tagId}</td>
                  </tr>
                ))}
              {data.leadSourceCounts
                .sort((a: any, b: any) => b.count - a.count)
                .map((r: any) => (
                  <tr key={`src-${r.sourceId}`} className="text-gray-700 dark:text-gray-300">
                    <td className="px-5 py-3 text-gray-900 dark:text-gray-100">{r.label}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{r.count}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-400">source {r.sourceId}</td>
                  </tr>
                ))}
              <tr className="bg-gray-50/50 font-semibold dark:bg-white/[0.02]">
                <td className="px-5 py-3 text-gray-900 dark:text-gray-100">Grand Total</td>
                <td className="px-5 py-3 text-right tabular-nums">{data.grandTotalLeads}</td>
                <td className="px-5 py-3 text-xs text-gray-400">tag rows + source rows</td>
              </tr>
            </tbody>
          </table>
        </Card>

        {data.unknownSources.length > 0 && (
          <Card className="mt-4 border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Unmapped lead-source IDs in this window
            </div>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
              These IDs appeared on new contacts but aren&apos;t in the report config. Add labels in{" "}
              <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs dark:bg-amber-900/40">
                src/lib/weekly-report-config.ts
              </code>
              :
            </p>
            <ul className="mt-2 ml-5 list-disc text-xs text-amber-900 dark:text-amber-200">
              {data.unknownSources.map((u: any) => (
                <li key={u.sourceId}>
                  source <strong>{u.sourceId}</strong> — {u.count} contact{u.count === 1 ? "" : "s"} in window
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Section>

      <Section
        title="Data sources"
        description="What's auto-pulled vs. requires manual entry."
      >
        <Card>
          <ul className="ml-5 list-disc space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>
              <strong className="text-emerald-700 dark:text-emerald-400">Auto-pulled from Keap REST:</strong>{" "}
              total contacts (engaged-list proxy), week-ago contact total, all-time unsubscriber tag count, upcoming-event registration counts, new contacts in window with their tags + lead_source_id.
            </li>
            <li>
              <strong className="text-amber-700 dark:text-amber-400">Manual entry (Keap REST v1 doesn&apos;t expose):</strong>{" "}
              email open rate, click rate, complaint rate, 30-day unsubscribe count, unsubscribe write-in reasons. The form below saves to Supabase and displays here.
            </li>
            <li>
              <strong>Insight verbiage</strong> — generated live each render from current data. The wording will change as the underlying numbers change.
            </li>
            <li>
              <strong>Next step to fully automate:</strong> set up Keap webhooks to capture <code>contact.add</code>, <code>email.opened</code>, <code>email.clicked</code>, and unsubscribe events into Supabase. Then we can compute open/click/complaint/unsub rates ourselves without Keap admin lookups.
            </li>
          </ul>
        </Card>
      </Section>
    </main>
  );
}
