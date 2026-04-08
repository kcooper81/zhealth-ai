import { NextRequest, NextResponse } from "next/server";
import { executeAction } from "@/lib/actions";
import type { PendingAction } from "@/lib/types";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { actionId, action } = body as {
      actionId: string;
      action: PendingAction;
    };

    if (!actionId || !action) {
      return NextResponse.json(
        { error: "actionId and action are required" },
        { status: 400 }
      );
    }

    if (!action.type || !action.params) {
      return NextResponse.json(
        { error: "Action must include type and params" },
        { status: 400 }
      );
    }

    const result = await executeAction(action);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to execute action";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
