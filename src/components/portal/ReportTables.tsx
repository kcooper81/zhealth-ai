"use client";

/**
 * Per-report table wrappers around <FilterableTable>. Each one owns its
 * column definitions (which contain functions and so cannot cross the
 * RSC boundary as props from a server page).
 *
 * Server pages pass only data (plain serializable arrays); these
 * client components define how to display, sort, and filter.
 */

import FilterableTable, { type Column } from "./FilterableTable";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

// ---- Channels pivot ----------------------------------------------------

export type ChannelRow = {
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
  revenueAttributed?: boolean;
};

export function ChannelPivotTable({ rows }: { rows: ChannelRow[] }) {
  const columns: Column<ChannelRow>[] = [
    { key: "source", label: "Source", sortable: true, accessor: (c) => c.source, render: (c) => <span className="font-medium text-gray-900 dark:text-gray-100">{c.source}</span> },
    { key: "medium", label: "Medium", sortable: true, accessor: (c) => c.medium, render: (c) => <span className="text-xs">{c.medium}</span> },
    { key: "campaign", label: "Campaign", sortable: true, accessor: (c) => c.campaign, render: (c) => <span className="text-xs">{c.campaign}</span> },
    { key: "sessions", label: "Sessions", sortable: true, numeric: true, accessor: (c) => c.sessions, render: (c) => c.sessions.toLocaleString() },
    { key: "users", label: "Users", sortable: true, numeric: true, accessor: (c) => c.users, render: (c) => c.users.toLocaleString() },
    { key: "conversions", label: "Conversions", sortable: true, numeric: true, accessor: (c) => c.conversions, render: (c) => c.conversions ? c.conversions.toLocaleString() : <span className="text-gray-400">0</span> },
    {
      key: "revenue",
      label: "Revenue",
      sortable: true,
      numeric: true,
      accessor: (c) => c.revenue,
      render: (c) =>
        c.revenue > 0
          ? fmtMoney(c.revenue)
          : c.revenueAttributed
          ? <span className="text-gray-400">$0</span>
          : <span className="text-gray-300" title="No revenue could be attributed — likely missing utm_campaign on outbound links">unattributed</span>,
    },
  ];
  return (
    <FilterableTable
      rows={rows}
      rowKey={(c) => `${c.source}::${c.medium}::${c.campaign}`}
      searchableKeys={["source", "medium", "campaign"]}
      placeholder="Search source / medium / campaign…"
      maxHeight={500}
      presets={[
        { label: "Has revenue", predicate: (c) => c.revenue > 0 },
        { label: "Has conversions", predicate: (c) => c.conversions > 0 },
        { label: ">100 sessions", predicate: (c) => c.sessions > 100 },
        { label: "Direct only", predicate: (c) => c.source === "(direct)" },
      ]}
      initialSort={{ key: "sessions", dir: "desc" }}
      columns={columns}
    />
  );
}

// ---- Landing-pages funnel ----------------------------------------------

export type LandingPageFunnelRow = {
  page: string;
  link?: string;
  label: string;
  pageviews: number;
  ctaClicks: number;
  formSubmits: number;
  enrollClicks: number;
  keapTagged: number;
  hasMappedTag: boolean;
  mappedTagId?: number;
  revenue: number;
};

export function LandingPagesFunnelTable({ rows }: { rows: LandingPageFunnelRow[] }) {
  const columns: Column<LandingPageFunnelRow>[] = [
    {
      key: "label",
      label: "Page",
      sortable: true,
      accessor: (r) => r.label,
      render: (r) => {
        const cvr = r.pageviews > 0 ? (r.formSubmits / r.pageviews) * 100 : 0;
        return (
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{r.label}</div>
            <div className="text-xs text-gray-500">
              {r.hasMappedTag ? (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Mapped · tag {r.mappedTagId}
                </span>
              ) : (
                <span className="font-mono text-gray-400">{r.page}</span>
              )}
              {cvr > 0 && <span className="ml-2 text-[10px]">{cvr.toFixed(2)}% form CVR</span>}
            </div>
          </div>
        );
      },
    },
    { key: "pageviews", label: "Views", sortable: true, numeric: true, accessor: (r) => r.pageviews, render: (r) => r.pageviews.toLocaleString() },
    { key: "ctaClicks", label: "CTA", sortable: true, numeric: true, accessor: (r) => r.ctaClicks, render: (r) => r.ctaClicks.toLocaleString() },
    { key: "formSubmits", label: "Forms", sortable: true, numeric: true, accessor: (r) => r.formSubmits, render: (r) => <span className="font-semibold text-emerald-700 dark:text-emerald-400">{r.formSubmits.toLocaleString()}</span> },
    { key: "keapTagged", label: "Leads (window)", sortable: true, numeric: true, accessor: (r) => r.keapTagged, render: (r) => r.hasMappedTag ? r.keapTagged.toLocaleString() : <span className="text-gray-400">—</span> },
    { key: "enrollClicks", label: "Enroll", sortable: true, numeric: true, accessor: (r) => r.enrollClicks, render: (r) => r.enrollClicks.toLocaleString() },
    { key: "revenue", label: "Revenue", sortable: true, numeric: true, accessor: (r) => r.revenue, render: (r) => r.revenue > 0 ? fmtMoney(r.revenue) : <span className="text-gray-400">—</span> },
  ];
  return (
    <FilterableTable
      rows={rows}
      rowKey={(r) => r.page}
      searchableKeys={["label", "page"]}
      placeholder="Search by page title or URL path…"
      maxHeight={600}
      presets={[
        { label: "Mapped LPs only", predicate: (r) => r.hasMappedTag },
        { label: "Has form submits", predicate: (r) => r.formSubmits > 0 },
        { label: "Has revenue", predicate: (r) => r.revenue > 0 },
        { label: ">100 views", predicate: (r) => r.pageviews > 100 },
      ]}
      initialSort={{ key: "pageviews", dir: "desc" }}
      columns={columns}
    />
  );
}

// ---- Campaigns ---------------------------------------------------------

export type CampaignRow = {
  id: number;
  name: string;
  status: string;
  activeContacts: number;
  completedContactCount: number;
  historicalContactCount: number;
};

export function CampaignsTable({ rows }: { rows: CampaignRow[] }) {
  const columns: Column<CampaignRow>[] = [
    { key: "name", label: "Campaign", sortable: true, accessor: (c) => c.name, render: (c) => <span className="font-medium text-gray-900 dark:text-gray-100">{c.name}</span> },
    { key: "status", label: "Status", sortable: true, accessor: (c) => c.status, render: (c) => <span className="text-xs">{c.status}</span> },
    { key: "activeContacts", label: "Active", sortable: true, numeric: true, accessor: (c) => c.activeContacts, render: (c) => <span className="font-semibold">{c.activeContacts.toLocaleString()}</span> },
    { key: "completedContactCount", label: "Completed", sortable: true, numeric: true, accessor: (c) => c.completedContactCount, render: (c) => c.completedContactCount.toLocaleString() },
    { key: "historicalContactCount", label: "Lifetime reach", sortable: true, numeric: true, accessor: (c) => c.historicalContactCount, render: (c) => c.historicalContactCount.toLocaleString() },
  ];
  return (
    <FilterableTable
      rows={rows}
      rowKey={(c) => String(c.id)}
      searchableKeys={["name", "status"]}
      placeholder="Search campaign name…"
      maxHeight={600}
      presets={[
        { label: "Has active contacts", predicate: (c) => c.activeContacts > 0 },
        { label: "Empty (cleanup)", predicate: (c) => c.activeContacts === 0 },
        { label: "Published only", predicate: (c) => /publish/i.test(c.status) },
      ]}
      initialSort={{ key: "activeContacts", dir: "desc" }}
      columns={columns}
    />
  );
}

// ---- Courses -----------------------------------------------------------

export type CourseRow = {
  id: number;
  name: string;
  slug: string;
  status: string;
  price: number;
  enrollmentsAll: number;
  enrollmentsInWindow: number;
  ordersInWindow: number;
  revenueInWindow: number;
  courseViews: number;
  checkouts: number;
};

export function CoursesTable({ rows }: { rows: CourseRow[] }) {
  const columns: Column<CourseRow>[] = [
    {
      key: "name",
      label: "Course",
      sortable: true,
      accessor: (c) => c.name,
      render: (c) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{c.name}</div>
          <div className="text-xs text-gray-500">
            <span className="font-mono">{c.slug}</span>
            <span className="mx-1.5">·</span>
            <span>{c.status}</span>
            <span className="mx-1.5">·</span>
            <span>{c.enrollmentsAll.toLocaleString()} all-time enrolls</span>
          </div>
        </div>
      ),
    },
    { key: "price", label: "Price", sortable: true, numeric: true, accessor: (c) => c.price, render: (c) => c.price > 0 ? fmtMoney(c.price) : <span className="text-gray-400">—</span> },
    { key: "courseViews", label: "Views", sortable: true, numeric: true, accessor: (c) => c.courseViews, render: (c) => c.courseViews.toLocaleString() },
    { key: "checkouts", label: "Checkouts", sortable: true, numeric: true, accessor: (c) => c.checkouts, render: (c) => c.checkouts.toLocaleString() },
    { key: "ordersInWindow", label: "Orders", sortable: true, numeric: true, accessor: (c) => c.ordersInWindow, render: (c) => c.ordersInWindow.toLocaleString() },
    { key: "enrollmentsInWindow", label: "Enrolls", sortable: true, numeric: true, accessor: (c) => c.enrollmentsInWindow, render: (c) => c.enrollmentsInWindow.toLocaleString() },
    { key: "revenueInWindow", label: "Revenue", sortable: true, numeric: true, accessor: (c) => c.revenueInWindow, render: (c) => <span className="font-semibold">{c.revenueInWindow > 0 ? fmtMoney(c.revenueInWindow) : <span className="text-gray-400 font-normal">—</span>}</span> },
  ];
  return (
    <FilterableTable
      rows={rows}
      rowKey={(c) => String(c.id)}
      searchableKeys={["name", "slug", "status"]}
      placeholder="Search course name or slug…"
      maxHeight={600}
      presets={[
        { label: "Has revenue", predicate: (c) => c.revenueInWindow > 0 },
        { label: "Views but no buyers", predicate: (c) => c.courseViews > 50 && c.ordersInWindow === 0 },
        { label: "New enrolls in window", predicate: (c) => c.enrollmentsInWindow > 0 },
      ]}
      initialSort={{ key: "revenueInWindow", dir: "desc" }}
      columns={columns}
    />
  );
}

// ---- Email broadcasts --------------------------------------------------

export type EmailRow = {
  id: number;
  subject: string;
  sent_date?: string;
  inferredCampaign: string;
  emailSessions: number;
  enrollClicks: number;
  purchases: number;
  revenue: number;
};

export function EmailsTable({ rows }: { rows: EmailRow[] }) {
  const columns: Column<EmailRow>[] = [
    { key: "subject", label: "Subject", sortable: true, accessor: (e) => e.subject, render: (e) => <span className="font-medium text-gray-900 dark:text-gray-100">{e.subject}</span> },
    { key: "sent_date", label: "Sent", sortable: true, accessor: (e) => e.sent_date || "", render: (e) => <span className="text-xs">{e.sent_date ? new Date(e.sent_date).toLocaleDateString() : "—"}</span> },
    { key: "inferredCampaign", label: "Inferred campaign", sortable: true, accessor: (e) => e.inferredCampaign, render: (e) => <span className="font-mono text-xs">{e.inferredCampaign}</span> },
    { key: "emailSessions", label: "Sessions", sortable: true, numeric: true, accessor: (e) => e.emailSessions, render: (e) => e.emailSessions.toLocaleString() },
    { key: "enrollClicks", label: "Enroll clicks", sortable: true, numeric: true, accessor: (e) => e.enrollClicks, render: (e) => e.enrollClicks.toLocaleString() },
    { key: "purchases", label: "Purchases", sortable: true, numeric: true, accessor: (e) => e.purchases, render: (e) => e.purchases.toLocaleString() },
    { key: "revenue", label: "Revenue", sortable: true, numeric: true, accessor: (e) => e.revenue, render: (e) => e.revenue > 0 ? fmtMoney(e.revenue) : <span className="text-gray-400">—</span> },
  ];
  return (
    <FilterableTable
      rows={rows}
      rowKey={(e) => String(e.id)}
      searchableKeys={["subject", "inferredCampaign"]}
      placeholder="Search subject or inferred campaign…"
      maxHeight={600}
      presets={[
        { label: "Drove revenue", predicate: (e) => e.revenue > 0 },
        { label: "Drove sessions", predicate: (e) => e.emailSessions > 0 },
        { label: "Unmatched campaign", predicate: (e) => e.inferredCampaign === "(unmatched)" },
      ]}
      initialSort={{ key: "sent_date", dir: "desc" }}
      columns={columns}
    />
  );
}

// ---- Page Flow (all pages: WP + Thinkific) -----------------------------

export type PageFlowRow = {
  page: string;
  surface: "WordPress" | "Thinkific" | "Other";
  pageviews: number;
  users: number;
  sessions: number;
  entrances: number;
  exitsEst: number;
  bounceRate: number;
  engagementRate: number;
  avgDuration: number;
};

const fmtDur = (s: number) => {
  if (!s) return "0s";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m ? `${m}m ${sec}s` : `${sec}s`;
};

const surfaceBadge = (s: PageFlowRow["surface"]) => {
  const map = {
    WordPress: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    Thinkific: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    Other: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  } as const;
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[s]}`}>{s}</span>;
};

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

export function PageFlowTable({ rows }: { rows: PageFlowRow[] }) {
  const columns: Column<PageFlowRow>[] = [
    { key: "page", label: "Page", sortable: true, accessor: (r) => r.page, render: (r) => <span className="font-mono text-xs text-gray-900 dark:text-gray-100">{r.page || "(not set)"}</span> },
    { key: "surface", label: "Where", sortable: true, accessor: (r) => r.surface, render: (r) => surfaceBadge(r.surface) },
    { key: "pageviews", label: "Views", sortable: true, numeric: true, accessor: (r) => r.pageviews, render: (r) => r.pageviews.toLocaleString() },
    { key: "sessions", label: "Sessions", sortable: true, numeric: true, accessor: (r) => r.sessions, render: (r) => r.sessions.toLocaleString() },
    { key: "entrances", label: "Entrances", sortable: true, numeric: true, accessor: (r) => r.entrances, render: (r) => <span title="Sessions that started on this page">{r.entrances.toLocaleString()}</span> },
    { key: "exitsEst", label: "Exits (est)", sortable: true, numeric: true, accessor: (r) => r.exitsEst, render: (r) => <span className="text-gray-500" title="Estimated: bounced + likely last-page sessions">{r.exitsEst.toLocaleString()}</span> },
    { key: "bounceRate", label: "Bounce", sortable: true, numeric: true, accessor: (r) => r.bounceRate, render: (r) => <span className={r.bounceRate > 0.6 ? "text-rose-600 dark:text-rose-400 font-medium" : ""}>{pct(r.bounceRate)}</span> },
    { key: "engagementRate", label: "Engaged", sortable: true, numeric: true, accessor: (r) => r.engagementRate, render: (r) => <span className={r.engagementRate >= 0.7 ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>{pct(r.engagementRate)}</span> },
    { key: "avgDuration", label: "Avg time", sortable: true, numeric: true, accessor: (r) => r.avgDuration, render: (r) => fmtDur(r.avgDuration) },
  ];
  return (
    <FilterableTable
      rows={rows}
      rowKey={(r) => r.page}
      searchableKeys={["page"]}
      placeholder="Search page path…"
      maxHeight={620}
      presets={[
        { label: "WordPress", predicate: (r) => r.surface === "WordPress" },
        { label: "Thinkific", predicate: (r) => r.surface === "Thinkific" },
        { label: "Entry points", predicate: (r) => r.entrances > 0 },
        { label: "High bounce (>60%)", predicate: (r) => r.bounceRate > 0.6 && r.pageviews >= 30 },
        { label: ">100 views", predicate: (r) => r.pageviews > 100 },
      ]}
      initialSort={{ key: "pageviews", dir: "desc" }}
      columns={columns}
    />
  );
}

// ---- Landing pages (per-page conversion from the landingPage dimension) -----

export type LandingRow = {
  page: string;
  entrances: number;
  bounceRate: number;
  engagementRate: number;
  avgDuration: number;
  conversions: number;
  convRate: number;
};

const _fdur = (s: number) => { const m = Math.floor(s / 60); return m ? `${m}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`; };
const _pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function LandingTable({ rows }: { rows: LandingRow[] }) {
  const columns: Column<LandingRow>[] = [
    { key: "page", label: "Landing page", sortable: true, accessor: (r) => r.page, render: (r) => <span className="font-mono text-xs text-gray-900 dark:text-gray-100">{r.page || "(not set)"}</span> },
    { key: "entrances", label: "Entrances", sortable: true, numeric: true, accessor: (r) => r.entrances, render: (r) => <span title="Sessions that started on this page">{r.entrances.toLocaleString()}</span> },
    { key: "bounceRate", label: "Bounce", sortable: true, numeric: true, accessor: (r) => r.bounceRate, render: (r) => <span className={r.bounceRate > 0.6 ? "text-rose-600 dark:text-rose-400 font-medium" : ""}>{_pct(r.bounceRate)}</span> },
    { key: "engagementRate", label: "Engaged", sortable: true, numeric: true, accessor: (r) => r.engagementRate, render: (r) => <span className={r.engagementRate >= 0.7 ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>{_pct(r.engagementRate)}</span> },
    { key: "avgDuration", label: "Avg time", sortable: true, numeric: true, accessor: (r) => r.avgDuration, render: (r) => _fdur(r.avgDuration) },
    { key: "conversions", label: "Conversions", sortable: true, numeric: true, accessor: (r) => r.conversions, render: (r) => r.conversions ? <span className="font-medium text-emerald-700 dark:text-emerald-300">{Math.round(r.conversions).toLocaleString()}</span> : <span className="text-gray-400">0</span> },
    { key: "convRate", label: "Conv. rate", sortable: true, numeric: true, accessor: (r) => r.convRate, render: (r) => r.convRate ? `${(r.convRate * 100).toFixed(2)}%` : <span className="text-gray-400">—</span> },
  ];
  return (
    <FilterableTable
      rows={rows}
      rowKey={(r) => r.page}
      searchableKeys={["page"]}
      placeholder="Search landing page path…"
      maxHeight={620}
      presets={[
        { label: "Converted", predicate: (r) => r.conversions > 0 },
        { label: "High bounce (>60%)", predicate: (r) => r.bounceRate > 0.6 && r.entrances >= 20 },
        { label: "Well-engaged (>70%)", predicate: (r) => r.engagementRate >= 0.7 },
        { label: ">50 entrances", predicate: (r) => r.entrances > 50 },
      ]}
      initialSort={{ key: "entrances", dir: "desc" }}
      columns={columns}
    />
  );
}
