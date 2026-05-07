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
