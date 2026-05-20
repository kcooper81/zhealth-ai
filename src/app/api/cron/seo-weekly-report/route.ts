/**
 * Weekly SEO + traffic pulse — runs every Monday 8am ET via Vercel cron.
 *
 * Pulls GSC + GA4 for last 7 days vs prior 7 days vs same 7 days last year,
 * formats as HTML, and posts to the SEO project's Message Board in Basecamp.
 *
 * Authorization: Vercel automatically sets Authorization: Bearer ${CRON_SECRET}
 * when the cron fires; manual invocations from authenticated @zhealth.net users
 * are also allowed via the portal session.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getGoogleAccessToken } from "@/lib/reports/google-auth";
import { postMessageToBoard } from "@/lib/reports/basecamp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GSC_SITE = "sc-domain:zhealtheducation.com";
const BRAND_RE = /\b(z-?health|zhealth|z health|dr.?cobb|eric.?cobb)\b/i;

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d; }
function pct(a: number, b: number) { if (!b) return a ? "—" : "0%"; const v = ((a - b) / b) * 100; return (v >= 0 ? "+" : "") + v.toFixed(1) + "%"; }
function arrow(a: number, b: number) { return a > b ? "▲" : a < b ? "▼" : "→"; }
function fmtNum(n: number) { return Math.round(n).toLocaleString(); }
function path(url: string) { return (url || "").replace(/^https?:\/\/[^/]+/, ""); }

async function gscQuery(token: string, body: object): Promise<any[]> {
  const r = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(GSC_SITE) + "/searchAnalytics/query", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("GSC " + r.status + ": " + await r.text());
  const json = await r.json();
  return json.rows || [];
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

async function buildReport(): Promise<{ subject: string; content: string; summary: string }> {
  const token = await getGoogleAccessToken();
  const lagDays = 3;
  const periods = {
    thisWeek:  { start: fmtDate(daysAgo(lagDays + 6)),   end: fmtDate(daysAgo(lagDays))      },
    priorWeek: { start: fmtDate(daysAgo(lagDays + 13)),  end: fmtDate(daysAgo(lagDays + 7))  },
    lastYear:  { start: fmtDate(daysAgo(lagDays + 6 + 365)), end: fmtDate(daysAgo(lagDays + 365)) },
  };

  async function gscFor(p: { start: string; end: string }) {
    const totals = await gscQuery(token, { startDate: p.start, endDate: p.end, dimensions: [], dataState: "all" });
    const queries = await gscQuery(token, { startDate: p.start, endDate: p.end, dimensions: ["query"], rowLimit: 500, dataState: "all" });
    const pages = await gscQuery(token, { startDate: p.start, endDate: p.end, dimensions: ["page"], rowLimit: 500, dataState: "all" });
    return { clicks: totals[0]?.clicks || 0, impressions: totals[0]?.impressions || 0, queries, pages };
  }
  async function ga4For(p: { start: string; end: string }) {
    const totals = await ga4Query(token, {
      dateRanges: [{ startDate: p.start, endDate: p.end }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "newUsers" }, { name: "engagedSessions" }, { name: "screenPageViews" }],
    });
    const channels = await ga4Query(token, {
      dateRanges: [{ startDate: p.start, endDate: p.end }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      limit: 20,
    });
    const landingPages = await ga4Query(token, {
      dateRanges: [{ startDate: p.start, endDate: p.end }],
      dimensions: [{ name: "landingPagePlusQueryString" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 25,
    });
    const row = totals.rows?.[0]?.metricValues || [];
    return {
      sessions: parseInt(row[0]?.value || "0"),
      totalUsers: parseInt(row[1]?.value || "0"),
      newUsers: parseInt(row[2]?.value || "0"),
      engagedSessions: parseInt(row[3]?.value || "0"),
      pageviews: parseInt(row[4]?.value || "0"),
      channels: (channels.rows || []).map((r: any) => ({ name: r.dimensionValues[0].value, sessions: parseInt(r.metricValues[0].value), users: parseInt(r.metricValues[1].value) })),
      landingPages: (landingPages.rows || []).map((r: any) => ({ path: r.dimensionValues[0].value, sessions: parseInt(r.metricValues[0].value), users: parseInt(r.metricValues[1].value) })),
    };
  }

  const gsc = {
    thisWeek: await gscFor(periods.thisWeek),
    priorWeek: await gscFor(periods.priorWeek),
    lastYear: await gscFor(periods.lastYear),
  };
  const ga4 = {
    thisWeek: await ga4For(periods.thisWeek),
    priorWeek: await ga4For(periods.priorWeek),
    lastYear: await ga4For(periods.lastYear),
  };

  function topMovers(thisList: any[], priorList: any[], topN = 5) {
    const priorMap = new Map(priorList.map((r: any) => [r.keys[0], r]));
    const moves = thisList.map((r: any) => {
      const prev = priorMap.get(r.keys[0]) as any;
      return { key: r.keys[0], thisClicks: r.clicks, priorClicks: prev?.clicks || 0, delta: r.clicks - (prev?.clicks || 0), position: r.position, impressions: r.impressions };
    });
    const climbers = moves.filter((m: any) => m.delta >= 3).sort((a: any, b: any) => b.delta - a.delta).slice(0, topN);
    const droppedOut = priorList.filter((r: any) => r.clicks >= 5 && !thisList.find((t: any) => t.keys[0] === r.keys[0])).map((r: any) => ({ key: r.keys[0], thisClicks: 0, priorClicks: r.clicks, delta: -r.clicks, position: r.position }));
    const droppersIn = moves.filter((m: any) => m.delta <= -3).sort((a: any, b: any) => a.delta - b.delta);
    const droppers = [...droppersIn, ...droppedOut].sort((a: any, b: any) => a.delta - b.delta).slice(0, topN);
    return { climbers, droppers };
  }

  const queryMoves = topMovers(gsc.thisWeek.queries, gsc.priorWeek.queries);
  const pageMoves = topMovers(gsc.thisWeek.pages, gsc.priorWeek.pages);

  function brandSplit(rows: any[]) {
    let bC = 0, bI = 0, nC = 0, nI = 0;
    for (const r of rows) { if (BRAND_RE.test(r.keys[0])) { bC += r.clicks; bI += r.impressions; } else { nC += r.clicks; nI += r.impressions; } }
    return { brand: { clicks: bC, impressions: bI }, nonBrand: { clicks: nC, impressions: nI } };
  }
  const brandThis = brandSplit(gsc.thisWeek.queries);
  const brandPrior = brandSplit(gsc.priorWeek.queries);
  const brandLY = brandSplit(gsc.lastYear.queries);

  const subject = `Weekly SEO Pulse — ${periods.thisWeek.start} → ${periods.thisWeek.end}`;
  const content = `
<div>
<h1>${subject}</h1>
<p><em>This week:</em> ${periods.thisWeek.start} → ${periods.thisWeek.end}<br>
<em>Prior week:</em> ${periods.priorWeek.start} → ${periods.priorWeek.end}<br>
<em>Same week last year:</em> ${periods.lastYear.start} → ${periods.lastYear.end}</p>

<h2>Headline numbers</h2>
<table><tr><th>Metric</th><th>This week</th><th>vs prior week</th><th>vs last year</th></tr>
<tr><td><strong>Organic clicks (GSC)</strong></td><td>${fmtNum(gsc.thisWeek.clicks)}</td><td>${arrow(gsc.thisWeek.clicks, gsc.priorWeek.clicks)} ${pct(gsc.thisWeek.clicks, gsc.priorWeek.clicks)} (${fmtNum(gsc.priorWeek.clicks)})</td><td>${arrow(gsc.thisWeek.clicks, gsc.lastYear.clicks)} ${pct(gsc.thisWeek.clicks, gsc.lastYear.clicks)} (${fmtNum(gsc.lastYear.clicks)})</td></tr>
<tr><td><strong>Organic impressions</strong></td><td>${fmtNum(gsc.thisWeek.impressions)}</td><td>${arrow(gsc.thisWeek.impressions, gsc.priorWeek.impressions)} ${pct(gsc.thisWeek.impressions, gsc.priorWeek.impressions)}</td><td>${arrow(gsc.thisWeek.impressions, gsc.lastYear.impressions)} ${pct(gsc.thisWeek.impressions, gsc.lastYear.impressions)}</td></tr>
<tr><td><strong>Sessions (GA4)</strong></td><td>${fmtNum(ga4.thisWeek.sessions)}</td><td>${arrow(ga4.thisWeek.sessions, ga4.priorWeek.sessions)} ${pct(ga4.thisWeek.sessions, ga4.priorWeek.sessions)} (${fmtNum(ga4.priorWeek.sessions)})</td><td>${arrow(ga4.thisWeek.sessions, ga4.lastYear.sessions)} ${pct(ga4.thisWeek.sessions, ga4.lastYear.sessions)} (${fmtNum(ga4.lastYear.sessions)})</td></tr>
<tr><td><strong>Total users (GA4)</strong></td><td>${fmtNum(ga4.thisWeek.totalUsers)}</td><td>${arrow(ga4.thisWeek.totalUsers, ga4.priorWeek.totalUsers)} ${pct(ga4.thisWeek.totalUsers, ga4.priorWeek.totalUsers)}</td><td>${arrow(ga4.thisWeek.totalUsers, ga4.lastYear.totalUsers)} ${pct(ga4.thisWeek.totalUsers, ga4.lastYear.totalUsers)}</td></tr>
<tr><td><strong>New users (GA4)</strong></td><td>${fmtNum(ga4.thisWeek.newUsers)}</td><td>${arrow(ga4.thisWeek.newUsers, ga4.priorWeek.newUsers)} ${pct(ga4.thisWeek.newUsers, ga4.priorWeek.newUsers)}</td><td>${arrow(ga4.thisWeek.newUsers, ga4.lastYear.newUsers)} ${pct(ga4.thisWeek.newUsers, ga4.lastYear.newUsers)}</td></tr>
</table>

<h2>Brand vs non-brand</h2>
<p><em>Non-brand growth = real SEO growth.</em></p>
<table><tr><th>Segment</th><th>This week</th><th>vs prior week</th><th>vs last year</th></tr>
<tr><td>Brand clicks</td><td>${fmtNum(brandThis.brand.clicks)}</td><td>${arrow(brandThis.brand.clicks, brandPrior.brand.clicks)} ${pct(brandThis.brand.clicks, brandPrior.brand.clicks)}</td><td>${arrow(brandThis.brand.clicks, brandLY.brand.clicks)} ${pct(brandThis.brand.clicks, brandLY.brand.clicks)}</td></tr>
<tr><td><strong>Non-brand clicks</strong></td><td>${fmtNum(brandThis.nonBrand.clicks)}</td><td>${arrow(brandThis.nonBrand.clicks, brandPrior.nonBrand.clicks)} ${pct(brandThis.nonBrand.clicks, brandPrior.nonBrand.clicks)}</td><td>${arrow(brandThis.nonBrand.clicks, brandLY.nonBrand.clicks)} ${pct(brandThis.nonBrand.clicks, brandLY.nonBrand.clicks)}</td></tr>
<tr><td>Non-brand impressions</td><td>${fmtNum(brandThis.nonBrand.impressions)}</td><td>${arrow(brandThis.nonBrand.impressions, brandPrior.nonBrand.impressions)} ${pct(brandThis.nonBrand.impressions, brandPrior.nonBrand.impressions)}</td><td>${arrow(brandThis.nonBrand.impressions, brandLY.nonBrand.impressions)} ${pct(brandThis.nonBrand.impressions, brandLY.nonBrand.impressions)}</td></tr>
</table>

<h2>Top climbing queries (WoW)</h2>
<table><tr><th>Δ</th><th>This wk</th><th>Prior wk</th><th>Pos</th><th>Query</th></tr>
${queryMoves.climbers.length ? queryMoves.climbers.map((m: any) => `<tr><td><strong>+${m.delta}</strong></td><td>${m.thisClicks}</td><td>${m.priorClicks}</td><td>${m.position?.toFixed(1) || "—"}</td><td>${m.key}</td></tr>`).join("") : `<tr><td colspan="5"><em>No queries gained 3+ clicks this week.</em></td></tr>`}
</table>

<h2>Top dropping queries (WoW)</h2>
<table><tr><th>Δ</th><th>This wk</th><th>Prior wk</th><th>Pos</th><th>Query</th></tr>
${queryMoves.droppers.length ? queryMoves.droppers.map((m: any) => `<tr><td><strong>${m.delta}</strong></td><td>${m.thisClicks}</td><td>${m.priorClicks}</td><td>${m.position?.toFixed(1) || "—"}</td><td>${m.key}</td></tr>`).join("") : `<tr><td colspan="5"><em>No queries lost 3+ clicks this week.</em></td></tr>`}
</table>

<h2>Top climbing pages (WoW)</h2>
<table><tr><th>Δ</th><th>This wk</th><th>Prior wk</th><th>Page</th></tr>
${pageMoves.climbers.map((m: any) => `<tr><td><strong>+${m.delta}</strong></td><td>${m.thisClicks}</td><td>${m.priorClicks}</td><td>${path(m.key)}</td></tr>`).join("")}
</table>

<h2>Top dropping pages (WoW)</h2>
<table><tr><th>Δ</th><th>This wk</th><th>Prior wk</th><th>Page</th></tr>
${pageMoves.droppers.length ? pageMoves.droppers.map((m: any) => `<tr><td><strong>${m.delta}</strong></td><td>${m.thisClicks}</td><td>${m.priorClicks}</td><td>${path(m.key)}</td></tr>`).join("") : `<tr><td colspan="4"><em>No pages lost 3+ clicks this week.</em></td></tr>`}
</table>

<h2>Channel mix (GA4)</h2>
<table><tr><th>Channel</th><th>Sessions</th><th>Users</th><th>% of sessions</th></tr>
${ga4.thisWeek.channels.map((c: any) => `<tr><td>${c.name}</td><td>${fmtNum(c.sessions)}</td><td>${fmtNum(c.users)}</td><td>${((c.sessions / ga4.thisWeek.sessions) * 100).toFixed(1)}%</td></tr>`).join("")}
</table>

<h2>Top 10 landing pages by sessions</h2>
<table><tr><th>Sessions</th><th>Users</th><th>Page</th></tr>
${ga4.thisWeek.landingPages.slice(0, 10).map((p: any) => `<tr><td>${fmtNum(p.sessions)}</td><td>${fmtNum(p.users)}</td><td>${path(p.path)}</td></tr>`).join("")}
</table>

<hr>
<p><em>Auto-generated by zhealth-ai · Posts every Monday 8am ET · Sources: Google Search Console (sc-domain:zhealtheducation.com) + GA4 ${process.env.GA4_PROPERTY_ID_WEBSITE}</em></p>
</div>`.trim();

  const summary = `Weekly: ${gsc.thisWeek.clicks} clicks (YoY ${pct(gsc.thisWeek.clicks, gsc.lastYear.clicks)}), ${ga4.thisWeek.sessions} sessions (YoY ${pct(ga4.thisWeek.sessions, ga4.lastYear.sessions)})`;
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
    const report = await buildReport();
    const dryRun = new URL(req.url).searchParams.get("dry") === "1";
    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, summary: report.summary, subject: report.subject, contentLength: report.content.length });
    }
    const result = await postMessageToBoard({ subject: report.subject, content: report.content });
    return NextResponse.json({ ok: true, summary: report.summary, basecamp: result });
  } catch (e: any) {
    console.error("seo-weekly-report failed:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
