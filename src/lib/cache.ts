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

// ---------------------------------------------------------------------------
// Default TTLs (seconds)
// ---------------------------------------------------------------------------
export const TTL = {
  WP_PAGES: 5 * 60,        // 5 minutes — pages list
  WP_POSTS: 5 * 60,        // 5 minutes — posts list
  WP_POPUPS: 5 * 60,       // 5 minutes — popups list
  WP_PLUGINS: 30 * 60,     // 30 minutes — plugin discovery
  KEAP_TAGS: 30 * 60,      // 30 minutes — tags list
  KEAP_STATS: 10 * 60,     // 10 minutes — contact count, pipeline stats
  KEAP_CONTACTS: 5 * 60,   // 5 minutes — contacts list (default view)
  THINKIFIC_COURSES: 15 * 60,  // 15 minutes
  THINKIFIC_OVERVIEW: 15 * 60, // 15 minutes
  GA4_OVERVIEW: 10 * 60,   // 10 minutes — per date range
} as const;

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
      .upsert(
        { cache_key: key, data, expires_at: expiresAtIso, updated_at: new Date().toISOString() },
        { onConflict: "cache_key" }
      )
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

  const data = await fetcher();
  await cacheSet(key, data, ttlSeconds);
  return data;
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
