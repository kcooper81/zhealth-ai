import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import * as db from "@/lib/db";
import {
  getConversation as getConversationFile,
  updateConversation as updateConversationFile,
  deleteConversation as deleteConversationFile,
} from "@/lib/conversations";
import { requireAuth } from "@/lib/auth";
import { logError } from "@/lib/error-logger";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();

    if (isSupabaseConfigured) {
      const conversation = await db.getConversation(params.id);
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(conversation);
    }

    // Fallback
    const conversation = await getConversationFile(params.id);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(conversation);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to fetch conversation";
    logError("api/conversations/[id]", errorMessage, { id: params.id });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const body = await request.json();
    const { title, messages, pageContextId } = body as {
      title?: string;
      messages?: Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
        timestamp: string;
        files?: any;
        pendingAction?: any;
        actionResult?: any;
        reportData?: any;
      }>;
      pageContextId?: number;
    };

    if (isSupabaseConfigured) {
      // Update conversation metadata (title) if provided
      if (title !== undefined) {
        await db.updateConversation(params.id, { title });
      }

      // If messages are provided, sync them: add any new messages
      // We use a simple strategy: fetch existing messages, add any that are new
      if (messages && messages.length > 0) {
        const existing = await db.getConversation(params.id);
        const existingIds = new Set(
          (existing?.messages || []).map((m) => m.id)
        );

        for (const msg of messages) {
          if (!existingIds.has(msg.id)) {
            await db.addMessage(params.id, {
              role: msg.role,
              content: msg.content,
              files: msg.files || null,
              pendingAction: msg.pendingAction || null,
              actionResult: msg.actionResult || null,
              reportData: msg.reportData || null,
            });
          }
        }
      }

      // Return updated conversation
      const updated = await db.getConversation(params.id);
      if (!updated) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(updated);
    }

    // Fallback
    const updated = await updateConversationFile(params.id, {
      title,
      messages,
      pageContextId,
    });
    if (!updated) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to update conversation";
    logError("api/conversations/[id]", errorMessage, { id: params.id });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();

    if (isSupabaseConfigured) {
      const deleted = await db.deleteConversation(params.id);
      if (!deleted) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true });
    }

    // Fallback
    const deleted = await deleteConversationFile(params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to delete conversation";
    logError("api/conversations/[id]", errorMessage, { id: params.id });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
