/**
 * POST /api/portal/funnels/seed?mode=force
 *
 * Re-seeds the built-in preset funnels into the saved-funnel store.
 *   mode=if-empty (default) — only seeds when no saved funnels exist
 *   mode=force              — drops existing seed-* funnels and re-creates
 *                             fresh copies (preserves user-created customs)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { seedBuiltInFunnels } from "@/lib/saved-funnels";

export const dynamic = "force-dynamic";

async function requireAuth(): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return null;
}

export async function POST(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") === "force" ? "force" : "if-empty";
    const result = await seedBuiltInFunnels(mode);
    return NextResponse.json({ ...result, mode });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed failed" },
      { status: 500 }
    );
  }
}
