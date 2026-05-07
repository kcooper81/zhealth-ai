import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { cacheGet, cacheSet } from "@/lib/cache";

export const dynamic = "force-dynamic";

const CACHE_KEY = "weekly-report:email-metrics:latest";
const TTL_30_DAYS = 30 * 24 * 60 * 60;

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await cacheGet<unknown>(CACHE_KEY);
  return NextResponse.json({ data: data ?? null });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { week_of, click_rate, open_rate, complaint_rate, unsubscribes_30d, unsubscribe_reasons, notes } = body || {};
    if (!week_of) return NextResponse.json({ error: "week_of required" }, { status: 400 });

    const record = {
      week_of,
      click_rate: typeof click_rate === "number" ? click_rate : null,
      open_rate: typeof open_rate === "number" ? open_rate : null,
      complaint_rate: typeof complaint_rate === "number" ? complaint_rate : null,
      unsubscribes_30d: typeof unsubscribes_30d === "number" ? unsubscribes_30d : null,
      unsubscribe_reasons: typeof unsubscribe_reasons === "string" ? unsubscribe_reasons : null,
      notes: typeof notes === "string" ? notes : null,
      updated_at: new Date().toISOString(),
      updated_by: (session as any).user?.email ?? null,
    };

    await cacheSet(CACHE_KEY, record, TTL_30_DAYS);

    return NextResponse.json({ ok: true, data: record });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 500 }
    );
  }
}
