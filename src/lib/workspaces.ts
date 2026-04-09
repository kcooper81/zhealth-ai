import type { Workspace, WorkspaceConfig } from "./types";

export const WORKSPACES: WorkspaceConfig[] = [
  {
    id: "all",
    name: "All Services",
    description: "Universal assistant for your whole business",
    icon: "Sparkles",
    color: "#2c8df3",
  },
  {
    id: "website",
    name: "Z-Health Website",
    description: "Pages, SEO, content, WooCommerce",
    icon: "Globe",
    color: "#10b981",
  },
  {
    id: "crm",
    name: "Z-Health CRM",
    description: "Contacts, tags, campaigns, pipeline",
    icon: "Users",
    color: "#f59e0b",
  },
  {
    id: "lms",
    name: "Z-Health LMS",
    description: "Courses, students, enrollments",
    icon: "GraduationCap",
    color: "#ec4899",
  },
  {
    id: "analytics",
    name: "Analytics",
    description: "Traffic, performance, conversions",
    icon: "BarChart",
    color: "#8b5cf6",
  },
];

export function getWorkspace(id: Workspace): WorkspaceConfig {
  return WORKSPACES.find((w) => w.id === id) || WORKSPACES[0];
}

export function getQuickActions(workspace: Workspace): string[] {
  switch (workspace) {
    case "website":
      return [
        "List all pages and their status",
        "Create a new landing page",
        "Run an SEO audit on the site",
        "Show me all draft pages",
        "Update pricing on a page",
        "Duplicate a page for a new campaign",
      ];
    case "crm":
      return [
        "How many contacts do we have?",
        "Show tag breakdown with counts",
        "Pull a revenue report for this month",
        "Find all contacts tagged R-Phase",
        "Show pipeline status",
        "Who are our newest contacts?",
      ];
    case "lms":
      return [
        "Show all courses and enrollment counts",
        "LMS overview stats",
        "Which courses have the best completion rates?",
        "Show recent enrollments",
        "Create a 20% off coupon code",
        "How many active students do we have?",
      ];
    case "analytics":
      return [
        "What are our top pages this week?",
        "Show traffic overview",
        "Which pages have the highest bounce rate?",
        "Compare traffic this week vs last week",
        "What are our top referral sources?",
        "Show conversion funnel",
      ];
    case "all":
    default:
      return [
        "Give me an overview of everything",
        "What needs attention today?",
        "Show me a weekly business report",
        "What campaigns are running?",
      ];
  }
}

export function getSystemPromptAddendum(workspace: Workspace): string {
  switch (workspace) {
    case "website":
      return `

WORKSPACE: Z-Health Website (WordPress)
The user is a marketing team member managing the Z-Health Education website (zhealtheducation.com).
They use this workspace to:
- Create and edit landing pages, sales pages, and blog posts
- Manage page content using Elementor page builder
- Optimize SEO (meta titles, descriptions, keywords via Yoast)
- Manage WooCommerce products and pricing
- Upload and organize media (images, PDFs)
- Publish, schedule, and manage page status
- Clear site cache after updates
- Duplicate pages for new campaigns

When they ask to "create a page" they mean a WordPress page with professional marketing copy.
When they ask to "update pricing" they mean changing prices on an existing sales/product page.
When they ask about "SEO" they mean Yoast SEO meta fields.
Always confirm before making changes to live/published pages.
Do NOT show code or HTML — describe changes in plain marketing language.`;

    case "crm":
      return `

WORKSPACE: Z-Health CRM (Keap/Infusionsoft)
The user is a marketing team member managing customer relationships via Keap.
They use this workspace to:
- Search and view contact records
- Apply and remove tags (used for segmentation and automation triggers)
- View the sales pipeline and move opportunities between stages
- Check order history and revenue
- Add contacts to campaign sequences (email automations)
- Pull reports: tag breakdown, revenue, contact growth
- Send targeted emails

Common tasks include:
- "Tag everyone who purchased X" — apply a tag to contacts
- "How many people are in the R-Phase tag?" — count contacts with a specific tag
- "Show me revenue this month" — pull order report
- "Add this contact to the welcome sequence" — campaign management
- "Who signed up this week?" — recent contacts report

Always use plain business language. Never show raw API data — format it as readable summaries, tables, or lists.`;

    case "lms":
      return `

WORKSPACE: Z-Health LMS (Thinkific)
The user is a marketing team member managing the Z-Health online learning platform at courses.zhealtheducation.com.
They use this workspace to:
- View all courses and their enrollment numbers
- Check course completion rates
- Search for students by name or email
- Enroll students in courses manually
- Create and manage coupon/promo codes for campaigns
- View order/purchase history
- Monitor LMS health (active students, recent enrollments)
- Create student accounts

Common tasks include:
- "How many people are enrolled in R-Phase?" — enrollment count for a course
- "Create a 30% off coupon for the March sale" — promo code creation
- "Show completion rates for all courses" — course performance report
- "Enroll john@example.com in I-Phase" — manual enrollment
- "How many new students this month?" — growth report
- "What courses are most popular?" — enrollment ranking

Format responses as clear summaries. Use tables for course listings. Always confirm before enrolling students or creating coupons.`;

    case "analytics":
      return `

WORKSPACE: Analytics
The user is a marketing team member analyzing website and campaign performance.
They use this workspace to:
- Check website traffic (pageviews, sessions, users)
- Identify top-performing pages
- Find pages with high bounce rates that need improvement
- Track conversion funnels
- Compare time periods (this week vs last week, this month vs last month)
- Monitor campaign landing page performance
- Review search console data (rankings, impressions, clicks)

Present data in clear, actionable summaries. Use tables and comparisons.
Always include context: "This is up 12% from last week" or "This is your 3rd best performing page."
Suggest improvements when data shows problems (high bounce rate, low conversions).`;

    case "all":
    default:
      return `

WORKSPACE: All Services
The user is a marketing team member who may ask about anything across the business.
You have access to:
- WordPress website management (pages, SEO, WooCommerce, media)
- Keap CRM (contacts, tags, campaigns, pipeline, orders)
- Thinkific LMS (courses, students, enrollments, coupons)
- Analytics (traffic, performance, conversions)

Route requests to the appropriate service based on context:
- Questions about pages, content, SEO, products → WordPress
- Questions about contacts, tags, campaigns, pipeline → Keap CRM
- Questions about courses, students, enrollments, coupons → Thinkific LMS
- Questions about traffic, bounce rates, conversions → Analytics

When asked for an "overview" or "what needs attention", pull key metrics from all services.`;
  }
}
