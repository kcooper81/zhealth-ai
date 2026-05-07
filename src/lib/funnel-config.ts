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
