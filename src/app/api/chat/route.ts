import { NextRequest } from "next/server";
import { buildSystemPrompt, summarizeElementorData } from "@/lib/claude";
import { streamAIChat, isValidModel, getAvailableModels, getDefaultModel, type AIModel } from "@/lib/ai-router";
import { parseActions } from "@/lib/actions";
import { parseReport } from "@/lib/report-parser";
import { getWordPressClient } from "@/lib/wordpress";
import { requireAuth } from "@/lib/auth";
import { discoverPlugins, buildPluginContext } from "@/lib/plugin-discovery";
import { getSystemPromptAddendum } from "@/lib/workspaces";
import { getThinkificContext, isConfigured as isThinkificConfigured, getCourse, listEnrollments } from "@/lib/thinkific";
import { getKeapContext, isConfigured as isKeapConfigured, getContact } from "@/lib/keap";
import { getAnalyticsContext, isConfigured as isAnalyticsConfigured, getTrafficOverview } from "@/lib/google-analytics";
import { logError, logWarn } from "@/lib/error-logger";
import type { Workspace, FileAttachment } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const authSession = await requireAuth();
    const body = await request.json();
    const { messages, pageContextId, conversationId, model: requestedModel, workspace: requestedWorkspace, files: requestFiles, contactId, courseId } = body as {
      messages: Array<{ role: string; content: string }>;
      pageContextId?: number;
      conversationId?: string;
      model?: string;
      workspace?: Workspace;
      files?: FileAttachment[];
      contactId?: number;
      courseId?: number;
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
      logWarn("api/chat", "No AI models configured", { availableKeys: "none" });
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
      | { id: number; title: string; content: string; template?: string; elementorSummary?: string }
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

        const pageData = results[2] as { id: number; title: { raw?: string; rendered: string }; content: { raw?: string; rendered: string }; template?: string; meta?: Record<string, unknown> } | null | undefined;
        if (pageData) {
          currentPage = {
            id: pageData.id,
            title: pageData.title.raw || pageData.title.rendered,
            content: pageData.content.raw || pageData.content.rendered,
            template: pageData.template || "",
          };

          // Fetch Elementor structure if this is an Elementor page
          const tpl = pageData.template || "";
          if (tpl.includes("elementor") || (pageData.meta && pageData.meta._elementor_edit_mode)) {
            try {
              const wpClient = getWordPressClient();
              const elementorData = await wpClient.getElementorData(pageData.id);
              if (elementorData && elementorData.length > 0) {
                (currentPage as { elementorSummary?: string }).elementorSummary =
                  summarizeElementorData(elementorData);
              }
            } catch {
              // Elementor data not available -- continue without it
            }
          }
        }
      }
    } catch (error) {
      const ctxMsg = error instanceof Error ? error.message : "Unknown context error";
      logWarn("api/chat", "Failed to fetch WordPress/plugin context", { error: ctxMsg, workspace });
    }

    // Add integration-specific context based on workspace
    let integrationContext = "";
    if ((workspace === "lms" || workspace === "all") && isThinkificConfigured()) {
      integrationContext += getThinkificContext();
    }
    if ((workspace === "crm" || workspace === "all") && isKeapConfigured()) {
      integrationContext += getKeapContext();
    }
    if ((workspace === "analytics" || workspace === "all") && isAnalyticsConfigured()) {
      integrationContext += getAnalyticsContext();
    }

    // Fetch selected contact details if provided
    let currentContact: { id: number; name: string; email: string; tags: string[] } | undefined;
    if (contactId && isKeapConfigured()) {
      try {
        const contact = await getContact(contactId);
        const name = `${contact.given_name || ""} ${contact.family_name || ""}`.trim() || "Unknown";
        const email = contact.email_addresses?.[0]?.email || "";
        const tags = (contact.tag_ids || []).map((t) => String(t));
        currentContact = { id: contactId, name, email, tags };
      } catch (err) {
        logWarn("api/chat", "Failed to fetch contact", { contactId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Fetch selected course details if provided
    let currentCourse: { id: number; name: string; status: string; enrollmentCount: number } | undefined;
    if (courseId && isThinkificConfigured()) {
      try {
        const [course, enrollments] = await Promise.all([
          getCourse(courseId),
          listEnrollments({ course_id: courseId, limit: 1 }).catch(() => ({ meta: { pagination: { total_items: 0 } } })),
        ]);
        currentCourse = {
          id: courseId,
          name: course.name,
          status: course.status,
          enrollmentCount: (enrollments as any).meta?.pagination?.total_items || 0,
        };
      } catch (err) {
        logWarn("api/chat", "Failed to fetch course", { courseId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Pre-fetch real GA4 data when analytics workspace is active
    let analyticsDataContext = "";
    if ((workspace === "analytics" || workspace === "all") && isAnalyticsConfigured()) {
      try {
        const accessToken = (authSession as any)?.accessToken;
        if (accessToken) {
          const overview = await getTrafficOverview(accessToken, "website", "7d");
          const avgMins = Math.floor(overview.avgSessionDuration / 60);
          const avgSecs = Math.round(overview.avgSessionDuration % 60);
          analyticsDataContext = `\n\nCurrent GA4 data (last 7 days):
- Total Users: ${overview.totalUsers.toLocaleString()}
- Sessions: ${overview.totalSessions.toLocaleString()}
- Pageviews: ${overview.totalPageviews.toLocaleString()}
- Bounce Rate: ${(overview.bounceRate * 100).toFixed(1)}%
- Avg Session Duration: ${avgMins}m ${avgSecs}s
Use these REAL numbers when the user asks about traffic. Do not fabricate data.`;
        }
      } catch (err) {
        // GA4 call failed (no token, expired, etc.) -- skip silently
        console.error("GA4 pre-fetch failed:", err);
      }
    }

    const systemPrompt = buildSystemPrompt({
      pages,
      currentPage,
      pluginContext: pluginContextStr + integrationContext + analyticsDataContext,
      currentContact,
      currentCourse,
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
            },
            requestFiles
          );

          const { message: actionParsed, pendingAction } = parseActions(result.content);
          const { message, reportData } = parseReport(actionParsed);

          const doneChunk = JSON.stringify({
            type: "done",
            message,
            pendingAction,
            reportData,
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
