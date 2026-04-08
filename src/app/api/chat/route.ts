import { NextRequest } from "next/server";
import { streamChat, buildSystemPrompt } from "@/lib/claude";
import { parseActions } from "@/lib/actions";
import { getWordPressClient } from "@/lib/wordpress";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, pageContextId, conversationId } = body as {
      messages: Array<{ role: string; content: string }>;
      pageContextId?: number;
      conversationId?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build context for system prompt
    let pages: Array<{
      id: number;
      title: string;
      status: string;
      url: string;
    }> = [];
    let currentPage:
      | { id: number; title: string; content: string }
      | undefined;

    try {
      const wp = getWordPressClient();
      const wpPages = await wp.listPages({ per_page: 50 });
      pages = wpPages.map((p) => ({
        id: p.id,
        title: p.title.rendered,
        status: p.status,
        url: p.link,
      }));

      if (pageContextId) {
        const page = await wp.getPage(pageContextId, "edit");
        currentPage = {
          id: page.id,
          title: page.title.raw || page.title.rendered,
          content: page.content.raw || page.content.rendered,
        };
      }
    } catch (error) {
      // WordPress may not be reachable; proceed without context
      console.error("Failed to fetch WordPress context:", error);
    }

    const systemPrompt = buildSystemPrompt({
      pages,
      currentPage,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await streamChat(
            messages,
            systemPrompt,
            (text: string) => {
              const chunk = JSON.stringify({ type: "token", text });
              controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
            }
          );

          const { message, pendingAction } = parseActions(result.content);

          const doneChunk = JSON.stringify({
            type: "done",
            message,
            pendingAction,
            usage: {
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
            },
            conversationId,
          });
          controller.enqueue(encoder.encode(`data: ${doneChunk}\n\n`));
          controller.close();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Stream failed";
          const errorChunk = JSON.stringify({
            type: "error",
            error: errorMessage,
          });
          controller.enqueue(encoder.encode(`data: ${errorChunk}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
