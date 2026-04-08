import { NextRequest } from "next/server";
import { buildSystemPrompt } from "@/lib/claude";
import { streamAIChat, isValidModel, getAvailableModels, getDefaultModel, type AIModel } from "@/lib/ai-router";
import { parseActions } from "@/lib/actions";
import { getWordPressClient } from "@/lib/wordpress";
import { requireAuth } from "@/lib/auth";
import { discoverPlugins, buildPluginContext } from "@/lib/plugin-discovery";
import { getSystemPromptAddendum } from "@/lib/workspaces";
import type { Workspace } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { messages, pageContextId, conversationId, model: requestedModel, workspace: requestedWorkspace } = body as {
      messages: Array<{ role: string; content: string }>;
      pageContextId?: number;
      conversationId?: string;
      model?: string;
      workspace?: Workspace;
    };

    const workspace: Workspace = requestedWorkspace || "all";

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Determine which model to use — only allow models with configured keys
    const available = getAvailableModels();
    if (available.length === 0) {
      return new Response(
        JSON.stringify({ error: "No AI models configured. Add ANTHROPIC_API_KEY or GEMINI_API_KEY to environment variables." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    const model: AIModel =
      requestedModel && isValidModel(requestedModel) && available.includes(requestedModel as AIModel)
        ? (requestedModel as AIModel)
        : getDefaultModel();

    // Build context for system prompt
    let pages: Array<{
      id: number;
      title: string;
      status: string;
      url: string;
    }> = [];
    let currentPage:
      | { id: number; title: string; content: string; template?: string }
      | undefined;
    let pluginContextStr = "";

    // Only fetch WordPress context for website/all workspaces — not for CRM/analytics
    const needsWpContext = workspace === "all" || workspace === "website";

    try {
      const promises: Promise<unknown>[] = [
        discoverPlugins().catch(() => []),
      ];

      if (needsWpContext) {
        const wp = getWordPressClient();
        promises.push(wp.listPages({ per_page: 50 }).catch(() => []));
        if (pageContextId) {
          promises.push(wp.getPage(pageContextId, "edit").catch(() => null));
        }
      }

      const results = await Promise.all(promises);
      const plugins = results[0] as Awaited<ReturnType<typeof discoverPlugins>>;
      pluginContextStr = buildPluginContext(plugins || []);

      if (needsWpContext) {
        const wpPages = (results[1] || []) as Array<{ id: number; title: { rendered: string }; status: string; link: string }>;
        pages = wpPages.map((p) => ({
          id: p.id,
          title: p.title.rendered,
          status: p.status,
          url: p.link,
        }));

        const pageData = results[2] as { id: number; title: { raw?: string; rendered: string }; content: { raw?: string; rendered: string }; template?: string } | null | undefined;
        if (pageData) {
          currentPage = {
            id: pageData.id,
            title: pageData.title.raw || pageData.title.rendered,
            content: pageData.content.raw || pageData.content.rendered,
            template: pageData.template || "",
          };
        }
      }
    } catch (error) {
      console.error("Failed to fetch context:", error);
    }

    const systemPrompt = buildSystemPrompt({
      pages,
      currentPage,
      pluginContext: pluginContextStr,
    }) + getSystemPromptAddendum(workspace);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await streamAIChat(
            model,
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
            model,
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
