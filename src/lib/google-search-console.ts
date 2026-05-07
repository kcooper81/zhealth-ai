/**
 * Google Search Console — Search Analytics API client.
 *
 * Reads the same Google OAuth access token NextAuth issues for GA4 (the
 * webmasters.readonly scope is now requested at sign-in). Required user
 * permission: Owner / Full user on the GSC property.
 *
 * Docs: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
 */

const GSC_API = "https://searchconsole.googleapis.com/webmasters/v3";

const SITE_URL = process.env.WP_SITE_URL || "https://zhealtheducation.com";

/** GSC accepts both "https://example.com/" and "sc-domain:example.com" — we use the URL form. */
function siteParam(): string {
  return SITE_URL.endsWith("/") ? SITE_URL : SITE_URL + "/";
}

async function gscFetch(
  accessToken: string,
  endpoint: string,
  body: Record<string, unknown>
): Promise<any> {
  const url = `${GSC_API}/sites/${encodeURIComponent(siteParam())}/${endpoint}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let msg: string;
    try {
      const err = await response.json();
      msg = err.error?.message || response.statusText;
    } catch {
      msg = response.statusText;
    }
    throw new Error(`Search Console API error (${response.status}): ${msg}`);
  }
  return response.json();
}

/** YYYY-MM-DD start/end pair from a GA4-style range key. */
function rangeDates(rangeKey: string): { startDate: string; endDate: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const end = fmt(today);
  const daysAgo = (n: number) => fmt(new Date(today.getTime() - n * 24 * 60 * 60 * 1000));
  switch (rangeKey) {
    case "7d":   return { startDate: daysAgo(7), endDate: end };
    case "30d":  return { startDate: daysAgo(30), endDate: end };
    case "90d":  return { startDate: daysAgo(90), endDate: end };
    case "12mo": return { startDate: daysAgo(365), endDate: end };
    default:     return { startDate: daysAgo(30), endDate: end };
  }
}

export type GSCQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0-1
  position: number;
};

/**
 * Top search queries for the property in window. The bread-and-butter
 * list — "what people are searching that lands them on our site".
 */
export async function getTopQueries(
  accessToken: string,
  rangeKey: string = "30d",
  limit: number = 200
): Promise<GSCQueryRow[]> {
  const { startDate, endDate } = rangeDates(rangeKey);
  const data = await gscFetch(accessToken, "searchAnalytics/query", {
    startDate,
    endDate,
    dimensions: ["query"],
    rowLimit: limit,
  });
  return (data.rows || []).map((r: any) => ({
    query: r.keys?.[0] || "",
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }));
}

/**
 * Striking-distance keywords: queries ranking on page 2 (positions 11-20)
 * sorted by impressions. These are typically the cheapest wins — small
 * on-page changes can push them onto page 1.
 */
export async function getStrikingDistance(
  accessToken: string,
  rangeKey: string = "30d",
  limit: number = 50
): Promise<GSCQueryRow[]> {
  const all = await getTopQueries(accessToken, rangeKey, 1000);
  return all
    .filter((r) => r.position >= 11 && r.position <= 20 && r.impressions >= 5)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
}

/**
 * Title-rewrite candidates: high impressions but low CTR (people see it,
 * don't click). Threshold = below the property's average CTR.
 */
export async function getLowCTRQueries(
  accessToken: string,
  rangeKey: string = "30d",
  limit: number = 50
): Promise<GSCQueryRow[]> {
  const all = await getTopQueries(accessToken, rangeKey, 1000);
  if (all.length === 0) return [];
  const avgCTR = all.reduce((s, r) => s + r.ctr, 0) / all.length;
  return all
    .filter((r) => r.impressions >= 50 && r.position <= 10 && r.ctr < avgCTR * 0.6)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
}

export type GSCPageQueryRow = {
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/**
 * Per-page query data — for each page, what searches sent traffic to it.
 * Powers a "what queries does this page rank for?" view in the audit.
 */
export async function getPageQueries(
  accessToken: string,
  rangeKey: string = "30d",
  limit: number = 1000
): Promise<GSCPageQueryRow[]> {
  const { startDate, endDate } = rangeDates(rangeKey);
  const data = await gscFetch(accessToken, "searchAnalytics/query", {
    startDate,
    endDate,
    dimensions: ["page", "query"],
    rowLimit: limit,
  });
  return (data.rows || []).map((r: any) => ({
    page: r.keys?.[0] || "",
    query: r.keys?.[1] || "",
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }));
}

/**
 * Top-line totals over the period — clicks, impressions, avg CTR, avg position.
 */
export async function getOverview(
  accessToken: string,
  rangeKey: string = "30d"
): Promise<{ clicks: number; impressions: number; ctr: number; position: number }> {
  const { startDate, endDate } = rangeDates(rangeKey);
  const data = await gscFetch(accessToken, "searchAnalytics/query", {
    startDate,
    endDate,
    dimensions: [],
  });
  const row = data.rows?.[0] || {};
  return {
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  };
}

export type GSCPageRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/** Top pages — which URLs are landing search traffic. */
export async function getTopPagesGSC(
  accessToken: string,
  rangeKey: string = "30d",
  limit: number = 100
): Promise<GSCPageRow[]> {
  const { startDate, endDate } = rangeDates(rangeKey);
  const data = await gscFetch(accessToken, "searchAnalytics/query", {
    startDate,
    endDate,
    dimensions: ["page"],
    rowLimit: limit,
  });
  return (data.rows || []).map((r: any) => ({
    page: r.keys?.[0] || "",
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }));
}

export type GSCDimensionRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/** Breakdown by an arbitrary dimension (device, country, searchAppearance). */
export async function getByDimension(
  accessToken: string,
  rangeKey: string,
  dimension: "device" | "country" | "searchAppearance",
  limit: number = 50
): Promise<GSCDimensionRow[]> {
  const { startDate, endDate } = rangeDates(rangeKey);
  const data = await gscFetch(accessToken, "searchAnalytics/query", {
    startDate,
    endDate,
    dimensions: [dimension],
    rowLimit: limit,
  });
  return (data.rows || []).map((r: any) => ({
    key: r.keys?.[0] || "",
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }));
}

export type GSCDailyRow = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/** Day-by-day trend — used for the line chart on the GSC dashboard. */
export async function getDailyTrend(
  accessToken: string,
  rangeKey: string = "30d"
): Promise<GSCDailyRow[]> {
  const { startDate, endDate } = rangeDates(rangeKey);
  const data = await gscFetch(accessToken, "searchAnalytics/query", {
    startDate,
    endDate,
    dimensions: ["date"],
    rowLimit: 1000,
  });
  return (data.rows || []).map((r: any) => ({
    date: r.keys?.[0] || "",
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }));
}
