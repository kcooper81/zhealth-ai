import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

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

    // Query messages that have non-null files, joining with conversations for context
    const { data: messages, error } = await supabase
      .from("messages")
      .select("id, files, created_at, conversation_id, conversations!inner(id, title, user_id)")
      .not("files", "is", null)
      .eq("conversations.user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("files API error:", error);
      return NextResponse.json([]);
    }

    // Flatten files from all messages
    const files: Array<{
      id: string;
      name: string;
      type: string;
      size: number;
      url?: string;
      preview?: string;
      date: string;
      conversationId: string;
      conversationTitle: string;
      messageId: string;
    }> = [];

    for (const msg of messages || []) {
      const msgFiles = msg.files as Array<{
        id: string;
        name: string;
        type: string;
        size: number;
        url?: string;
        preview?: string;
      }>;
      if (!Array.isArray(msgFiles)) continue;

      const conv = msg.conversations as any;
      for (const f of msgFiles) {
        files.push({
          id: f.id,
          name: f.name,
          type: f.type,
          size: f.size,
          url: f.url,
          preview: f.preview,
          date: msg.created_at,
          conversationId: msg.conversation_id,
          conversationTitle: conv?.title || "Unknown conversation",
          messageId: msg.id,
        });
      }
    }

    return NextResponse.json(files);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to list files";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
