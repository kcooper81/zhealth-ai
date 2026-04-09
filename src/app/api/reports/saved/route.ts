import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import * as db from "@/lib/db";
import { logError } from "@/lib/error-logger";

function getUserId(session: any): string {
  return session?.user?.email || "anonymous";
}

export async function GET() {
  try {
    const session = await requireAuth();
    const userId = getUserId(session);

    if (!isSupabaseConfigured) {
      return NextResponse.json([]);
    }

    const reports = await db.listSavedReports(userId);
    return NextResponse.json(reports);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to list saved reports";
    logError("api/reports/saved", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = getUserId(session);
    const body = await request.json();
    const { title, reportType, reportData, workspace } = body as {
      title: string;
      reportType: string;
      reportData: any;
      workspace?: string;
    };

    if (!title || !reportData) {
      return NextResponse.json({ error: "title and reportData are required" }, { status: 400 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const saved = await db.saveReport(userId, title, reportType || "general", reportData, workspace);
    return NextResponse.json(saved);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to save report";
    logError("api/reports/saved", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id parameter required" }, { status: 400 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const success = await db.deleteSavedReport(id);
    return NextResponse.json({ success });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete report";
    logError("api/reports/saved", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
