/**
 * Background snapshot refresh.
 *
 * Each portal page reads its data through cachedFetch() with cache keys
 * keyed by system + (sometimes) date range. The Vercel cron job calls into
 * this module to PRE-WARM those exact cache entries before users hit them.
 *
 * Important: the cache keys here MUST stay in sync with the keys used by
 * the portal pages. If you add a new cached key on a page, mirror it here
 * for it to participate in background sync.
 *
 * GA4 is intentionally skipped in cron (it requires a per-user OAuth token).
 * Pages still cache GA4 calls per request session.
 */

import {
  cacheRefresh,
  setSyncMeta,
  TTL,
  type SyncMeta,
  type SyncSystem,
  rangeCacheSegment,
} from "./cache";
import {
  listContacts,
  listTags,
  listCampaigns,
  listOpportunities,
  listPipelineStages,
  listEmails,
  listOrders as listKeapOrders,
  getAccountInfo,
  getContactsWithTag,
} from "./keap";
import {
  listCourses,
  listOrders,
  listProducts,
  listEnrollments,
  listCoupons,
  listUsers,
  getLMSOverview,
} from "./thinkific";
import { parseTimeRange } from "./time-range";

const SITE_URL = process.env.WP_SITE_URL || "https://zhealtheducation.com";
const WP_USER = process.env.WP_USERNAME || "";
const WP_PASS = process.env.WP_APP_PASSWORD || "";

function basicAuth(): string {
  if (!WP_USER || !WP_PASS) return "";
  return "Basic " + Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");
}

/** Refresh the cache keys most pages share for Keap data. */
export async function refreshKeap(): Promise<{ refreshed: number; errors: string[] }> {
  const errors: string[] = [];
  let refreshed = 0;

  const tasks: Array<Promise<unknown>> = [];

  const safeRefresh = <T>(label: string, fn: () => Promise<T>) => {
    tasks.push(
      fn()
        .then(() => {
          refreshed += 1;
        })
        .catch((e) => {
          errors.push(`keap:${label}: ${e instanceof Error ? e.message : String(e)}`);
        })
    );
  };

  // Account-level data
  safeRefresh("account-info", () =>
    cacheRefresh("keap:account-info", TTL.KEAP_ACCOUNT, () =>
      getAccountInfo().catch(() => null)
    )
  );
  safeRefresh("contacts:total", () =>
    cacheRefresh("keap:contacts:total", TTL.KEAP_STATS, () => listContacts({ limit: 1 }))
  );
  safeRefresh("tags:count", () =>
    cacheRefresh("keap:tags:count", TTL.KEAP_TAGS, () => listTags({ limit: 1 }))
  );
  safeRefresh("tags:50", () =>
    cacheRefresh("keap:tags:50", TTL.KEAP_TAGS, () =>
      listTags({ limit: 50 }).catch(() => ({ tags: [], count: 0 }))
    )
  );
  safeRefresh("tags:200", () =>
    cacheRefresh("keap:tags:200", TTL.KEAP_TAGS, () => listTags({ limit: 200 }))
  );
  safeRefresh("campaigns:200", () =>
    cacheRefresh("keap:campaigns:200", TTL.KEAP_CAMPAIGNS, () =>
      listCampaigns({ limit: 200 }).catch(() => ({ count: 0, campaigns: [] }))
    )
  );
  safeRefresh("opportunities:200", () =>
    cacheRefresh("keap:opportunities:200", TTL.KEAP_OPPORTUNITIES, () =>
      listOpportunities({ limit: 200 }).catch(() => ({ opportunities: [], count: 0 }))
    )
  );
  safeRefresh("pipeline-stages", () =>
    cacheRefresh("keap:pipeline-stages", TTL.KEAP_OPPORTUNITIES, () =>
      listPipelineStages().catch(() => [])
    )
  );

  // Pre-warm common time ranges
  const commonRangeKeys = ["7d", "30d", "90d"];
  for (const rangeKey of commonRangeKeys) {
    const range = parseTimeRange({ range: rangeKey });
    const seg = rangeCacheSegment(range);
    const priorSeg = rangeCacheSegment({
      key: `prior-${range.key}`,
      from: range.prior.from,
      to: range.prior.to,
    });

    safeRefresh(`contacts:in-period:${seg}`, () =>
      cacheRefresh(`keap:contacts:in-period:${seg}`, TTL.KEAP_STATS, () =>
        listContacts({
          limit: 1,
          since: range.from.toISOString(),
          until: range.to.toISOString(),
        }).catch(() => ({ count: 0, contacts: [] }))
      )
    );
    safeRefresh(`contacts:in-period:${priorSeg}`, () =>
      cacheRefresh(`keap:contacts:in-period:${priorSeg}`, TTL.KEAP_STATS, () =>
        listContacts({
          limit: 1,
          since: range.prior.from.toISOString(),
          until: range.prior.to.toISOString(),
        }).catch(() => ({ count: 0, contacts: [] }))
      )
    );
    safeRefresh(`emails:since:${seg}`, () =>
      cacheRefresh(`keap:emails:since:${seg}`, TTL.KEAP_EMAILS, () =>
        listEmails({ limit: 100, since_sent_date: range.from.toISOString() }).catch(() => ({
          emails: [],
          count: 0,
        }))
      )
    );
    safeRefresh(`emails:since:${seg}:30`, () =>
      cacheRefresh(`keap:emails:since:${seg}:30`, TTL.KEAP_EMAILS, () =>
        listEmails({ limit: 30, since_sent_date: range.from.toISOString() }).catch(() => ({
          emails: [],
          count: 0,
        }))
      )
    );
    safeRefresh(`orders:in-period:${seg}`, () =>
      cacheRefresh(`keap:orders:in-period:${seg}`, TTL.KEAP_STATS, () =>
        listKeapOrders({
          limit: 100,
          since: range.from.toISOString(),
          until: range.to.toISOString(),
        }).catch(() => ({ orders: [], count: 0 }))
      )
    );
    safeRefresh(`orders:in-period:${priorSeg}`, () =>
      cacheRefresh(`keap:orders:in-period:${priorSeg}`, TTL.KEAP_STATS, () =>
        listKeapOrders({
          limit: 100,
          since: range.prior.from.toISOString(),
          until: range.prior.to.toISOString(),
        }).catch(() => ({ orders: [], count: 0 }))
      )
    );
  }

  await Promise.allSettled(tasks);

  // Warm top-tag contact samples (used by /portal/analytics audience tab)
  try {
    const tagsSnapshot = await listTags({ limit: 8 });
    await Promise.allSettled(
      tagsSnapshot.tags.map((t) =>
        cacheRefresh(`keap:contacts-with-tag:${t.id}:50`, TTL.KEAP_TAGS, () =>
          getContactsWithTag(t.id, { limit: 50 }).catch(() => ({ contacts: [], count: 0 }))
        )
          .then(() => {
            refreshed += 1;
          })
          .catch((e) => {
            errors.push(`keap:tag-${t.id}: ${e instanceof Error ? e.message : String(e)}`);
          })
      )
    );
  } catch (e) {
    errors.push(`keap:top-tags-fetch: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { refreshed, errors };
}

/** Refresh the cache keys most pages share for Thinkific data. */
export async function refreshThinkific(): Promise<{ refreshed: number; errors: string[] }> {
  const errors: string[] = [];
  let refreshed = 0;
  const tasks: Array<Promise<unknown>> = [];

  const safeRefresh = <T>(label: string, fn: () => Promise<T>) => {
    tasks.push(
      fn()
        .then(() => {
          refreshed += 1;
        })
        .catch((e) => {
          errors.push(`thinkific:${label}: ${e instanceof Error ? e.message : String(e)}`);
        })
    );
  };

  safeRefresh("overview", () =>
    cacheRefresh("thinkific:overview", TTL.THINKIFIC_OVERVIEW, () =>
      getLMSOverview().catch(() => null)
    )
  );
  safeRefresh("courses:250", () =>
    cacheRefresh("thinkific:courses:250", TTL.THINKIFIC_COURSES, () => listCourses({ limit: 250 }))
  );
  safeRefresh("orders:250", () =>
    cacheRefresh("thinkific:orders:250", TTL.THINKIFIC_ORDERS, () =>
      listOrders({ limit: 250 }).catch(() => ({
        items: [],
        meta: { pagination: { total_items: 0 } },
      }))
    )
  );
  safeRefresh("orders:p1:250", () =>
    cacheRefresh("thinkific:orders:p1:250", TTL.THINKIFIC_ORDERS, () =>
      listOrders({ limit: 250, page: 1 }).catch(() => ({
        items: [],
        meta: { pagination: { total_items: 0 } },
      }))
    )
  );
  safeRefresh("orders:p2:250", () =>
    cacheRefresh("thinkific:orders:p2:250", TTL.THINKIFIC_ORDERS, () =>
      listOrders({ limit: 250, page: 2 }).catch(() => ({
        items: [],
        meta: { pagination: { total_items: 0 } },
      }))
    )
  );
  safeRefresh("products:250", () =>
    cacheRefresh("thinkific:products:250", TTL.THINKIFIC_PRODUCTS, () =>
      listProducts({ limit: 250 }).catch(() => ({ items: [] }))
    )
  );
  safeRefresh("enrollments:250", () =>
    cacheRefresh("thinkific:enrollments:250", TTL.THINKIFIC_ENROLLMENTS, () =>
      listEnrollments({ limit: 250 }).catch(() => ({
        items: [],
        meta: { pagination: { total_items: 0 } },
      }))
    )
  );
  safeRefresh("users:p1:250", () =>
    cacheRefresh("thinkific:users:p1:250", TTL.THINKIFIC_USERS, () =>
      listUsers({ limit: 250, page: 1 }).catch(() => ({
        items: [],
        meta: { pagination: { total_items: 0 } },
      }))
    )
  );
  safeRefresh("users:p2:250", () =>
    cacheRefresh("thinkific:users:p2:250", TTL.THINKIFIC_USERS, () =>
      listUsers({ limit: 250, page: 2 }).catch(() => ({
        items: [],
        meta: { pagination: { total_items: 0 } },
      }))
    )
  );
  safeRefresh("coupons:250", () =>
    cacheRefresh("thinkific:coupons:250", TTL.THINKIFIC_COUPONS, () =>
      listCoupons({ limit: 250 }).catch(() => ({ items: [] }))
    )
  );

  await Promise.allSettled(tasks);
  return { refreshed, errors };
}

/** Refresh WP content overview cache. */
export async function refreshWP(): Promise<{ refreshed: number; errors: string[] }> {
  const errors: string[] = [];
  let refreshed = 0;
  const auth = basicAuth();
  if (!auth) {
    errors.push("wp: WP credentials missing");
    return { refreshed, errors };
  }

  try {
    const headers = { Authorization: auth };
    await cacheRefresh("wp:content-overview", TTL.WP_COUNTS, async () => {
      const [postsTotal, pagesTotal, mediaTotal, usersTotal, plugins] = await Promise.all([
        fetch(`${SITE_URL}/wp-json/wp/v2/posts?per_page=1`, { headers, next: { revalidate: 0 } }).then(
          (r) => parseInt(r.headers.get("x-wp-total") || "0", 10)
        ),
        fetch(`${SITE_URL}/wp-json/wp/v2/pages?per_page=1`, { headers, next: { revalidate: 0 } }).then(
          (r) => parseInt(r.headers.get("x-wp-total") || "0", 10)
        ),
        fetch(`${SITE_URL}/wp-json/wp/v2/media?per_page=1`, { headers, next: { revalidate: 0 } }).then(
          (r) => parseInt(r.headers.get("x-wp-total") || "0", 10)
        ),
        fetch(`${SITE_URL}/wp-json/wp/v2/users?per_page=1&context=edit`, {
          headers,
          next: { revalidate: 0 },
        }).then((r) => parseInt(r.headers.get("x-wp-total") || "0", 10)),
        fetch(`${SITE_URL}/wp-json/wp/v2/plugins`, { headers, next: { revalidate: 0 } }).then((r) =>
          r.ok ? r.json() : []
        ),
      ]);
      return {
        ok: true,
        counts: { posts: postsTotal, pages: pagesTotal, media: mediaTotal, users: usersTotal },
        plugins: Array.isArray(plugins) ? plugins : [],
      };
    });
    refreshed += 1;
  } catch (e) {
    errors.push(`wp: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { refreshed, errors };
}

/** Run a full sync across Keap, Thinkific, and WP. Records metadata. */
export async function refreshAll(): Promise<SyncMeta> {
  const startedAt = new Date();

  const [keap, thinkific, wp] = await Promise.allSettled([
    refreshKeap(),
    refreshThinkific(),
    refreshWP(),
  ]);

  const result = (r: PromiseSettledResult<{ refreshed: number; errors: string[] }>) =>
    r.status === "fulfilled" ? r.value : { refreshed: 0, errors: [String(r.reason)] };

  const k = result(keap);
  const t = result(thinkific);
  const w = result(wp);

  const finishedAt = new Date();
  const meta: SyncMeta = {
    system: "all" as SyncSystem,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    refreshed: k.refreshed + t.refreshed + w.refreshed,
    errors: [...k.errors, ...t.errors, ...w.errors],
  };

  // Persist per-system metas plus the aggregate
  await Promise.allSettled([
    setSyncMeta(meta),
    setSyncMeta({ ...meta, system: "keap", refreshed: k.refreshed, errors: k.errors }),
    setSyncMeta({ ...meta, system: "thinkific", refreshed: t.refreshed, errors: t.errors }),
    setSyncMeta({ ...meta, system: "wp", refreshed: w.refreshed, errors: w.errors }),
  ]);

  return meta;
}
