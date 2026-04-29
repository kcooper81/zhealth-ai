import Section, { Card } from "@/components/portal/Section";
import Insight, { InsightGrid } from "@/components/portal/Insight";

type Plugin = {
  plugin: string;
  status: string;
  name: string;
  version: string;
};

type WPProps = {
  wp: any;
  ga: any;
  audit: any;
};

type Finding = {
  severity: "alert" | "warn" | "info" | "good";
  title: string;
  detail: string;
  fix?: string;
};

/**
 * Detect groups of plugins doing similar jobs — candidates to consolidate
 * down to one. Pattern-based; conservative on grouping.
 */
function detectRedundantPlugins(plugins: Plugin[]): Array<{ category: string; matches: Plugin[] }> {
  const active = plugins.filter((p) => p.status === "active");
  const groups: Array<{ category: string; pattern: RegExp }> = [
    { category: "Elementor add-on libraries", pattern: /^(happy-elementor|essential-addons|ultimate-elementor|us-core)/i },
    { category: "Security", pattern: /(wordfence|sg-security|advanced-google-recaptcha)/i },
    { category: "Caching / optimization", pattern: /(autoptimize|sg-cachepress|imagify|wp-rocket)/i },
    { category: "SEO", pattern: /(wordpress-seo|wordpress-seo-premium|yoast)/i },
    { category: "Forms / contact", pattern: /(wpforms|gravityforms|contact-form|ninja-forms)/i },
    { category: "Search", pattern: /(ajax-search|search-and-replace|search-exclude|advanced-admin-search)/i },
    { category: "WooCommerce ecosystem", pattern: /(woocommerce|wc-zapier|facebook-for-woocommerce|yikes-inc-easy-custom-woocommerce)/i },
    { category: "Zapier connectors", pattern: /(^zapier|wc-zapier|woocommerce-zapier)/i },
  ];

  const out: Array<{ category: string; matches: Plugin[] }> = [];
  for (const g of groups) {
    const matches = active.filter((p) => g.pattern.test(p.plugin));
    if (matches.length >= 2) out.push({ category: g.category, matches });
  }
  return out;
}

function severityBadge(s: Finding["severity"]) {
  const map = {
    alert: { dot: "bg-rose-500", label: "Remove", text: "text-rose-700 dark:text-rose-300" },
    warn: { dot: "bg-amber-500", label: "Review", text: "text-amber-700 dark:text-amber-300" },
    info: { dot: "bg-blue-500", label: "Note", text: "text-blue-700 dark:text-blue-300" },
    good: { dot: "bg-emerald-500", label: "Healthy", text: "text-emerald-700 dark:text-emerald-300" },
  } as const;
  return map[s];
}

function FindingRow({ f }: { f: Finding }) {
  const b = severityBadge(f.severity);
  return (
    <li className="flex gap-3 py-3">
      <div className="mt-1 flex flex-shrink-0 items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${b.dot}`} />
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${b.text}`}>{b.label}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{f.title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{f.detail}</div>
        {f.fix && (
          <div className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-500">
            <span className="font-medium">Fix: </span>
            {f.fix}
          </div>
        )}
      </div>
    </li>
  );
}

export default function WPAuditView({ wp, ga, audit }: WPProps) {
  if (!wp.ok || !audit.ok) {
    return (
      <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20">
        <p className="text-sm text-rose-700 dark:text-rose-400">
          {!wp.ok ? wp.error : audit.error}
        </p>
      </Card>
    );
  }

  const allPlugins: Plugin[] = wp.plugins;
  const activePlugins = allPlugins.filter((p) => p.status === "active");
  const inactivePlugins = allPlugins.filter((p) => p.status !== "active");

  // Woo dormant detection
  const wooFamily = activePlugins.filter((p) =>
    /(woocommerce|wc-zapier|facebook-for-woocommerce|yikes-inc-easy-custom-woocommerce)/i.test(p.plugin)
  );

  const redundantGroups = detectRedundantPlugins(allPlugins);

  // Taxonomies
  const emptyCategories = audit.categories.filter((c: any) => c.count === 0);
  const emptyTags = audit.tags.filter((t: any) => t.count === 0);

  // Custom post types with zero entries
  const emptyTypes = audit.typeCounts.filter((t: any) => t.count === 0);
  const liveTypes = audit.typeCounts.filter((t: any) => t.count !== null && t.count > 0);

  // Drafts
  const totalDrafts = audit.counts.draftPosts + audit.counts.draftPages;

  // Users by role
  const usersByRole = new Map<string, number>();
  for (const u of audit.users) {
    for (const r of u.roles || []) {
      usersByRole.set(r, (usersByRole.get(r) ?? 0) + 1);
    }
  }
  const adminCount = usersByRole.get("administrator") ?? 0;

  // GA4 anti-join: pages getting traffic vs not
  const trafficPagePaths = ga.ok ? new Set(ga.topPages.map((p: any) => p.page)) : null;

  // Build findings
  const findings: Finding[] = [];

  // Inactive plugins
  if (inactivePlugins.length > 0) {
    findings.push({
      severity: "alert",
      title: `${inactivePlugins.length} inactive plugin${inactivePlugins.length === 1 ? "" : "s"} sitting in WordPress`,
      detail: inactivePlugins.map((p) => p.name).join(", "),
      fix: "WP Admin → Plugins → check each row → Bulk action: Delete. Removes the code entirely. If you might use one again, leave it; if you haven't in 6+ months, delete.",
    });
  }

  // WooCommerce dormant
  if (wooFamily.length > 0) {
    findings.push({
      severity: "alert",
      title: `WooCommerce stack still active (${wooFamily.length} plugins) but not used for sales`,
      detail: wooFamily.map((p) => p.name).join(", ") + ". All ecommerce moved to Thinkific. These add ~12% to page weight, expose security surface, and increase confusion when editing the site.",
      fix: "Before removing, do a one-time check: any links to /cart, /checkout, /shop on the live site? If none → WP Admin → Plugins → deactivate the entire Woo family in one bulk action, then delete.",
    });
  }

  // Redundant plugin groups
  for (const g of redundantGroups) {
    if (g.category === "WooCommerce ecosystem") continue; // already covered above
    findings.push({
      severity: "warn",
      title: `${g.matches.length} active plugins in the "${g.category}" category — likely redundant`,
      detail: g.matches.map((p) => p.name).join(", "),
      fix: `Pick the strongest one and deactivate the rest. Test the site after each deactivation.`,
    });
  }

  // Empty categories
  if (emptyCategories.length > 0) {
    findings.push({
      severity: "warn",
      title: `${emptyCategories.length} categor${emptyCategories.length === 1 ? "y has" : "ies have"} zero posts`,
      detail: emptyCategories.slice(0, 8).map((c: any) => c.name).join(", ") + (emptyCategories.length > 8 ? `, …` : ""),
      fix: "WP Admin → Posts → Categories → bulk delete the unused ones. They add UI clutter in the editor sidebar.",
    });
  }

  // Empty tags
  if (emptyTags.length > 0) {
    findings.push({
      severity: "warn",
      title: `${emptyTags.length} tag${emptyTags.length === 1 ? " has" : "s have"} zero posts`,
      detail: emptyTags.slice(0, 8).map((t: any) => t.name).join(", ") + (emptyTags.length > 8 ? `, …` : ""),
      fix: "WP Admin → Posts → Tags → bulk delete. Consider also using TaxoPress (you have it installed) to merge similar tags.",
    });
  }

  // Drafts
  if (totalDrafts >= 5) {
    findings.push({
      severity: totalDrafts >= 20 ? "warn" : "info",
      title: `${totalDrafts} drafts piling up (${audit.counts.draftPosts} posts, ${audit.counts.draftPages} pages)`,
      detail: "Drafts that sit unused for months become noise in the editor. Anything older than 90 days probably won't ship.",
      fix: "WP Admin → Posts (then Pages) → filter by Draft → review and delete or schedule.",
    });
  }

  // Empty post types
  if (emptyTypes.length > 0) {
    findings.push({
      severity: "info",
      title: `${emptyTypes.length} custom post type${emptyTypes.length === 1 ? "" : "s"} registered but have no entries`,
      detail: emptyTypes.map((t: any) => `${t.type} (${t.rest_base})`).join(", "),
      fix: "Each type is registered by a plugin. If the plugin isn't being used, deactivate + delete it (and the type goes with it). Don't manually edit code.",
    });
  }

  // Admin users
  if (adminCount > 3) {
    findings.push({
      severity: "warn",
      title: `${adminCount} users have administrator role`,
      detail: "Each admin can install plugins, edit theme code, and access all data. Best practice is 1–3 admins; everyone else should be Editor / Author.",
      fix: "WP Admin → Users → review the admin list. Downgrade contractors / past employees to Editor or remove them entirely.",
    });
  }

  // GA4 anti-join — pages getting no traffic
  let lowTrafficNote: Finding | null = null;
  if (trafficPagePaths && audit.counts.publishedPages > ga.topPages.length) {
    const missing = audit.counts.publishedPages - ga.topPages.length;
    lowTrafficNote = {
      severity: "info",
      title: `~${missing} published pages didn't appear in GA4's top ${ga.topPages.length} for the period`,
      detail: "Heuristic — those pages got below-threshold traffic, possibly zero. Could be old landing pages, deprecated trainer pages, or pages no one links to.",
      fix: "Once you've moved through the higher-priority items above, expand GA4 top-pages to 200, anti-join with the WP page list, and bulk-review the zero-traffic ones for unpublishing or 301 redirects.",
    };
  }
  if (lowTrafficNote) findings.push(lowTrafficNote);

  // Sort: alert → warn → info → good
  const severityOrder = { alert: 0, warn: 1, info: 2, good: 3 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const alertCount = findings.filter((f) => f.severity === "alert").length;
  const warnCount = findings.filter((f) => f.severity === "warn").length;
  const infoCount = findings.filter((f) => f.severity === "info").length;

  return (
    <>
      <Section title="Cleanup checklist" description="Concrete things to remove or review on the WP site, ranked by priority.">
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <div className="text-[11px] font-medium uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Remove
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              {alertCount}
            </div>
            <div className="text-xs text-gray-500">Critical</div>
          </Card>
          <Card>
            <div className="text-[11px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Review
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              {warnCount}
            </div>
            <div className="text-xs text-gray-500">Worth a look</div>
          </Card>
          <Card>
            <div className="text-[11px] font-medium uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Notes
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              {infoCount}
            </div>
            <div className="text-xs text-gray-500">FYI only</div>
          </Card>
          <Card>
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
              Active plugins
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              {activePlugins.length}
            </div>
            <div className="text-xs text-gray-500">{inactivePlugins.length} inactive</div>
          </Card>
        </div>

        <Card padded={false}>
          <ul className="divide-y divide-gray-200/70 px-5 dark:divide-white/5">
            {findings.length === 0 ? (
              <li className="py-6 text-center text-sm text-gray-500">
                No actionable findings — site looks clean!
              </li>
            ) : (
              findings.map((f, i) => <FindingRow key={i} f={f} />)
            )}
          </ul>
        </Card>
      </Section>

      <Section title="Inventory" description="What's actually in WordPress, by category.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Content totals
            </div>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Published posts</span>
                <span className="font-medium tabular-nums">{audit.counts.publishedPosts.toLocaleString()}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Published pages</span>
                <span className="font-medium tabular-nums">{audit.counts.publishedPages.toLocaleString()}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Draft posts</span>
                <span className="font-medium tabular-nums">{audit.counts.draftPosts.toLocaleString()}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Draft pages</span>
                <span className="font-medium tabular-nums">{audit.counts.draftPages.toLocaleString()}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Categories total / empty</span>
                <span className="font-medium tabular-nums">
                  {audit.categories.length} / <span className="text-amber-600 dark:text-amber-400">{emptyCategories.length}</span>
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Tags total / empty</span>
                <span className="font-medium tabular-nums">
                  {audit.tags.length} / <span className="text-amber-600 dark:text-amber-400">{emptyTags.length}</span>
                </span>
              </li>
            </ul>
          </Card>

          <Card>
            <div className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Custom post types ({liveTypes.length} live, {emptyTypes.length} empty)
            </div>
            <ul className="space-y-1.5 text-sm">
              {liveTypes
                .sort((a: any, b: any) => (b.count ?? 0) - (a.count ?? 0))
                .map((t: any) => (
                  <li key={t.rest_base} className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">{t.type}</span>
                    <span className="font-medium tabular-nums">{(t.count ?? 0).toLocaleString()}</span>
                  </li>
                ))}
              {emptyTypes.map((t: any) => (
                <li key={t.rest_base} className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>{t.type}</span>
                  <span className="font-medium tabular-nums">empty</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Users by role ({audit.users.length} total)
            </div>
            <ul className="space-y-1.5 text-sm">
              {Array.from(usersByRole.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([role, count]) => (
                  <li key={role} className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">{role}</span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </li>
                ))}
            </ul>
          </Card>

          <Card>
            <div className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Top 8 categories by post count
            </div>
            <ul className="space-y-1.5 text-sm">
              {audit.categories
                .filter((c: any) => c.count > 0)
                .slice(0, 8)
                .map((c: any) => (
                  <li key={c.id} className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">{c.name}</span>
                    <span className="font-medium tabular-nums">{c.count}</span>
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      </Section>

      <Section title="What this audit can't see (yet)" description="Deeper crawl-based checks queued for follow-up.">
        <Card>
          <ul className="ml-5 list-disc space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li><strong>Orphan media</strong> — images / files in the library not referenced by any page or post. Needs a per-page content scan against the 1,816 media URLs.</li>
            <li><strong>Broken internal links</strong> — links pointing at deleted pages or 404s. Needs HTTP probe of every link.</li>
            <li><strong>Pages with no SEO meta</strong> — Yoast exposes meta status per post; needs a per-page query.</li>
            <li><strong>Pages with zero traffic in 90 days</strong> — needs full GA4 page list (more than the top 50 currently fetched) plus anti-join with WP page list.</li>
            <li><strong>Plugin conflicts / errors</strong> — Wordfence and SG-Security both run on the site. They can collide. Worth checking activity logs.</li>
          </ul>
        </Card>
      </Section>
    </>
  );
}
