/**
 * Compact list of every published WP page + post — used by the funnel
 * builder to populate the entry-page dropdown. We don't need the full
 * post bodies, just title + path, so we cache aggressively.
 */
import { cachedFetch, TTL } from "./cache";

const SITE_URL = process.env.WP_SITE_URL || "https://zhealtheducation.com";
const WP_USER = process.env.WP_USERNAME || "";
const WP_PASS = process.env.WP_APP_PASSWORD || "";

export type WPContentEntry = {
  /** URL path without the host (e.g. "/lower-back/") */
  path: string;
  title: string;
  type: "page" | "post";
};

function basicAuth(): string | null {
  if (!WP_USER || !WP_PASS) return null;
  return "Basic " + Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");
}

function urlToPath(link: string): string {
  try {
    const u = new URL(link);
    return u.pathname || "/";
  } catch {
    return link.replace(SITE_URL, "") || "/";
  }
}

async function fetchAll(endpoint: "pages" | "posts"): Promise<WPContentEntry[]> {
  const auth = basicAuth();
  if (!auth) return [];

  const out: WPContentEntry[] = [];
  // Pull up to 5 pages of 100 each = 500 max per type. More than enough for our site.
  for (let page = 1; page <= 5; page++) {
    try {
      const r = await fetch(
        `${SITE_URL}/wp-json/wp/v2/${endpoint}?per_page=100&page=${page}&_fields=id,link,title,status&status=publish`,
        { headers: { Authorization: auth }, next: { revalidate: 0 } }
      );
      if (!r.ok) break;
      const items = (await r.json()) as Array<{
        id: number;
        link: string;
        title: { rendered: string };
        status: string;
      }>;
      if (!Array.isArray(items) || items.length === 0) break;
      for (const it of items) {
        out.push({
          path: urlToPath(it.link),
          title: (it.title?.rendered || "").replace(/<[^>]+>/g, "").trim(),
          type: endpoint === "pages" ? "page" : "post",
        });
      }
      if (items.length < 100) break;
    } catch {
      break;
    }
  }
  return out;
}

/** All published pages on the WP site, cached for 30 minutes. */
export async function getAllWPPages(): Promise<WPContentEntry[]> {
  return cachedFetch("wp:funnel:pages-list", TTL.WP_PAGES, () => fetchAll("pages"));
}

/** All published posts on the WP site, cached for 30 minutes. */
export async function getAllWPPosts(): Promise<WPContentEntry[]> {
  return cachedFetch("wp:funnel:posts-list", TTL.WP_POSTS, () => fetchAll("posts"));
}
