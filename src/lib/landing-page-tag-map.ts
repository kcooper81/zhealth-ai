/**
 * Landing-page → Keap-tag attribution map.
 *
 * For every landing page that captures emails, tell us which Keap tag the
 * lead gets. The Landing Pages and Channels reports join GA4 pageview/event
 * volume on this list to attribute Keap signups back to the source page.
 *
 * Path is matched as a prefix (so /lower-back also catches /lower-back?utm_*).
 * Add new rows here when launching a new landing page.
 */

export type LandingPageTagRow = {
  /** WP path the GA4 pagePath dimension reports (e.g. "/lower-back/"). Compared as prefix. */
  path: string;
  /** Friendly label shown in the report. */
  label: string;
  /** Keap tag applied to leads that submit the form on this landing page. */
  tagId: number;
  /** Optional Keap lead_source_id this LP correlates to. */
  leadSourceId?: number;
  /** Optional Thinkific course-slug or product the LP promotes (so we can attribute purchases). */
  thinkificCourseSlug?: string;
  /** Optional UTM campaign name we use in outbound link tagging. */
  utmCampaign?: string;
};

export const LANDING_PAGE_TAG_MAP: LandingPageTagRow[] = [
  {
    path: "/lower-back",
    label: "Low Back BBPG landing",
    tagId: 6499,
    thinkificCourseSlug: "low-back-bbpg",
    utmCampaign: "lower-back-2026",
  },
  {
    path: "/free-webinar",
    label: "Free Webinar — live signup",
    tagId: 6685,
    utmCampaign: "free-webinar-live",
  },
  {
    path: "/free-webinar-replay",
    label: "Free Webinar — replay signup",
    tagId: 6705,
    utmCampaign: "free-webinar-replay",
  },
  {
    path: "/blog",
    label: "Weekly blog footer",
    tagId: 5979,
    utmCampaign: "weekly-blog",
  },
  {
    path: "/neurofundamentals",
    label: "NeuroFundamentals e-book",
    tagId: 5035,
    utmCampaign: "neurofundamentals",
  },
];

/**
 * Best-effort lookup: returns the matching row for a given pagePath.
 */
export function findLandingPageRow(pagePath: string): LandingPageTagRow | null {
  if (!pagePath) return null;
  const normalized = pagePath.replace(/\/+$/, "").toLowerCase();
  for (const row of LANDING_PAGE_TAG_MAP) {
    const rowPath = row.path.replace(/\/+$/, "").toLowerCase();
    if (normalized === rowPath || normalized.startsWith(rowPath + "/") || normalized.startsWith(rowPath + "?")) {
      return row;
    }
  }
  return null;
}
