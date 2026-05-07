/**
 * Funnel definitions for /portal/reports/funnels.
 *
 * Each funnel is a sequence of GA4 events filtered by pagePath where useful.
 * Conversion rate at each step is computed as users(step_n) / users(step_0).
 *
 * Add new funnels here when you launch a new flow you want to monitor.
 */

export type FunnelStep = {
  name: string;
  /** GA4 eventName to count. Common: page_view, cta_click, form_submit, enroll_click, begin_checkout, purchase */
  eventName: string;
  /** Optional pagePath prefix filter — narrows the event to a specific landing page or section. */
  pageMatch?: string;
};

export type FunnelDefinition = {
  id: string;
  label: string;
  description: string;
  /** "website" | "lms" — which GA4 property to query. */
  property: "website" | "lms";
  steps: FunnelStep[];
};

/**
 * Catalog of events the user can choose from when building a custom funnel.
 * Anything fired by the WP/Thinkific tracking snippet is on this list.
 */
export const FUNNEL_EVENT_CATALOG: Array<{ value: string; label: string; description: string }> = [
  { value: "page_view",      label: "Page view",         description: "GA4 baseline pageview event." },
  { value: "session_start",  label: "Session start",     description: "First event of a new session." },
  { value: "cta_click",      label: "CTA click",         description: "Click on any .elementor-button, .cta, or [data-cta] element." },
  { value: "form_submit",    label: "Form submit",       description: "Any <form> submit on the page." },
  { value: "outbound_click", label: "Outbound click",    description: "Click on any external-domain link." },
  { value: "enroll_click",   label: "Enroll click",      description: "Click on a courses.zhealtheducation.com / .thinkific.com link." },
  { value: "course_view",    label: "Course view (LMS)", description: "Visit to /courses/<slug> on Thinkific." },
  { value: "begin_checkout", label: "Begin checkout",    description: "Checkout / enroll / buy URL on Thinkific." },
  { value: "sign_up_view",   label: "Sign-up view",      description: "Account creation page on Thinkific." },
  { value: "purchase",       label: "Purchase",          description: "Order-completed thank-you page on Thinkific." },
];

/**
 * The default custom-funnel template applied when a user picks an entry
 * page but doesn't specify their own steps. Goes from awareness → action.
 */
export const DEFAULT_CUSTOM_STEPS: FunnelStep[] = [
  { name: "Page view",       eventName: "page_view" },        // pageMatch added by builder
  { name: "CTA click",       eventName: "cta_click" },        // pageMatch added by builder
  { name: "Form submit",     eventName: "form_submit" },      // pageMatch added by builder
  { name: "Enroll click",    eventName: "enroll_click" },
  { name: "Began checkout",  eventName: "begin_checkout" },
  { name: "Purchased",       eventName: "purchase" },
];

/**
 * Build a custom FunnelDefinition for a chosen entry page.
 *
 * The first three step types (page_view / cta_click / form_submit) get the
 * entry path applied as a `pageMatch` filter so they only count activity ON
 * that LP. Downstream steps (enroll_click → checkout → purchase) intentionally
 * have no page filter — they fire wherever the user ends up next.
 */
export function buildFunnelFromEntry(opts: {
  entryPath: string;
  /** Optional event names to use, in order. Defaults to DEFAULT_CUSTOM_STEPS. */
  eventNames?: string[];
  property?: "website" | "lms";
  label?: string;
}): FunnelDefinition {
  const { entryPath, property = "website" } = opts;
  const events = opts.eventNames && opts.eventNames.length > 0 ? opts.eventNames : DEFAULT_CUSTOM_STEPS.map((s) => s.eventName);

  // Events that should be scoped to the entry page (vs anywhere on site)
  const onPageEvents = new Set(["page_view", "session_start", "cta_click", "form_submit", "outbound_click"]);

  const steps: FunnelStep[] = events.map((ev) => {
    const cataloged = FUNNEL_EVENT_CATALOG.find((c) => c.value === ev);
    return {
      name: cataloged?.label || ev,
      eventName: ev,
      pageMatch: onPageEvents.has(ev) ? entryPath : undefined,
    };
  });

  return {
    id: `custom-${entryPath.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "root"}`,
    label: opts.label || `Custom funnel — ${entryPath}`,
    description: `Visitors who hit ${entryPath}, then progressed through the chosen events.`,
    property,
    steps,
  };
}

export const FUNNELS: FunnelDefinition[] = [
  {
    id: "lower-back",
    label: "Lower Back BBPG — landing → enroll",
    description: "Visitors who hit /lower-back, clicked an enroll button, started checkout on Thinkific, and bought.",
    property: "website",
    steps: [
      { name: "Landed on /lower-back", eventName: "page_view", pageMatch: "/lower-back" },
      { name: "Clicked a CTA on the page", eventName: "cta_click", pageMatch: "/lower-back" },
      { name: "Clicked an enroll link", eventName: "enroll_click", pageMatch: "/lower-back" },
      { name: "Began Thinkific checkout", eventName: "begin_checkout" },
      { name: "Purchased", eventName: "purchase" },
    ],
  },
  {
    id: "free-webinar",
    label: "Free Webinar — landing → signup → enroll",
    description: "Visitors to the free-webinar landing page who signed up, then later purchased a paid course.",
    property: "website",
    steps: [
      { name: "Landed on /free-webinar", eventName: "page_view", pageMatch: "/free-webinar" },
      { name: "Submitted signup form", eventName: "form_submit", pageMatch: "/free-webinar" },
      { name: "Returned via email link", eventName: "session_start" },
      { name: "Began Thinkific checkout", eventName: "begin_checkout" },
      { name: "Purchased", eventName: "purchase" },
    ],
  },
  {
    id: "blog-newsletter",
    label: "Blog → newsletter → course",
    description: "Blog readers who signed up via the footer/popup, were nurtured by email, and bought.",
    property: "website",
    steps: [
      { name: "Read a blog post", eventName: "page_view", pageMatch: "/blog" },
      { name: "Signed up for newsletter", eventName: "form_submit", pageMatch: "/blog" },
      { name: "Visited a course page", eventName: "course_view" },
      { name: "Purchased", eventName: "purchase" },
    ],
  },
  {
    id: "course-direct",
    label: "Direct course-page funnel",
    description: "Visitors who landed directly on a Thinkific course page (no blog or LP) and bought.",
    property: "lms",
    steps: [
      { name: "Course page viewed", eventName: "course_view" },
      { name: "Began checkout", eventName: "begin_checkout" },
      { name: "Purchased", eventName: "purchase" },
    ],
  },
];
