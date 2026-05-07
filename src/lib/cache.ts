/**
 * Caching layer for external API data.
 *
 * Uses Supabase `api_cache` table when configured, falls back to in-memory
 * Map with TTL. This dramatically reduces redundant API calls to WordPress,
 * Keap, Thinkific, and GA4.
 */

import { supabase, isSupabaseConfigured } from "./supabase";

// ---------------------------------------------------------------------------
// In-memory fallback cache (used when Supabase is not configured)
// ---------------------------------------------------------------------------
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();

/**
 * In-flight fetch dedupe — when N concurrent requests miss the same
 * cache key, only the first one calls the underlying fetcher; the others
 * await the same Promise and reuse its result. Dramatically reduces
 * external API load on cold-cache spikes (e.g. when the cron sync
 * expires a key and 5 users hit the page simultaneously).
 */
const inflight = new Map<string, Promise<unknown>>();

// ---------------------------------------------------------------------------
// Default TTLs (seconds)
// ---------------------------------------------------------------------------
export const TTL = {
  // WP — content is admin-edited but rarely; can cache aggressively
  WP_PAGES: 30 * 60,       // 30 minutes — pages list
  WP_POSTS: 30 * 60,       // 30 minutes — posts list
  WP_POPUPS: 15 * 60,      // 15 minutes — popups list
  WP_PLUGINS: 60 * 60,     // 1 hour — plugin discovery
  WP_COUNTS: 30 * 60,      // 30 minutes — header-total counts
  // Keap — semi-frequent data
  KEAP_TAGS: 60 * 60,      // 1 hour — tags rarely change
  KEAP_STATS: 15 * 60,     // 15 minutes — contact count, pipeline stats
  KEAP_CONTACTS: 10 * 60,  // 10 minutes — contacts list (default view)
  KEAP_CAMPAIGNS: 30 * 60, // 30 minutes — campaigns list
  KEAP_EMAILS: 10 * 60,    // 10 minutes — recent emails
  KEAP_OPPORTUNITIES: 30 * 60, // 30 minutes
  KEAP_ACCOUNT: 24 * 60 * 60, // 24h — account profile
  // Thinkific — orders/enrollments move fast on launch days; otherwise slow
  THINKIFIC_COURSES: 60 * 60,  // 1 hour — courses are rarely added
  THINKIFIC_OVERVIEW: 30 * 60, // 30 minutes
  THINKIFIC_ORDERS: 10 * 60,   // 10 minutes
  THINKIFIC_ENROLLMENTS: 10 * 60, // 10 minutes
  THINKIFIC_USERS: 60 * 60,    // 1 hour — students roster
  THINKIFIC_PRODUCTS: 60 * 60, // 1 hour
  THINKIFIC_COUPONS: 60 * 60,  // 1 hour
  // GA4 — last-day data updates ~hourly in the API
  GA4_OVERVIEW: 30 * 60,   // 30 minutes — per date range
  GA4_REPORTS: 30 * 60,    // 30 minutes — top-pages, sources, daily, etc.
} as const;

// ---------------------------------------------------------------------------
// Helpers for building cache keys
// ---------------------------------------------------------------------------

/** A day-bucketed key segment, used for "today's snapshot" caches */
export function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Stable cache-key segment for a TimeRange. For preset ranges (7d, 30d, etc.)
 * this includes today's date so caches naturally roll forward at midnight.
 * For custom ranges it pins to the explicit from/to dates.
 */
export function rangeCacheSegment(range: {
  key: string;
  from: Date;
  to: Date;
}): string {
  if (range.key === "custom") {
    return `custom:${range.from.toISOString().slice(0, 10)}:${range.to.toISOString().slice(0, 10)}`;
  }
  return `${range.key}:${dayKey()}`;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Get cached data by key. Returns null if expired or not found.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  // Try in-memory first (always, even with Supabase — acts as L1 cache)
  const mem = memoryCache.get(key);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.data as T;
  }
  if (mem) {
    memoryCache.delete(key); // expired
  }

  // Try Supabase (L2 cache)
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("api_cache")
        .select("data, expires_at")
        .eq("cache_key", key)
        .single();

      if (error || !data) return null;

      const expiresAt = new Date(data.expires_at).getTime();
      if (expiresAt <= Date.now()) {
        // Expired — delete async, don't wait
        supabase.from("api_cache").delete().eq("cache_key", key).then(() => {});
        return null;
      }

      // Populate L1 cache
      memoryCache.set(key, { data: data.data, expiresAt });
      return data.data as T;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Batched read — fetches many keys in one Supabase round-trip when L1 misses,
 * dramatically speeding up cold page loads that read 10+ cache keys.
 *
 * Returns a Map keyed by the requested cache key; missing/expired keys are
 * absent from the map (use `.has(key)` to check).
 */
export async function cacheGetMulti<T = unknown>(
  keys: string[]
): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  if (keys.length === 0) return out;

  const remaining: string[] = [];
  for (const key of keys) {
    const mem = memoryCache.get(key);
    if (mem && mem.expiresAt > Date.now()) {
      out.set(key, mem.data as T);
    } else {
      if (mem) memoryCache.delete(key);
      remaining.push(key);
    }
  }

  if (remaining.length === 0 || !isSupabaseConfigured) return out;

  try {
    const { data, error } = await supabase
      .from("api_cache")
      .select("cache_key, data, expires_at")
      .in("cache_key", remaining);

    if (error || !data) return out;

    const now = Date.now();
    for (const row of data as Array<{ cache_key: string; data: unknown; expires_at: string }>) {
      const expiresAt = new Date(row.expires_at).getTime();
      if (expiresAt <= now) continue;
      out.set(row.cache_key, row.data as T);
      memoryCache.set(row.cache_key, { data: row.data, expiresAt });
    }
  } catch {
    // ignore — return whatever L1 had
  }

  return out;
}

/**
 * Set cache data with TTL in seconds.
 */
export async function cacheSet(key: string, data: unknown, ttlSeconds: number): Promise<void> {
  const expiresAt = Date.now() + ttlSeconds * 1000;

  // Always set in-memory (L1)
  memoryCache.set(key, { data, expiresAt });

  // Persist to Supabase (L2) — fire and forget
  if (isSupabaseConfigured) {
    const expiresAtIso = new Date(expiresAt).toISOString();
    supabase
      .from("api_cache")
      .upsert({ cache_key: key, data, expires_at: expiresAtIso, updated_at: new Date().toISOString() })
      .then(() => {});
  }
}

/**
 * Invalidate cache entries matching a prefix.
 * e.g. invalidate("wp:") clears all WordPress cache entries.
 */
export async function cacheInvalidate(prefix: string): Promise<void> {
  // Clear from memory
  const keysToDelete: string[] = [];
  memoryCache.forEach((_, key) => {
    if (key.startsWith(prefix)) keysToDelete.push(key);
  });
  keysToDelete.forEach((key) => memoryCache.delete(key));

  // Clear from Supabase
  if (isSupabaseConfigured) {
    supabase
      .from("api_cache")
      .delete()
      .like("cache_key", `${prefix}%`)
      .then(() => {});
  }
}

/**
 * Invalidate a single cache key.
 */
export async function cacheDelete(key: string): Promise<void> {
  memoryCache.delete(key);
  if (isSupabaseConfigured) {
    supabase.from("api_cache").delete().eq("cache_key", key).then(() => {});
  }
}

// ---------------------------------------------------------------------------
// Helper: fetch with cache (wraps any async data fetcher)
// ---------------------------------------------------------------------------

/**
 * Fetch data with caching. Checks cache first, calls fetcher on miss,
 * stores result in cache.
 */
export async function cachedFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  // Dedupe concurrent misses for the same key
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    try {
      const data = await fetcher();
      // Fire-and-forget cache write so we don't block the return
      cacheSet(key, data, ttlSeconds);
      return data;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/**
 * Run many cached fetches in parallel with a single batched Supabase read
 * upfront. For pages that need to read 5+ cache keys at the start of their
 * server render, this collapses the L2 round-trips into one query.
 */
export async function cachedFetchMulti<T = unknown>(
  entries: Array<{ key: string; ttlSeconds: number; fetcher: () => Promise<T> }>
): Promise<Map<string, T>> {
  const keys = entries.map((e) => e.key);
  const cached = await cacheGetMulti<T>(keys);

  await Promise.all(
    entries.map(async (e) => {
      if (cached.has(e.key)) return;
      try {
        const data = await e.fetcher();
        cached.set(e.key, data);
        // fire-and-forget the cache write so we don't block render
        cacheSet(e.key, data, e.ttlSeconds);
      } catch {
        // swallow — caller decides default via `.get(key)` returning undefined
      }
    })
  );

  return cached;
}

/**
 * Bypasses the read and always calls the fetcher. Writes the result to cache.
 * Used by the background sync job to refresh entries before they expire.
 */
export async function cacheRefresh<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const data = await fetcher();
  await cacheSet(key, data, ttlSeconds);
  return data;
}

// ---------------------------------------------------------------------------
// Sync metadata — when did the background sync last run, per system
// ---------------------------------------------------------------------------

const SYNC_TTL = 7 * 24 * 60 * 60; // sync-meta entries last a week

export type SyncSystem = "keap" | "thinkific" | "wp" | "all";

export type SyncMeta = {
  system: SyncSystem;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  refreshed: number;
  errors: string[];
};

export async function setSyncMeta(meta: SyncMeta): Promise<void> {
  await cacheSet(`meta:last-sync:${meta.system}`, meta, SYNC_TTL);
}

export async function getSyncMeta(system: SyncSystem): Promise<SyncMeta | null> {
  return cacheGet<SyncMeta>(`meta:last-sync:${system}`);
}

// ---------------------------------------------------------------------------
// Cache key builders (centralized to avoid typos)
// ---------------------------------------------------------------------------

export const CacheKeys = {
  wpPages: (status?: string) => `wp:pages:${status || "all"}`,
  wpPosts: (status?: string) => `wp:posts:${status || "all"}`,
  wpPopups: (status?: string) => `wp:popups:${status || "all"}`,
  wpPlugins: () => "wp:plugins",
  keapTags: () => "keap:tags",
  keapContactCount: () => "keap:contact-count",
  keapPipelineStats: () => "keap:pipeline-stats",
  keapContacts: (query?: string) => `keap:contacts:${query || "default"}`,
  thinkificCourses: () => "thinkific:courses",
  thinkificOverview: () => "thinkific:overview",
  ga4Overview: (property: string, range: string) => `ga4:overview:${property}:${range}`,
} as const;
