import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getPortalGa4Token } from "@/lib/reports/google-auth";
import { cacheRecomputeSWR } from "@/lib/cache";
import {
  computePageFlowSnapshot,
  pageFlowCacheKey,
  PAGE_FLOW_HARD_SECONDS,
} from "@/lib/reports/page-flow-data";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const VALID = new Set(["today", "7d", "30d", "90d", "12mo", "ytd", "all"]);

/**
 * Force-recompute the Page Flow snapshot for a range and store it in cache.
 * Protected by the portal auth middleware (any signed-in teammate). Also
 * callable by cron (Authorization: Bearer CRON_SECRET) once that env is set.
 */
async function handle(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronOk = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk) {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rangeKey = (url.searchParams.get("range") || "30d").trim();
  const key = VALID.has(rangeKey) ? rangeKey : "30d";

  const session = (await getServerSession()) as any;
  const token = await getPortalGa4Token(session?.accessToken);
  if (!token) return NextResponse.json({ error: "No GA4 token" }, { status: 500 });

  try {
    const ts = await cacheRecomputeSWR(pageFlowCacheKey(key), PAGE_FLOW_HARD_SECONDS, () =>
      computePageFlowSnapshot(token, key)
    );
    return NextResponse.json({ ok: true, range: key, updatedAt: ts });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "refresh failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}
export async function GET(req: NextRequest) {
  return handle(req);
}
