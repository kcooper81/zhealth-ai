/**
 * Combined SEO report dispatcher — runs daily at 13:00 UTC (8am ET).
 *   - On Monday → POST /api/cron/seo-weekly-report internally
 *   - On day 1 of month → POST /api/cron/seo-monthly-report internally
 *   - Otherwise: noop
 *
 * Single Vercel cron slot. Lets us deliver both reports without hitting the
 * Hobby plan's cron-count limit.
 *
 * Manual triggers via query params:
 *   ?run=weekly             → force weekly run regardless of weekday
 *   ?run=monthly            → force monthly run
 *   ?run=weekly&dry=1       → dry preview
 *   ?run=monthly&month=2026-04  → run for a specific month
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.CRON_SECRET && authHeader === expected) return true;
  const session = await getServerSession();
  if (session) return true;
  return false;
}

async function callInternal(req: NextRequest, path: string): Promise<any> {
  const base = process.env.NEXTAUTH_URL || `https://${req.headers.get("host")}`;
  const r = await fetch(base + path, {
    method: "GET",
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!(await isAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const forceRun = url.searchParams.get("run"); // "weekly" | "monthly"
  const dry = url.searchParams.get("dry");
  const monthOverride = url.searchParams.get("month");
  const today = new Date();
  const dow = today.getUTCDay(); // 0=Sun, 1=Mon
  const dom = today.getUTCDate(); // 1-31
  const runWeekly = forceRun === "weekly" || (!forceRun && dow === 1);
  const runMonthly = forceRun === "monthly" || (!forceRun && dom === 1);

  const results: Record<string, any> = {};

  if (runWeekly) {
    const q = dry === "1" ? "?dry=1" : "";
    const r = await callInternal(req, "/api/cron/seo-weekly-report" + q);
    results.weekly = r;
  }
  if (runMonthly) {
    const params = new URLSearchParams();
    if (dry === "1") params.set("dry", "1");
    if (monthOverride) params.set("month", monthOverride);
    const q = params.toString() ? "?" + params.toString() : "";
    const r = await callInternal(req, "/api/cron/seo-monthly-report" + q);
    results.monthly = r;
  }

  if (!runWeekly && !runMonthly) {
    return NextResponse.json({ ok: true, skipped: true, dow, dom });
  }

  return NextResponse.json({ ok: true, ranWeekly: runWeekly, ranMonthly: runMonthly, results });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
