import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import * as db from "@/lib/db";
import {
  listConversations as listConversationsFile,
  createConversation as createConversationFile,
} from "@/lib/conversations";

/** Derive a stable user ID from the session, or fall back to a default. */
function getUserId(session: any): string {
  return session?.user?.email || "anonymous";
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = getUserId(session);
    const { searchParams } = new URL(request.url);
    const workspace = searchParams.get("workspace") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // If Supabase is configured, use the database
    if (isSupabaseConfigured) {
      const conversations = await db.listConversations(userId, workspace, limit);
      return NextResponse.json(conversations);
    }

    // Fallback to file-based storage
    const conversations = await listConversationsFile();
    return NextResponse.json(conversations);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to list conversations";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = getUserId(session);
    const body = await request.json();
    const { title, pageContextId, workspace } = body as {
      title?: string;
      pageContextId?: number;
      workspace?: string;
    };

    if (isSupabaseConfigured) {
      const conversation = await db.createConversation(
        userId,
        title || "New conversation",
        workspace || "all",
        pageContextId,
        session?.user?.email || undefined
      );
      if (!conversation) {
        return NextResponse.json(
          { error: "Failed to create conversation in database" },
          { status: 500 }
        );
      }
      return NextResponse.json(conversation, { status: 201 });
    }

    // Fallback
    const conversation = await createConversationFile(title, pageContextId);
    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to create conversation";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
