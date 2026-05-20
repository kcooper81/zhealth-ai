/**
 * Monthly SEO + traffic health report — runs 1st of each month 8am ET.
 *
 * Reports on the previous full calendar month vs prior month vs same month
 * last year. Includes 13-month trend charts (GSC + GA4), brand-stack chart,
 * top-pages-YoY chart, and channel-mix donut.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getGoogleAccessToken } from "@/lib/reports/google-auth";
import { postMessageToBoard } from "@/lib/reports/basecamp";
import { yoyLineChart, brandStackChart, topPagesChart, channelDonut } from "@/lib/reports/charts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GSC_SITE = "sc-domain:zhealtheducation.com";
const BRAND_RE = /\b(z-?health|zhealth|z health|dr.?cobb|eric.?cobb)\b/i;

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function pct(a: number, b: number) { if (!b) return a ? "—" : "0%"; const v = ((a - b) / b) * 100; return (v >= 0 ? "+" : "") + v.toFixed(1) + "%"; }
function arrow(a: number, b: number) { return a > b ? "▲" : a < b ? "▼" : "→"; }
function fmtNum(n: number) { return Math.round(n).toLocaleString(); }
function path(url: string) { return (url || "").replace(/^https?:\/\/[^/]+/, ""); }

function monthBounds(ref: Date) {
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
  return { start: fmtDate(start), end: fmtDate(end), ref: start };
}
function shiftMonth(ref: Date, delta: number) {
  return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + delta, 1));
}

async function gscQuery(token: string, body: object): Promise<any[]> {
  const r = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(GSC_SITE) + "/searchAnalytics/query", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("GSC " + r.status + ": " + await r.text());
  return (await r.json()).rows || [];
}

async function ga4Query(token: string, body: object): Promise<any> {
  const propertyId = process.env.GA4_PROPERTY_ID_WEBSITE;
  const r = await fetch("https://analyticsdata.googleapis.com/v1beta/properties/" + propertyId + ":runReport", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("GA4 " + r.status + ": " + await r.text());
  return await r.json();
}

async function buildReport(monthOverride?: string): Promise<{ subject: string; content: string; summary: string }> {
  const token = await getGoogleAccessToken();
  const now = new Date();
  const reporting = monthOverride
    ? new Date(monthOverride + "-01T00:00:00Z")
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const monthName = reporting.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const thisMonth = monthBounds(reporting);
  const lastMonth = monthBounds(shiftMonth(reporting, -1));
  const lastYear = monthBounds(shiftMonth(reporting, -12));

  // 13-month trend window (current + 12 months back)
  const trendMonths = Array.from({ length: 13 }, (_, i) => monthBounds(shiftMonth(reporting, -12 + i)));
  const trendMonthsLY = trendMonths.map(m => monthBounds(shiftMonth(m.ref, -12)));
  const trendLabels = trendMonths.map(m => m.ref.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }));

  async function gscFor(p: { start: string; end: string }) {
    const [totals, queries, pages] = await Promise.all([
      gscQuery(token, { startDate: p.start, endDate: p.end, dimensions: [], dataState: "all" }),
      gscQuery(token, { startDate: p.start, endDate: p.end, dimensions: ["query"], rowLimit: 500, dataState: "all" }),
      gscQuery(token, { startDate: p.start, endDate: p.end, dimensions: ["page"], rowLimit: 200, dataState: "all" }),
    ]);
    return { clicks: totals[0]?.clicks || 0, impressions: totals[0]?.impressions || 0, queries, pages };
  }
  async function ga4For(p: { start: string; end: string }) {
    const [totals, channels, landingPages] = await Promise.all([
      ga4Query(token, {
        dateRanges: [{ startDate: p.start, endDate: p.end }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "newUsers" }, { name: "engagedSessions" }, { name: "screenPageViews" }],
      }),
      ga4Query(token, {
        dateRanges: [{ startDate: p.start, endDate: p.end }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        limit: 20,
      }),
      ga4Query(token, {
        dateRanges: [{ startDate: p.start, endDate: p.end }],
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "engagedSessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 30,
      }),
    ]);
    const row = totals.rows?.[0]?.metricValues || [];
    return {
      sessions: parseInt(row[0]?.value || "0"),
      totalUsers: parseInt(row[1]?.value || "0"),
      newUsers: parseInt(row[2]?.value || "0"),
      engagedSessions: parseInt(row[3]?.value || "0"),
      pageviews: parseInt(row[4]?.value || "0"),
      channels: (channels.rows || []).map((r: any) => ({ name: r.dimensionValues[0].value, sessions: parseInt(r.metricValues[0].value), users: parseInt(r.metricValues[1].value) })),
      landingPages: (landingPages.rows || []).map((r: any) => ({ path: r.dimensionValues[0].value, sessions: parseInt(r.metricValues[0].value), users: parseInt(r.metricValues[1].value), engaged: parseInt(r.metricValues[2].value) })),
    };
  }

  // Main periods + trends in parallel
  const [gscThis, gscLast, gscLY, ga4This, ga4Last, ga4LY, trendThis, trendLY, gaTrendThis, gaTrendLY, brandTrendData] = await Promise.all([
    gscFor(thisMonth),
    gscFor(lastMonth),
    gscFor(lastYear),
    ga4For(thisMonth),
    ga4For(lastMonth),
    ga4For(lastYear),
    Promise.all(trendMonths.map(m => gscQuery(token, { startDate: m.start, endDate: m.end, dimensions: [], dataState: "all" }))),
    Promise.all(trendMonthsLY.map(m => gscQuery(token, { startDate: m.start, endDate: m.end, dimensions: [], dataState: "all" }))),
    Promise.all(trendMonths.map(m => ga4Query(token, { dateRanges: [{ startDate: m.start, endDate: m.end }], metrics: [{ name: "sessions" }] }))),
    Promise.all(trendMonthsLY.map(m => ga4Query(token, { dateRanges: [{ startDate: m.start, endDate: m.end }], metrics: [{ name: "sessions" }] }))),
    Promise.all(trendMonths.slice(-6).map(m => gscQuery(token, { startDate: m.start, endDate: m.end, dimensions: ["query"], rowLimit: 5000, dataState: "all" }))),
  ]);

  const trendClicks = trendThis.map((r: any[]) => r[0]?.clicks || 0);
  const trendClicksLY = trendLY.map((r: any[]) => r[0]?.clicks || 0);
  const gaTrend = gaTrendThis.map((r: any) => parseInt(r.rows?.[0]?.metricValues?.[0]?.value || "0"));
  const gaTrendLYArr = gaTrendLY.map((r: any) => parseInt(r.rows?.[0]?.metricValues?.[0]?.value || "0"));

  function brandSplit(rows: any[]) {
    let bC = 0, bI = 0, nC = 0, nI = 0;
    for (const r of rows) { if (BRAND_RE.test(r.keys[0])) { bC += r.clicks; bI += r.impressions; } else { nC += r.clicks; nI += r.impressions; } }
    return { brandClicks: bC, brandImpr: bI, nonBrandClicks: nC, nonBrandImpr: nI };
  }
  const brandThis = brandSplit(gscThis.queries);
  const brandLast = brandSplit(gscLast.queries);
  const brandLYData = brandSplit(gscLY.queries);

  const brandTrend = brandTrendData.map((rows: any[], i: number) => ({
    label: trendLabels.slice(-6)[i],
    ...brandSplit(rows),
  }));

  // Top movers (YoY)
  function topMoversYoY(thisList: any[], lyList: any[], topN = 10) {
    const lyMap = new Map(lyList.map((r: any) => [r.keys[0], r]));
    const moves = thisList.map((r: any) => {
      const prev = lyMap.get(r.keys[0]) as any;
      return { key: r.keys[0], thisClicks: r.clicks, lastClicks: prev?.clicks || 0, delta: r.clicks - (prev?.clicks || 0), position: r.position, impressions: r.impressions };
    });
    return {
      climbers: moves.filter((m: any) => m.delta >= 5).sort((a: any, b: any) => b.delta - a.delta).slice(0, topN),
      droppers: moves.filter((m: any) => m.delta <= -5).sort((a: any, b: any) => a.delta - b.delta).slice(0, topN),
    };
  }
  const queryMoves = topMoversYoY(gscThis.queries, gscLY.queries, 10);

  const topPages = gscThis.pages.slice(0, 10).map((p: any) => {
    const ly = gscLY.pages.find((l: any) => l.keys[0] === p.keys[0]);
    return { path: path(p.keys[0]), thisClicks: p.clicks, lastClicks: ly?.clicks || 0 };
  }).sort((a: any, b: any) => b.thisClicks - a.thisClicks);

  const opps = gscThis.queries
    .filter((r: any) => r.impressions > 200 && r.position < 15 && r.ctr < 0.02 && !BRAND_RE.test(r.keys[0]))
    .sort((a: any, b: any) => b.impressions - a.impressions)
    .slice(0, 10);

  // Charts
  const trendChartUrl = yoyLineChart({ labels: trendLabels, thisYear: trendClicks, lastYear: trendClicksLY, title: "GSC organic clicks — 13 months", thisYearLabel: "2025-2026", lastYearLabel: "2024-2025" });
  const gaTrendChartUrl = yoyLineChart({ labels: trendLabels, thisYear: gaTrend, lastYear: gaTrendLYArr, title: "GA4 sessions — 13 months", thisYearLabel: "2025-2026", lastYearLabel: "2024-2025" });
  const brandChartUrl = brandStackChart({ labels: brandTrend.map(b => b.label), brand: brandTrend.map(b => b.brandClicks), nonBrand: brandTrend.map(b => b.nonBrandClicks), title: "Brand vs non-brand clicks (last 6 months)" });
  const pagesChartUrl = topPagesChart({ labels: topPages.map((p: any) => p.path.length > 50 ? p.path.slice(0, 47) + "..." : p.path), thisYear: topPages.map((p: any) => p.thisClicks), lastYear: topPages.map((p: any) => p.lastClicks), title: "Top 10 pages — " + monthName + " vs same month last year" });
  const channelChartUrl = channelDonut({ channels: ga4This.channels.slice(0, 8), title: "Channel mix — " + monthName });

  const subject = "Monthly SEO Health — " + monthName;
  const content = `
<div>
<h1>${subject}</h1>
<p><em>Reporting on the previous complete calendar month.</em><br>
<strong>This month:</strong> ${thisMonth.start} → ${thisMonth.end}<br>
<strong>Last month:</strong> ${lastMonth.start} → ${lastMonth.end}<br>
<strong>Same month last year:</strong> ${lastYear.start} → ${lastYear.end}</p>

<h2>Headline numbers</h2>
<table><tr><th>Metric</th><th>This month</th><th>vs last month</th><th>vs last year</th></tr>
<tr><td><strong>Organic clicks (GSC)</strong></td><td>${fmtNum(gscThis.clicks)}</td><td>${arrow(gscThis.clicks, gscLast.clicks)} ${pct(gscThis.clicks, gscLast.clicks)} (${fmtNum(gscLast.clicks)})</td><td>${arrow(gscThis.clicks, gscLY.clicks)} ${pct(gscThis.clicks, gscLY.clicks)} (${fmtNum(gscLY.clicks)})</td></tr>
<tr><td><strong>Organic impressions</strong></td><td>${fmtNum(gscThis.impressions)}</td><td>${arrow(gscThis.impressions, gscLast.impressions)} ${pct(gscThis.impressions, gscLast.impressions)}</td><td>${arrow(gscThis.impressions, gscLY.impressions)} ${pct(gscThis.impressions, gscLY.impressions)}</td></tr>
<tr><td><strong>Sessions (GA4)</strong></td><td>${fmtNum(ga4This.sessions)}</td><td>${arrow(ga4This.sessions, ga4Last.sessions)} ${pct(ga4This.sessions, ga4Last.sessions)} (${fmtNum(ga4Last.sessions)})</td><td>${arrow(ga4This.sessions, ga4LY.sessions)} ${pct(ga4This.sessions, ga4LY.sessions)} (${fmtNum(ga4LY.sessions)})</td></tr>
<tr><td><strong>Total users (GA4)</strong></td><td>${fmtNum(ga4This.totalUsers)}</td><td>${arrow(ga4This.totalUsers, ga4Last.totalUsers)} ${pct(ga4This.totalUsers, ga4Last.totalUsers)}</td><td>${arrow(ga4This.totalUsers, ga4LY.totalUsers)} ${pct(ga4This.totalUsers, ga4LY.totalUsers)}</td></tr>
<tr><td><strong>New users (GA4)</strong></td><td>${fmtNum(ga4This.newUsers)}</td><td>${arrow(ga4This.newUsers, ga4Last.newUsers)} ${pct(ga4This.newUsers, ga4Last.newUsers)}</td><td>${arrow(ga4This.newUsers, ga4LY.newUsers)} ${pct(ga4This.newUsers, ga4LY.newUsers)}</td></tr>
<tr><td><strong>Engaged sessions</strong></td><td>${fmtNum(ga4This.engagedSessions)} (${((ga4This.engagedSessions/Math.max(1, ga4This.sessions))*100).toFixed(1)}%)</td><td>${arrow(ga4This.engagedSessions, ga4Last.engagedSessions)} ${pct(ga4This.engagedSessions, ga4Last.engagedSessions)}</td><td>${arrow(ga4This.engagedSessions, ga4LY.engagedSessions)} ${pct(ga4This.engagedSessions, ga4LY.engagedSessions)}</td></tr>
</table>

<h2>13-month trend</h2>
<p><em>One line going up = real growth.</em></p>
<p><img src="${trendChartUrl}" alt="GSC clicks trend" style="max-width:100%"></p>
<p><img src="${gaTrendChartUrl}" alt="GA4 sessions trend" style="max-width:100%"></p>

<h2>Brand vs non-brand</h2>
<p><em>Non-brand growth is the real SEO growth signal.</em></p>
<p><img src="${brandChartUrl}" alt="Brand vs non-brand stack" style="max-width:100%"></p>
<table><tr><th>Segment</th><th>This month</th><th>vs last month</th><th>vs last year</th></tr>
<tr><td>Brand clicks</td><td>${fmtNum(brandThis.brandClicks)}</td><td>${arrow(brandThis.brandClicks, brandLast.brandClicks)} ${pct(brandThis.brandClicks, brandLast.brandClicks)}</td><td>${arrow(brandThis.brandClicks, brandLYData.brandClicks)} ${pct(brandThis.brandClicks, brandLYData.brandClicks)}</td></tr>
<tr><td><strong>Non-brand clicks</strong></td><td>${fmtNum(brandThis.nonBrandClicks)}</td><td>${arrow(brandThis.nonBrandClicks, brandLast.nonBrandClicks)} ${pct(brandThis.nonBrandClicks, brandLast.nonBrandClicks)}</td><td>${arrow(brandThis.nonBrandClicks, brandLYData.nonBrandClicks)} ${pct(brandThis.nonBrandClicks, brandLYData.nonBrandClicks)}</td></tr>
<tr><td>Non-brand impressions</td><td>${fmtNum(brandThis.nonBrandImpr)}</td><td>${arrow(brandThis.nonBrandImpr, brandLast.nonBrandImpr)} ${pct(brandThis.nonBrandImpr, brandLast.nonBrandImpr)}</td><td>${arrow(brandThis.nonBrandImpr, brandLYData.nonBrandImpr)} ${pct(brandThis.nonBrandImpr, brandLYData.nonBrandImpr)}</td></tr>
</table>

<h2>Top 10 pages — YoY</h2>
<p><img src="${pagesChartUrl}" alt="Top pages YoY" style="max-width:100%"></p>
<table><tr><th>Page</th><th>This month</th><th>Last year</th><th>YoY</th></tr>
${topPages.map((p: any) => `<tr><td>${p.path}</td><td>${fmtNum(p.thisClicks)}</td><td>${fmtNum(p.lastClicks)}</td><td>${arrow(p.thisClicks, p.lastClicks)} ${pct(p.thisClicks, p.lastClicks)}</td></tr>`).join("")}
</table>

<h2>YoY climbing queries (+5 clicks or more)</h2>
<table><tr><th>Δ</th><th>This mo</th><th>Last yr</th><th>Pos</th><th>Query</th></tr>
${queryMoves.climbers.length ? queryMoves.climbers.map((m: any) => `<tr><td><strong>+${m.delta}</strong></td><td>${m.thisClicks}</td><td>${m.lastClicks}</td><td>${m.position?.toFixed(1) || "—"}</td><td>${m.key}</td></tr>`).join("") : `<tr><td colspan="5"><em>—</em></td></tr>`}
</table>

<h2>YoY dropping queries</h2>
<table><tr><th>Δ</th><th>This mo</th><th>Last yr</th><th>Pos</th><th>Query</th></tr>
${queryMoves.droppers.length ? queryMoves.droppers.map((m: any) => `<tr><td><strong>${m.delta}</strong></td><td>${m.thisClicks}</td><td>${m.lastClicks}</td><td>${m.position?.toFixed(1) || "—"}</td><td>${m.key}</td></tr>`).join("") : `<tr><td colspan="5"><em>—</em></td></tr>`}
</table>

<h2>Channel mix</h2>
<p><img src="${channelChartUrl}" alt="Channel donut" style="max-width:100%"></p>
<table><tr><th>Channel</th><th>Sessions</th><th>Users</th><th>%</th></tr>
${ga4This.channels.map((c: any) => `<tr><td>${c.name}</td><td>${fmtNum(c.sessions)}</td><td>${fmtNum(c.users)}</td><td>${((c.sessions/Math.max(1, ga4This.sessions))*100).toFixed(1)}%</td></tr>`).join("")}
</table>

<h2>Top 15 landing pages</h2>
<table><tr><th>Page</th><th>Sessions</th><th>Users</th><th>Engaged</th></tr>
${ga4This.landingPages.slice(0, 15).map((p: any) => `<tr><td>${path(p.path)}</td><td>${fmtNum(p.sessions)}</td><td>${fmtNum(p.users)}</td><td>${fmtNum(p.engaged)}</td></tr>`).join("")}
</table>

<h2>SEO opportunities — high impressions, low CTR</h2>
<p><em>These rank but don't get clicked. Title + meta description rewrites should lift CTR.</em></p>
<table><tr><th>Query</th><th>Impr</th><th>Clicks</th><th>CTR</th><th>Pos</th></tr>
${opps.length ? opps.map((o: any) => `<tr><td>${o.keys[0]}</td><td>${fmtNum(o.impressions)}</td><td>${o.clicks}</td><td>${(o.ctr*100).toFixed(2)}%</td><td>${o.position.toFixed(1)}</td></tr>`).join("") : `<tr><td colspan="5"><em>None this month.</em></td></tr>`}
</table>

<hr>
<p><em>Auto-generated by zhealth-ai · 1st of month 8am ET · Sources: GSC sc-domain:zhealtheducation.com + GA4 ${process.env.GA4_PROPERTY_ID_WEBSITE}</em></p>
</div>`.trim();

  const summary = `Monthly ${monthName}: ${gscThis.clicks} clicks (YoY ${pct(gscThis.clicks, gscLY.clicks)}), ${ga4This.sessions} sessions (YoY ${pct(ga4This.sessions, ga4LY.sessions)})`;
  return { subject, content, summary };
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.CRON_SECRET && authHeader === expected) return true;
  const session = await getServerSession();
  if (session) return true;
  return false;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const monthOverride = url.searchParams.get("month") || undefined;
    const dryRun = url.searchParams.get("dry") === "1";
    const report = await buildReport(monthOverride);
    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, summary: report.summary, subject: report.subject, contentLength: report.content.length });
    }
    const result = await postMessageToBoard({ subject: report.subject, content: report.content });
    return NextResponse.json({ ok: true, summary: report.summary, basecamp: result });
  } catch (e: any) {
    console.error("seo-monthly-report failed:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
