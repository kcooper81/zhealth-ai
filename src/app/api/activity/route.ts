import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getActivityLog } from "@/lib/db";
import { logError } from "@/lib/error-logger";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const workspace = searchParams.get("workspace") || undefined;
    const limit = Number(searchParams.get("limit")) || 50;
    const offset = Number(searchParams.get("offset")) || 0;

    const userId = (session as any)?.user?.email || (session as any)?.user?.id || "";
    const logs = await getActivityLog({ userId, workspace, limit, offset });

    return NextResponse.json(logs);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch activity";
    logError("api/activity", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
