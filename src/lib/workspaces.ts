import type { Workspace, WorkspaceConfig } from "./types";

export const WORKSPACES: WorkspaceConfig[] = [
  {
    id: "all",
    name: "All Services",
    description: "Universal assistant",
    icon: "Sparkles",
    color: "#2c8df3",
  },
  {
    id: "website",
    name: "Z-Health Website",
    description: "WordPress, Elementor, SEO",
    icon: "Globe",
    color: "#10b981",
  },
  {
    id: "crm",
    name: "Z-Health CRM",
    description: "Keap contacts, tags, pipeline",
    icon: "Users",
    color: "#f59e0b",
  },
  {
    id: "analytics",
    name: "Analytics",
    description: "Traffic, performance, insights",
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
      return ["List pages", "Create page", "SEO audit", "Clear cache"];
    case "crm":
      return ["List contacts", "Tag breakdown", "Pipeline status", "Recent orders"];
    case "analytics":
      return ["Top pages this week", "Traffic overview", "Bounce rate issues"];
    case "all":
    default:
      return ["What can I do?", "Show status overview"];
  }
}

export function getSystemPromptAddendum(workspace: Workspace): string {
  switch (workspace) {
    case "website":
      return `\n\nWorkspace context: The user is working in the Z-Health Website workspace. Focus on WordPress management tasks including pages, posts, Elementor page building, SEO optimization, media management, and WooCommerce. Prioritize website-related capabilities in your responses.`;
    case "crm":
      return `\n\nWorkspace context: The user is working in the Z-Health CRM workspace. Focus on Keap/Infusionsoft CRM management including contacts, tags, campaigns, pipeline management, and order tracking. Prioritize CRM-related capabilities in your responses.`;
    case "analytics":
      return `\n\nWorkspace context: The user is working in the Analytics workspace. Focus on Google Analytics, Microsoft Clarity, site performance metrics, traffic analysis, bounce rates, conversion tracking, and data-driven insights. Prioritize analytics-related capabilities in your responses.`;
    case "all":
    default:
      return `\n\nWorkspace context: The user is in the All Services workspace. You have access to all capabilities across WordPress, CRM, and Analytics. Route requests to the appropriate service automatically based on the user's intent.`;
  }
}
