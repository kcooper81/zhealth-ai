/**
 * SEO audit for the WordPress site — pulls every published page/post with
 * Yoast SEO Premium's `yoast_head_json` block + raw fields, and computes
 * a per-row health score covering the on-page items that move rankings.
 *
 * Data source: Yoast Premium REST integration (already active on the
 * site). Each WP REST page/post response includes a `yoast_head_json`
 * object with title, description, canonical, og_*, twitter_*, robots,
 * and the JSON-LD `schema` block.
 */
import { cachedFetch, TTL } from "./cache";
import { extractTopPhrases, computeTopicalFit } from "./keyword-research";

const SITE_URL = process.env.WP_SITE_URL || "https://zhealtheducation.com";
const WP_USER = process.env.WP_USERNAME || "";
const WP_PASS = process.env.WP_APP_PASSWORD || "";

function basicAuth(): string | null {
  if (!WP_USER || !WP_PASS) return null;
  return "Basic " + Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");
}

export type SEOIssueSeverity = "critical" | "warn" | "info";

export type SEOIssue = {
  code: string;
  message: string;
  severity: SEOIssueSeverity;
};

export type SEOAuditRow = {
  id: number;
  type: "page" | "post";
  title: string;
  slug: string;
  link: string;
  path: string;
  modified: string;

  // Yoast-derived
  seoTitle: string | null;
  seoDescription: string | null;
  canonical: string | null;
  robots: { index: boolean; follow: boolean } | null;
  ogImage: string | null;
  hasSchema: boolean;
  schemaTypes: string[];

  // Computed
  titleLength: number;
  descriptionLength: number;
  wordCount: number;
  contentLength: number;

  // Topic / keyword targeting
  topPhrases: Array<{ phrase: string; count: number }>;
  topicalFit: number; // 0-100 — does the title overlap with the page's actual content?
  /** Likely focus keyword if the page doesn't have a Yoast focus keyword set — derived from content. */
  derivedFocus: string | null;

  // Scoring
  issues: SEOIssue[];
  score: number; // 0–100
};

function pathFromUrl(link: string): string {
  try {
    return new URL(link).pathname || "/";
  } catch {
    return link;
  }
}

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build the audit row for a single Yoast-decorated WP record. */
function auditRow(item: any, type: "page" | "post"): SEOAuditRow {
  const yoast = item.yoast_head_json || {};
  const robots = yoast.robots || {};
  const schemaGraph = yoast.schema?.["@graph"] || [];
  const schemaTypes: string[] = [];
  for (const node of schemaGraph) {
    if (node?.["@type"]) {
      const t = node["@type"];
      if (Array.isArray(t)) schemaTypes.push(...t);
      else schemaTypes.push(t);
    }
  }

  const seoTitle = (yoast.title as string) || item.title?.rendered || "";
  const seoDescription = (yoast.description as string) || "";
  const canonical = (yoast.canonical as string) || null;

  const ogImage = yoast.og_image?.[0]?.url || null;
  const cleanContent = stripHtml(item.content?.rendered || "");
  const wordCount = cleanContent ? cleanContent.split(/\s+/).filter(Boolean).length : 0;

  const issues: SEOIssue[] = [];

  if (!seoDescription) {
    issues.push({
      code: "missing_description",
      message: "No meta description set — search snippets default to a content excerpt.",
      severity: "critical",
    });
  } else if (seoDescription.length < 70) {
    issues.push({
      code: "short_description",
      message: `Meta description is only ${seoDescription.length} characters; aim for 130–160.`,
      severity: "warn",
    });
  } else if (seoDescription.length > 165) {
    issues.push({
      code: "long_description",
      message: `Meta description is ${seoDescription.length} characters; will be truncated in search results.`,
      severity: "warn",
    });
  }

  if (!seoTitle) {
    issues.push({
      code: "missing_title",
      message: "No SEO title set.",
      severity: "critical",
    });
  } else if (seoTitle.length < 25) {
    issues.push({
      code: "short_title",
      message: `Title is only ${seoTitle.length} characters; aim for 50–60.`,
      severity: "warn",
    });
  } else if (seoTitle.length > 65) {
    issues.push({
      code: "long_title",
      message: `Title is ${seoTitle.length} characters; will be truncated by Google.`,
      severity: "warn",
    });
  }

  if (!ogImage) {
    issues.push({
      code: "missing_og_image",
      message: "No open-graph image — links shared on social will use a default.",
      severity: "warn",
    });
  }

  if (!canonical) {
    issues.push({
      code: "missing_canonical",
      message: "No canonical URL — risk of duplicate-content signal if the page is reachable at multiple URLs.",
      severity: "info",
    });
  }

  if (typeof robots.index === "string" && robots.index === "noindex") {
    issues.push({
      code: "noindex",
      message: "Page is set to noindex — search engines will not include it.",
      severity: "info",
    });
  }

  if (wordCount < 300) {
    issues.push({
      code: "thin_content",
      message: `Only ${wordCount} words of content — pages under 300 words rarely rank for competitive terms.`,
      severity: wordCount < 100 ? "warn" : "info",
    });
  }

  if (!schemaTypes.length) {
    issues.push({
      code: "no_schema",
      message: "No JSON-LD schema markup detected — schema improves rich-result eligibility.",
      severity: "info",
    });
  }

  // Topic / keyword analysis from actual page content
  const topPhrases = extractTopPhrases(cleanContent, 12);
  const topicalFit = computeTopicalFit(seoTitle, topPhrases);
  const derivedFocus = topPhrases.length > 0 ? topPhrases[0].phrase : null;

  if (topicalFit < 30 && wordCount >= 300) {
    issues.push({
      code: "title_content_mismatch",
      message: `Title "${seoTitle}" doesn't strongly match the page's actual content (top phrase: "${derivedFocus || "—"}"). Either rewrite the title to match what the page covers, or expand content to deliver on the title.`,
      severity: "warn",
    });
  }

  // Compute score: start at 100, subtract penalties
  const penalty: Record<SEOIssueSeverity, number> = { critical: 25, warn: 10, info: 4 };
  let score = 100;
  for (const issue of issues) score -= penalty[issue.severity];
  score = Math.max(0, Math.min(100, score));

  return {
    id: item.id,
    type,
    title: stripHtml(item.title?.rendered || "").slice(0, 200),
    slug: item.slug || "",
    link: item.link || "",
    path: pathFromUrl(item.link || ""),
    modified: item.modified || item.modified_gmt || "",

    seoTitle,
    seoDescription,
    canonical,
    robots:
      typeof robots.index !== "undefined"
        ? {
            index: robots.index !== "noindex",
            follow: robots.follow !== "nofollow",
          }
        : null,
    ogImage,
    hasSchema: schemaTypes.length > 0,
    schemaTypes,

    titleLength: seoTitle.length,
    descriptionLength: seoDescription.length,
    wordCount,
    contentLength: cleanContent.length,

    topPhrases,
    topicalFit,
    derivedFocus,

    issues,
    score,
  };
}

async function fetchAllOfType(endpoint: "pages" | "posts"): Promise<any[]> {
  const auth = basicAuth();
  if (!auth) return [];

  const out: any[] = [];
  // up to 5 pages × 100 each = 500 max per type. Plenty for our site.
  for (let page = 1; page <= 5; page++) {
    try {
      const r = await fetch(
        `${SITE_URL}/wp-json/wp/v2/${endpoint}?per_page=100&page=${page}&status=publish&_fields=id,link,slug,title,content,modified,yoast_head_json`,
        { headers: { Authorization: auth }, next: { revalidate: 0 } }
      );
      if (!r.ok) break;
      const items = await r.json();
      if (!Array.isArray(items) || items.length === 0) break;
      out.push(...items);
      if (items.length < 100) break;
    } catch {
      break;
    }
  }
  return out;
}

export type SEOAuditSummary = {
  rows: SEOAuditRow[];
  totals: {
    total: number;
    pages: number;
    posts: number;
    avgScore: number;
    missingDescription: number;
    missingTitle: number;
    missingOgImage: number;
    missingSchema: number;
    thinContent: number;
    noindex: number;
    titleContentMismatch: number;
  };
  /** Pages where score < 70, sorted by impact (low score). */
  worst: SEOAuditRow[];
  /** Pages where every check passes. */
  best: SEOAuditRow[];
};

export async function runSEOAudit(): Promise<SEOAuditSummary> {
  return cachedFetch("seo:audit:full", TTL.WP_PAGES, async () => {
    const [pages, posts] = await Promise.all([
      fetchAllOfType("pages"),
      fetchAllOfType("posts"),
    ]);
    const rows: SEOAuditRow[] = [
      ...pages.map((p) => auditRow(p, "page")),
      ...posts.map((p) => auditRow(p, "post")),
    ];

    rows.sort((a, b) => a.score - b.score);

    const totals = {
      total: rows.length,
      pages: rows.filter((r) => r.type === "page").length,
      posts: rows.filter((r) => r.type === "post").length,
      avgScore: rows.length
        ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length)
        : 0,
      missingDescription: rows.filter((r) => r.issues.some((i) => i.code === "missing_description")).length,
      missingTitle: rows.filter((r) => r.issues.some((i) => i.code === "missing_title")).length,
      missingOgImage: rows.filter((r) => r.issues.some((i) => i.code === "missing_og_image")).length,
      missingSchema: rows.filter((r) => r.issues.some((i) => i.code === "no_schema")).length,
      thinContent: rows.filter((r) => r.issues.some((i) => i.code === "thin_content")).length,
      noindex: rows.filter((r) => r.issues.some((i) => i.code === "noindex")).length,
      titleContentMismatch: rows.filter((r) => r.issues.some((i) => i.code === "title_content_mismatch")).length,
    };

    const worst = rows.filter((r) => r.score < 70).slice(0, 25);
    const best = [...rows].sort((a, b) => b.score - a.score).slice(0, 5);

    return { rows, totals, worst, best };
  });
}
