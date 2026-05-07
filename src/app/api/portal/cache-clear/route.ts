/**
 * POST /api/portal/cache-clear?prefix=gsc:|ga4:|keap:|...
 *
 * Invalidates all cached entries with the given prefix. Used after
 * config changes (enabling an API in Google Cloud, granting a scope,
 * mapping a new tag) to force the next page load to re-fetch fresh
 * data instead of waiting for the existing cache TTL to expire.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { cacheInvalidate } from "@/lib/cache";

export const dynamic = "force-dynamic";

const ALLOWED_PREFIXES = ["gsc:", "ga4:", "keap:", "thinkific:", "wp:", "seo:", "pagespeed:"];

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const prefix = url.searchParams.get("prefix") || "";

  // Validate prefix to prevent accidentally wiping unrelated cache
  // (saved-funnels:list, weekly-report:email-metrics:history, etc).
  if (!ALLOWED_PREFIXES.some((p) => prefix === p || prefix.startsWith(p))) {
    return NextResponse.json(
      { error: `prefix must start with one of: ${ALLOWED_PREFIXES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    await cacheInvalidate(prefix);
    return NextResponse.json({ ok: true, cleared: prefix });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cache invalidation failed" },
      { status: 500 }
    );
  }
}
