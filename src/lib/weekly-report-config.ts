/**
 * Configuration for the auto-generated Weekly Report at /portal/reports/weekly.
 *
 * Maps human-readable report rows to underlying Keap tag IDs and lead-source IDs.
 * Adjust as new lead magnets / events / sources are added in Keap.
 *
 * To find a tag ID: portal → Keap CRM → Tag counts tab, search by name, ID is in the row.
 * To find a lead source ID: it's not exposed by name via the Keap API. Look at recent
 * contacts created in the last 14 days and group by `lead_source_id` — the most common
 * IDs are your top sources. Then check Keap admin to map ID → name and update below.
 */

export type LeadSourceTagRow = {
  /** Display label on the report */
  label: string;
  /** Keap tag ID — count contacts with this tag created in the period */
  tagId: number;
};

export type LeadSourceIdRow = {
  /** Display label on the report */
  label: string;
  /** Keap lead_source_id (numeric, no name lookup available) */
  sourceId: number;
};

export type UpcomingEventRow = {
  /** Display label on the report */
  label: string;
  /** Tag ID applied to contacts who registered for this event */
  registeredTagId: number;
  /** Optional tag ID for contacts who attended (if separately tracked) */
  attendedTagId?: number;
};

/**
 * Upcoming events to surface in the report.
 * Update each month as old events end and new ones are scheduled.
 */
export const UPCOMING_EVENTS: UpcomingEventRow[] = [
  { label: "2026 April BBPG QA", registeredTagId: 6687 },
  { label: "2026 May BBPG QA", registeredTagId: 6707 },
];

/**
 * Lead-magnet rows on the "New Leads Last 7 Days" section.
 * Each maps a report row to a Keap tag — we count contacts with that tag
 * created in the lookback window.
 */
export const LEAD_MAGNET_ROWS: LeadSourceTagRow[] = [
  { label: "Lead Magnet: The Brain-First Movement Code (Thinkific)", tagId: 6499 },
  { label: "Lead Magnet: 2026 April 16 Free Webinar: Pain Neuroscience Made Practical REPLAY SIGNUP", tagId: 6705 },
  { label: "Lead Magnet: 2026 April 16 Free Webinar: Pain Neuroscience Made Practical SIGNUP", tagId: 6685 },
  { label: "Lead Magnet: Weekly Blog: Footer", tagId: 5979 },
  { label: "Lead Magnet: NeuroFundamentals E-Book", tagId: 5035 },
  { label: "Lead Magnet: Weekly Blog: Pop-Up", tagId: 5889 },
];

/**
 * Tag IDs for things that can be auto-pulled but aren't lead-magnet rows.
 */
export const SYSTEM_TAGS = {
  /** "Activity - Opt Out of all emails" — auto-applied when a contact unsubscribes */
  optedOut: 4993,
};

/**
 * Lead source ID rows on the "New Leads Last 7 Days" section.
 * Names ARE NOT exposed by the Keap API. Map IDs to your team's labels here.
 *
 * To discover IDs: create a fresh test contact via each form/funnel and check
 * what lead_source_id Keap assigns. Or look at the IDs most-frequent on recent
 * contacts and ask the Keap admin user which is which.
 *
 * Currently observed in last 14 days:
 *   4879 — most frequent (~31 contacts)
 *   3985 — second
 *   237  — minor
 *
 * Update the labels below once these are confirmed.
 */
export const LEAD_SOURCE_ID_ROWS: LeadSourceIdRow[] = [
  { label: "Source 4879 (most active — confirm name in Keap admin)", sourceId: 4879 },
  { label: "Source 3985 (confirm name in Keap admin)", sourceId: 3985 },
  { label: "Source 237 (confirm name in Keap admin)", sourceId: 237 },
];
