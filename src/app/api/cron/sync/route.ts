import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { refreshAll } from "@/lib/snapshot";
import { logError } from "@/lib/error-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Two auth paths:
 * 1. Vercel Cron — Vercel automatically sets Authorization: Bearer ${CRON_SECRET}
 *    when the env var is configured. Used for scheduled runs (vercel.json).
 * 2. Authenticated user (any @zhealth.net Google OAuth session) — used by the
 *    "Refresh data" button in the portal UI for on-demand sync.
 */
async function isAuthorized(req: NextRequest): Promise<boolean> {
  // Cron path
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.CRON_SECRET && authHeader === expected) {
    return true;
  }

  // Manual path: signed-in @zhealth.net user
  const session = await getServerSession();
  if (session) return true;

  return false;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const ok = await isAuthorized(req);
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const meta = await refreshAll();
    return NextResponse.json({
      ok: true,
      ...meta,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    logError("cron:sync", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
