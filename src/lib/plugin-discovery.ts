export interface DiscoveredPlugin {
  slug: string;
  name: string;
  namespace: string;
  endpoints: string[];
  capabilities: string[];
}

const KNOWN_PLUGINS: Record<string, { name: string; capabilities: string[] }> = {
  "wc/v3": {
    name: "WooCommerce",
    capabilities: [
      "List/create/edit products",
      "View orders",
      "Manage categories",
      "Update pricing",
    ],
  },
  "yoast/v1": {
    name: "Yoast SEO",
    capabilities: [
      "Read/write meta titles and descriptions",
      "Set focus keywords",
      "Check SEO scores",
    ],
  },
  "elementor/v1": {
    name: "Elementor",
    capabilities: [
      "Read/write page layouts",
      "Edit sections and widgets",
      "Push templates",
      "Manage page settings",
    ],
  },
  "elementor-pro/v1": {
    name: "Elementor Pro",
    capabilities: [
      "Advanced widgets",
      "Theme builder",
      "Popup builder",
    ],
  },
  "google-site-kit/v1": {
    name: "Google Site Kit",
    capabilities: [
      "View analytics data",
      "Check search console",
      "View page performance",
    ],
  },
  "wordfence/v1": {
    name: "Wordfence",
    capabilities: [
      "View security scan results",
      "Check firewall status",
    ],
  },
  "jetpack/v4": {
    name: "Jetpack",
    capabilities: [
      "View site stats",
      "Manage social sharing",
      "Check uptime",
    ],
  },
  "siteground-optimizer/v1": {
    name: "SiteGround Optimizer",
    capabilities: [
      "Clear cache",
      "Purge specific pages",
    ],
  },
  "sg-security/v1": {
    name: "SG Security",
    capabilities: ["View security logs"],
  },
  "wicked-folders/v1": {
    name: "Wicked Folders",
    capabilities: ["Organize media and pages into folders"],
  },
  "simple-history/v1": {
    name: "Simple History",
    capabilities: ["View activity logs"],
  },
  "akismet/v1": {
    name: "Akismet",
    capabilities: ["Spam filtering status"],
  },
};

// WordPress core namespaces to exclude from "unknown" plugin detection
const CORE_NAMESPACES = new Set([
  "wp/v2",
  "wp-site-health/v1",
  "wp-block-editor/v1",
  "oembed/1.0",
  "",
]);

export async function discoverPlugins(): Promise<DiscoveredPlugin[]> {
  const siteUrl = process.env.WP_SITE_URL;
  if (!siteUrl) {
    return [];
  }

  const username = process.env.WP_USERNAME || "";
  const appPassword = process.env.WP_APP_PASSWORD || "";
  const credentials = Buffer.from(`${username}:${appPassword}`).toString("base64");

  try {
    const response = await fetch(`${siteUrl}/wp-json/`, {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    if (!response.ok) {
      console.error(`Plugin discovery failed: HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();
    const namespaces: string[] = data.namespaces || [];
    const routes: Record<string, unknown> = data.routes || {};

    const plugins: DiscoveredPlugin[] = [];

    for (const ns of namespaces) {
      if (CORE_NAMESPACES.has(ns)) continue;

      // Collect endpoints for this namespace
      const nsPrefix = `/${ns}`;
      const endpoints: string[] = [];
      for (const route of Object.keys(routes)) {
        if (route.startsWith(nsPrefix)) {
          endpoints.push(route);
        }
      }

      const known = KNOWN_PLUGINS[ns];
      if (known) {
        plugins.push({
          slug: ns.split("/")[0],
          name: known.name,
          namespace: ns,
          endpoints,
          capabilities: known.capabilities,
        });
      } else {
        // Unknown plugin -- still report it with generic capabilities
        const slug = ns.split("/")[0];
        plugins.push({
          slug,
          name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          namespace: ns,
          endpoints,
          capabilities: [`REST API access to ${ns}`],
        });
      }
    }

    return plugins;
  } catch (error) {
    console.error("Plugin discovery error:", error);
    return [];
  }
}

export function buildPluginContext(plugins: DiscoveredPlugin[]): string {
  if (plugins.length === 0) {
    return "";
  }

  const lines = ["\n\nDetected WordPress Plugins:"];
  for (const plugin of plugins) {
    lines.push(`\n- ${plugin.name} (${plugin.namespace})`);
    for (const cap of plugin.capabilities) {
      lines.push(`  * ${cap}`);
    }
    if (plugin.endpoints.length > 0) {
      lines.push(`  Endpoints: ${plugin.endpoints.length} routes available`);
    }
  }

  return lines.join("\n");
}
