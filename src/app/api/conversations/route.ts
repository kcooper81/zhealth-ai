import { NextRequest, NextResponse } from "next/server";
import {
  listConversations,
  createConversation,
} from "@/lib/conversations";

export async function GET() {
  try {
    const conversations = await listConversations();
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
    const body = await request.json();
    const { title, pageContextId } = body as {
      title?: string;
      pageContextId?: number;
    };

    const conversation = await createConversation(title, pageContextId);
    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to create conversation";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
