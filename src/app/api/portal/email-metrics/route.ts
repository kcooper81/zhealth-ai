import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { cacheGet, cacheSet } from "@/lib/cache";

export const dynamic = "force-dynamic";

const HISTORY_KEY = "weekly-report:email-metrics:history";
const TTL_1_YEAR = 365 * 24 * 60 * 60;
const MAX_HISTORY = 52; // keep ~1 year of weekly entries

type MetricRecord = {
  week_of: string;
  click_rate: number | null;
  open_rate: number | null;
  complaint_rate: number | null;
  unsubscribes_30d: number | null;
  unsubscribe_reasons: string | null;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
};

/**
 * GET — returns up to MAX_HISTORY weekly records, newest first.
 * Caller (the report page) takes [0] as "current" and [1] as "last week" for delta math.
 */
export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const history = (await cacheGet<MetricRecord[]>(HISTORY_KEY)) ?? [];
  return NextResponse.json({ history });
}

/**
 * POST — append/upsert a weekly record. If a record with the same week_of
 * already exists, replace it (idempotent re-saves). History is kept sorted
 * newest-first and capped at MAX_HISTORY entries.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { week_of, click_rate, open_rate, complaint_rate, unsubscribes_30d, unsubscribe_reasons, notes } = body || {};
    if (!week_of) return NextResponse.json({ error: "week_of required" }, { status: 400 });

    const record: MetricRecord = {
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

    const existing = (await cacheGet<MetricRecord[]>(HISTORY_KEY)) ?? [];
    const filtered = existing.filter((r) => r.week_of !== week_of);
    const next = [record, ...filtered]
      .sort((a, b) => b.week_of.localeCompare(a.week_of))
      .slice(0, MAX_HISTORY);

    await cacheSet(HISTORY_KEY, next, TTL_1_YEAR);

    return NextResponse.json({ ok: true, history: next });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 500 }
    );
  }
}
