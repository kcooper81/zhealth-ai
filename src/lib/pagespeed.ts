/**
 * Google PageSpeed Insights API — free, public, no auth required (we add an
 * API key if PAGESPEED_API_KEY is set, just to lift rate limits).
 *
 * Returns Core Web Vitals (LCP, INP, CLS), Lighthouse perf/SEO/accessibility
 * scores, and key opportunities for any URL. Same data Google Search Console
 * uses for its Core Web Vitals report.
 */

import { cachedFetch } from "./cache";

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export type CoreWebVitals = {
  url: string;
  device: "MOBILE" | "DESKTOP";
  /** 0–100 lighthouse score, or null if not measurable */
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  /** Field-data Core Web Vitals (CrUX 28-day rolling) */
  lcp: { ms: number; rating: "good" | "needs-improvement" | "poor" } | null;
  inp: { ms: number; rating: "good" | "needs-improvement" | "poor" } | null;
  cls: { value: number; rating: "good" | "needs-improvement" | "poor" } | null;
  /** Top opportunity from Lighthouse (lab) — text + estimated savings */
  topOpportunity: { title: string; description: string; savingsMs: number } | null;
  /** True if CrUX has any field data for this URL (Google's "real users" measurement) */
  hasFieldData: boolean;
  fetchedAt: string;
};

function ratingFromCategory(category: string): CoreWebVitals["lcp"] extends infer T ? (T extends { rating: infer R } ? R : never) : never {
  // category is "FAST" | "AVERAGE" | "SLOW"
  if (category === "FAST") return "good" as any;
  if (category === "SLOW") return "poor" as any;
  return "needs-improvement" as any;
}

export async function getPageSpeed(url: string, device: "MOBILE" | "DESKTOP" = "MOBILE"): Promise<CoreWebVitals | null> {
  const cacheKey = `pagespeed:${device}:${url}`;
  return cachedFetch(cacheKey, 6 * 60 * 60, async () => {
    try {
      const params = new URLSearchParams({
        url,
        strategy: device,
        // Request all relevant categories
        category: "performance",
      });
      // Lighthouse only returns one category at a time per param; we want a few
      ["seo", "accessibility", "best-practices"].forEach((c) => params.append("category", c));
      if (process.env.PAGESPEED_API_KEY) {
        params.set("key", process.env.PAGESPEED_API_KEY);
      }
      const r = await fetch(`${ENDPOINT}?${params.toString()}`, { cache: "no-store" });
      if (!r.ok) return null;
      const data = await r.json();

      const lh = data.lighthouseResult;
      const cats = lh?.categories || {};
      const cruxLoading = data.loadingExperience;
      const cruxOrigin = data.originLoadingExperience;
      const crux = cruxLoading?.metrics ? cruxLoading : cruxOrigin;
      const cruxMetrics = crux?.metrics || {};

      const lcp = cruxMetrics.LARGEST_CONTENTFUL_PAINT_MS
        ? { ms: cruxMetrics.LARGEST_CONTENTFUL_PAINT_MS.percentile, rating: ratingFromCategory(cruxMetrics.LARGEST_CONTENTFUL_PAINT_MS.category) }
        : null;
      const inp = cruxMetrics.INTERACTION_TO_NEXT_PAINT
        ? { ms: cruxMetrics.INTERACTION_TO_NEXT_PAINT.percentile, rating: ratingFromCategory(cruxMetrics.INTERACTION_TO_NEXT_PAINT.category) }
        : null;
      const cls = cruxMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE
        ? { value: cruxMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100, rating: ratingFromCategory(cruxMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.category) }
        : null;

      // Pick the top Lighthouse opportunity by overallSavingsMs
      const audits = lh?.audits || {};
      const opportunities = Object.entries(audits)
        .map(([id, a]: any) => ({ id, ...a }))
        .filter((a: any) => a.details?.type === "opportunity" && a.details.overallSavingsMs > 0)
        .sort((a: any, b: any) => (b.details.overallSavingsMs || 0) - (a.details.overallSavingsMs || 0));
      const top = opportunities[0];

      return {
        url,
        device,
        performance: cats.performance?.score != null ? Math.round(cats.performance.score * 100) : null,
        seo: cats.seo?.score != null ? Math.round(cats.seo.score * 100) : null,
        accessibility: cats.accessibility?.score != null ? Math.round(cats.accessibility.score * 100) : null,
        bestPractices: cats["best-practices"]?.score != null ? Math.round(cats["best-practices"].score * 100) : null,
        lcp,
        inp,
        cls,
        topOpportunity: top
          ? { title: top.title, description: (top.description || "").replace(/\[.*?\]\(.*?\)/g, ""), savingsMs: top.details.overallSavingsMs || 0 }
          : null,
        hasFieldData: !!(lcp || inp || cls),
        fetchedAt: new Date().toISOString(),
      } as CoreWebVitals;
    } catch {
      return null;
    }
  });
}

/**
 * Score a batch of URLs in parallel. Limited to N concurrent so we don't
 * blow PageSpeed's free rate limit (default ~50/min without API key).
 */
export async function getPageSpeedBatch(
  urls: string[],
  device: "MOBILE" | "DESKTOP" = "MOBILE",
  concurrency: number = 4
): Promise<CoreWebVitals[]> {
  const out: CoreWebVitals[] = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((u) => getPageSpeed(u, device)));
    for (const r of results) if (r) out.push(r);
  }
  return out;
}

/**
 * Crude rollup: how many URLs in a batch hit each rating tier.
 */
export function rollupVitals(rows: CoreWebVitals[]): {
  total: number;
  withFieldData: number;
  lcp: { good: number; ni: number; poor: number };
  inp: { good: number; ni: number; poor: number };
  cls: { good: number; ni: number; poor: number };
  avgPerformance: number | null;
} {
  const init = () => ({ good: 0, ni: 0, poor: 0 });
  const lcp = init(), inp = init(), cls = init();
  let perfSum = 0, perfCount = 0;
  let withFieldData = 0;
  for (const r of rows) {
    if (r.hasFieldData) withFieldData++;
    if (r.performance != null) { perfSum += r.performance; perfCount++; }
    if (r.lcp) lcp[r.lcp.rating === "good" ? "good" : r.lcp.rating === "poor" ? "poor" : "ni"]++;
    if (r.inp) inp[r.inp.rating === "good" ? "good" : r.inp.rating === "poor" ? "poor" : "ni"]++;
    if (r.cls) cls[r.cls.rating === "good" ? "good" : r.cls.rating === "poor" ? "poor" : "ni"]++;
  }
  return {
    total: rows.length,
    withFieldData,
    lcp,
    inp,
    cls,
    avgPerformance: perfCount > 0 ? Math.round(perfSum / perfCount) : null,
  };
}
