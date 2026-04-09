/**
 * Google Analytics Data API (GA4) Client
 *
 * Uses the signed-in user's OAuth access token to query GA4.
 * Supports two properties: website and LMS.
 */

const GA4_API = "https://analyticsdata.googleapis.com/v1beta";

export const GA4_PROPERTIES = {
  website: process.env.GA4_PROPERTY_ID_WEBSITE || "336619240",
  lms: process.env.GA4_PROPERTY_ID_LMS || "507907472",
};

export type GA4Property = "website" | "lms";

async function ga4Fetch(
  propertyId: string,
  accessToken: string,
  endpoint: string,
  body: Record<string, unknown>
): Promise<any> {
  const url = `${GA4_API}/properties/${propertyId}:${endpoint}`;
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
    throw new Error(`GA4 API error (${response.status}): ${msg}`);
  }

  return response.json();
}

function getPropertyId(property: GA4Property): string {
  return GA4_PROPERTIES[property];
}

// ---- Reports ----

export async function getTrafficOverview(
  accessToken: string,
  property: GA4Property = "website",
  dateRange: string = "7d"
): Promise<{
  totalUsers: number;
  totalSessions: number;
  totalPageviews: number;
  avgSessionDuration: number;
  bounceRate: number;
}> {
  const { startDate, endDate } = parseDateRange(dateRange);
  const propertyId = getPropertyId(property);

  const data = await ga4Fetch(propertyId, accessToken, "runReport", {
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "totalUsers" },
      { name: "sessions" },
      { name: "screenPageViews" },
      { name: "averageSessionDuration" },
      { name: "bounceRate" },
    ],
  });

  const row = data.rows?.[0]?.metricValues || [];
  return {
    totalUsers: parseInt(row[0]?.value || "0"),
    totalSessions: parseInt(row[1]?.value || "0"),
    totalPageviews: parseInt(row[2]?.value || "0"),
    avgSessionDuration: parseFloat(row[3]?.value || "0"),
    bounceRate: parseFloat(row[4]?.value || "0"),
  };
}

export async function getTopPages(
  accessToken: string,
  property: GA4Property = "website",
  dateRange: string = "7d",
  limit: number = 20
): Promise<Array<{
  page: string;
  pageviews: number;
  users: number;
  avgTimeOnPage: number;
  bounceRate: number;
}>> {
  const { startDate, endDate } = parseDateRange(dateRange);
  const propertyId = getPropertyId(property);

  const data = await ga4Fetch(propertyId, accessToken, "runReport", {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePath" }],
    metrics: [
      { name: "screenPageViews" },
      { name: "totalUsers" },
      { name: "averageSessionDuration" },
      { name: "bounceRate" },
    ],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit,
  });

  return (data.rows || []).map((row: any) => ({
    page: row.dimensionValues?.[0]?.value || "",
    pageviews: parseInt(row.metricValues?.[0]?.value || "0"),
    users: parseInt(row.metricValues?.[1]?.value || "0"),
    avgTimeOnPage: parseFloat(row.metricValues?.[2]?.value || "0"),
    bounceRate: parseFloat(row.metricValues?.[3]?.value || "0"),
  }));
}

export async function getTrafficSources(
  accessToken: string,
  property: GA4Property = "website",
  dateRange: string = "7d",
  limit: number = 15
): Promise<Array<{
  source: string;
  medium: string;
  sessions: number;
  users: number;
}>> {
  const { startDate, endDate } = parseDateRange(dateRange);
  const propertyId = getPropertyId(property);

  const data = await ga4Fetch(propertyId, accessToken, "runReport", {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit,
  });

  return (data.rows || []).map((row: any) => ({
    source: row.dimensionValues?.[0]?.value || "(direct)",
    medium: row.dimensionValues?.[1]?.value || "(none)",
    sessions: parseInt(row.metricValues?.[0]?.value || "0"),
    users: parseInt(row.metricValues?.[1]?.value || "0"),
  }));
}

export async function getPagePerformance(
  accessToken: string,
  pagePath: string,
  property: GA4Property = "website",
  dateRange: string = "30d"
): Promise<{
  pageviews: number;
  users: number;
  avgTimeOnPage: number;
  bounceRate: number;
  entrances: number;
}> {
  const { startDate, endDate } = parseDateRange(dateRange);
  const propertyId = getPropertyId(property);

  const data = await ga4Fetch(propertyId, accessToken, "runReport", {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePath" }],
    dimensionFilter: {
      filter: {
        fieldName: "pagePath",
        stringFilter: { matchType: "EXACT", value: pagePath },
      },
    },
    metrics: [
      { name: "screenPageViews" },
      { name: "totalUsers" },
      { name: "averageSessionDuration" },
      { name: "bounceRate" },
      { name: "entrances" },
    ],
  });

  const row = data.rows?.[0]?.metricValues || [];
  return {
    pageviews: parseInt(row[0]?.value || "0"),
    users: parseInt(row[1]?.value || "0"),
    avgTimeOnPage: parseFloat(row[2]?.value || "0"),
    bounceRate: parseFloat(row[3]?.value || "0"),
    entrances: parseInt(row[4]?.value || "0"),
  };
}

export async function getTrafficByDay(
  accessToken: string,
  property: GA4Property = "website",
  dateRange: string = "30d"
): Promise<Array<{
  date: string;
  users: number;
  sessions: number;
  pageviews: number;
}>> {
  const { startDate, endDate } = parseDateRange(dateRange);
  const propertyId = getPropertyId(property);

  const data = await ga4Fetch(propertyId, accessToken, "runReport", {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "totalUsers" },
      { name: "sessions" },
      { name: "screenPageViews" },
    ],
    orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
  });

  return (data.rows || []).map((row: any) => {
    const raw = row.dimensionValues?.[0]?.value || "";
    const date = raw ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : "";
    return {
      date,
      users: parseInt(row.metricValues?.[0]?.value || "0"),
      sessions: parseInt(row.metricValues?.[1]?.value || "0"),
      pageviews: parseInt(row.metricValues?.[2]?.value || "0"),
    };
  });
}

export async function getHighBouncePages(
  accessToken: string,
  property: GA4Property = "website",
  dateRange: string = "30d",
  minPageviews: number = 50
): Promise<Array<{
  page: string;
  pageviews: number;
  bounceRate: number;
}>> {
  const pages = await getTopPages(accessToken, property, dateRange, 50);
  return pages
    .filter((p) => p.pageviews >= minPageviews && p.bounceRate > 0.6)
    .sort((a, b) => b.bounceRate - a.bounceRate)
    .slice(0, 15);
}

// ---- Helpers ----

function parseDateRange(range: string): { startDate: string; endDate: string } {
  const endDate = "today";
  switch (range) {
    case "today":
      return { startDate: "today", endDate };
    case "7d":
      return { startDate: "7daysAgo", endDate };
    case "30d":
      return { startDate: "30daysAgo", endDate };
    case "90d":
      return { startDate: "90daysAgo", endDate };
    default:
      return { startDate: "7daysAgo", endDate };
  }
}

export function getAnalyticsContext(): string {
  return `
## Google Analytics Integration
You have access to real-time GA4 analytics data for two properties:
- **Z-Health Website** (zhealtheducation.com) — Property ID ${GA4_PROPERTIES.website}
- **Z-Health LMS** (courses.zhealtheducation.com) — Property ID ${GA4_PROPERTIES.lms}

Available reports:
- Traffic overview (users, sessions, pageviews, bounce rate, session duration)
- Top pages by pageviews
- Traffic sources (where visitors come from)
- Individual page performance
- Daily traffic trends
- High bounce rate pages (pages that need improvement)

When the user asks about traffic, pageviews, bounce rates, or site performance, pull real data from GA4.
Present data in clear tables and summaries. Always include the date range.
Compare to previous periods when relevant ("up 15% from last week").
Suggest actionable improvements when you see issues.
`;
}

export function isConfigured(): boolean {
  return !!(GA4_PROPERTIES.website || GA4_PROPERTIES.lms);
}
