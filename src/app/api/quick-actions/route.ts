import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import * as db from "@/lib/db";
import { getQuickActions as getDefaultQuickActions } from "@/lib/workspaces";
import type { Workspace, QuickAction } from "@/lib/types";

function getUserId(session: any): string {
  return session?.user?.email || "anonymous";
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = getUserId(session);
    const workspace = request.nextUrl.searchParams.get("workspace") || "all";

    // Get default actions from workspaces.ts
    const defaults = getDefaultQuickActions(workspace as Workspace);

    if (!isSupabaseConfigured) {
      // No database -- return defaults only
      const actions: QuickAction[] = defaults.map((prompt, i) => ({
        id: `default-${i}`,
        label: prompt.length > 40 ? prompt.slice(0, 40) + "..." : prompt,
        prompt,
        isDefault: true,
        isHidden: false,
        sortOrder: i,
        workspace,
      }));
      return NextResponse.json(actions);
    }

    // Get user's custom/overridden actions from DB
    const dbActions = await db.getQuickActions(userId, workspace);

    // Build hidden set from DB (default actions the user chose to hide)
    const hiddenPrompts = new Set(
      dbActions
        .filter((a) => a.isDefault && a.isHidden)
        .map((a) => a.prompt)
    );

    // Build the merged list:
    // 1. Default actions (not hidden, not overridden)
    const defaultActions: QuickAction[] = defaults
      .filter((prompt) => !hiddenPrompts.has(prompt))
      .map((prompt, i) => {
        // Check if user has a DB row for this default (for reorder purposes)
        const dbRow = dbActions.find((a) => a.isDefault && a.prompt === prompt && !a.isHidden);
        return {
          id: dbRow?.id || `default-${i}`,
          label: dbRow?.label || (prompt.length > 40 ? prompt.slice(0, 40) + "..." : prompt),
          prompt,
          isDefault: true,
          isHidden: false,
          sortOrder: dbRow?.sortOrder ?? i,
          workspace,
        };
      });

    // 2. Custom (non-default) actions
    const customActions: QuickAction[] = dbActions
      .filter((a) => !a.isDefault)
      .map((a) => ({
        id: a.id,
        label: a.label,
        prompt: a.prompt,
        isDefault: false,
        isHidden: false,
        sortOrder: a.sortOrder,
        workspace: a.workspace,
      }));

    // Merge and sort by sortOrder
    const merged = [...defaultActions, ...customActions].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );

    return NextResponse.json(merged);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to get quick actions";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = getUserId(session);
    const body = await request.json();

    // Handle special actions
    if (body.action === "hide") {
      if (!isSupabaseConfigured) {
        return NextResponse.json({ error: "Database not configured" }, { status: 503 });
      }
      const result = await db.hideDefaultAction(userId, body.workspace, body.prompt);
      if (!result) {
        return NextResponse.json({ error: "Failed to hide action" }, { status: 500 });
      }
      return NextResponse.json(result);
    }

    if (body.action === "reorder") {
      if (!isSupabaseConfigured) {
        return NextResponse.json({ error: "Database not configured" }, { status: 503 });
      }
      const success = await db.reorderQuickActions(userId, body.workspace, body.orderedIds);
      if (!success) {
        return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "reset") {
      if (!isSupabaseConfigured) {
        return NextResponse.json({ error: "Database not configured" }, { status: 503 });
      }
      const success = await db.resetQuickActions(userId, body.workspace);
      if (!success) {
        return NextResponse.json({ error: "Failed to reset" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    // Default: create new quick action
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const { workspace, label, prompt } = body;
    if (!workspace || !label || !prompt) {
      return NextResponse.json(
        { error: "workspace, label, and prompt are required" },
        { status: 400 }
      );
    }

    const action = await db.saveQuickAction(userId, workspace, label, prompt);
    if (!action) {
      return NextResponse.json({ error: "Failed to save quick action" }, { status: 500 });
    }
    return NextResponse.json(action);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create quick action";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const { id, label, prompt, sort_order } = body;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updated = await db.updateQuickAction(id, { label, prompt, sort_order });
    if (!updated) {
      return NextResponse.json({ error: "Failed to update quick action" }, { status: 500 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to update quick action";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const success = await db.deleteQuickAction(id);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete quick action" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to delete quick action";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
