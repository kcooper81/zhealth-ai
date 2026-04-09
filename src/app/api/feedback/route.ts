import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { logError } from "@/lib/error-logger";

export async function POST(request: NextRequest) {
  try {
    const { messageId, rating, conversationId } = await request.json();
    await db.logActivity("system", "feedback", {
      targetType: "message",
      targetId: messageId,
      extra: { rating, conversationId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError("api/feedback", errorMessage);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
