import { NextRequest, NextResponse } from "next/server";
import {
  getConversation,
  updateConversation,
  deleteConversation,
} from "@/lib/conversations";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const conversation = await getConversation(params.id);
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
      }>;
      pageContextId?: number;
    };

    const updated = await updateConversation(params.id, {
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
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const deleted = await deleteConversation(params.id);
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
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
