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
      // No database — client should use its own localStorage values
      return NextResponse.json({ source: "local" });
    }

    const prefs = await db.getUserPreferences(userId);
    if (!prefs) {
      return NextResponse.json({ source: "local" });
    }

    return NextResponse.json({
      source: "database",
      selectedModel: prefs.selectedModel,
      workspace: prefs.workspace,
      theme: prefs.theme,
      sidebarCollapsed: prefs.sidebarCollapsed,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to get preferences";
    logError("api/preferences", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = getUserId(session);
    const body = await request.json();

    if (!isSupabaseConfigured) {
      // Nothing to persist server-side
      return NextResponse.json({ source: "local", ok: true });
    }

    const { selectedModel, workspace, theme, sidebarCollapsed } = body as {
      selectedModel?: string;
      workspace?: string;
      theme?: string;
      sidebarCollapsed?: boolean;
    };

    const updated = await db.updateUserPreferences(userId, {
      userEmail: session?.user?.email || undefined,
      selectedModel,
      workspace,
      theme,
      sidebarCollapsed,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      source: "database",
      selectedModel: updated.selectedModel,
      workspace: updated.workspace,
      theme: updated.theme,
      sidebarCollapsed: updated.sidebarCollapsed,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to update preferences";
    logError("api/preferences", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
