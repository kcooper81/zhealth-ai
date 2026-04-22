import { NextRequest } from "next/server";
import { buildSystemPrompt, summarizeElementorData } from "@/lib/claude";
import { streamAIChat, isValidModel, getAvailableModels, getDefaultModel, type AIModel } from "@/lib/ai-router";
import { parseActions } from "@/lib/actions";
import { parseReport } from "@/lib/report-parser";
import { getWordPressClient } from "@/lib/wordpress";
import { requireAuth } from "@/lib/auth";
import { discoverPlugins, buildPluginContext } from "@/lib/plugin-discovery";
import { cachedFetch, CacheKeys, TTL } from "@/lib/cache";
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
    let popups: Array<{
      id: number;
      title: string;
      status: string;
    }> = [];
    let currentPage:
      | { id: number; title: string; content: string; template?: string; elementorSummary?: string }
      | undefined;
    let pluginContextStr = "";

    // Only fetch WordPress context for website/all workspaces — not for CRM/analytics
    const needsWpContext = workspace === "all" || workspace === "website";

    // Wrap context fetching with a 4s timeout — must be fast on Vercel hobby plan (10s limit)
    const withTimeout = <T>(p: Promise<T>, fallback: T, ms = 4000): Promise<T> =>
      Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

    try {
      const promises: Promise<unknown>[] = [
        withTimeout(cachedFetch(CacheKeys.wpPlugins(), TTL.WP_PLUGINS, () => discoverPlugins().catch(() => [])), []),
      ];

      if (needsWpContext) {
        const wp = getWordPressClient();
        const status = "publish,draft,pending,private";
        promises.push(withTimeout(cachedFetch(CacheKeys.wpPages(status), TTL.WP_PAGES, () => wp.listPages({ per_page: 50, status }).catch(() => [])), []));
        if (pageContextId) {
          promises.push(withTimeout(wp.getPage(pageContextId, "edit").catch(() => null), null));
        }
        promises.push(withTimeout(cachedFetch(CacheKeys.wpPopups(status), TTL.WP_POPUPS, () => wp.listPopups({ per_page: 50, status }).catch(() => [])), []));
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

        let nextIdx = 2;
        if (pageContextId) {
          const pageData = results[nextIdx] as { id: number; title: { raw?: string; rendered: string }; content: { raw?: string; rendered: string }; template?: string; meta?: Record<string, unknown> } | null | undefined;
          nextIdx++;
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

        // Process popups
        const wpPopups = (results[nextIdx] || []) as Array<{ id: number; title: { rendered: string }; status: string }>;
        popups = wpPopups.map((p) => ({
          id: p.id,
          title: p.title.rendered,
          status: p.status,
        }));
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
        const contact = await withTimeout(getContact(contactId), null as any);
        if (contact) {
          const name = `${contact.given_name || ""} ${contact.family_name || ""}`.trim() || "Unknown";
          const email = contact.email_addresses?.[0]?.email || "";
          const tags = (contact.tag_ids || []).map((t: number) => String(t));
          currentContact = { id: contactId, name, email, tags };
        }
      } catch (err) {
        logWarn("api/chat", "Failed to fetch contact", { contactId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Fetch selected course details if provided
    let currentCourse: { id: number; name: string; status: string; enrollmentCount: number } | undefined;
    if (courseId && isThinkificConfigured()) {
      try {
        const [course, enrollments] = await withTimeout(Promise.all([
          getCourse(courseId),
          listEnrollments({ course_id: courseId, limit: 1 }).catch(() => ({ meta: { pagination: { total_items: 0 } } })),
        ]), [null, { meta: { pagination: { total_items: 0 } } }] as any);
        if (course) {
          currentCourse = {
            id: courseId,
            name: course.name,
            status: course.status,
            enrollmentCount: (enrollments as any)?.meta?.pagination?.total_items || 0,
          };
        }
      } catch (err) {
        logWarn("api/chat", "Failed to fetch course", { courseId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Pre-fetch real GA4 data when analytics workspace is active.
    //
    // If the fetch fails (timeout, error, missing access token) we MUST tell
    // the model the data is unavailable. Otherwise the static
    // getAnalyticsContext() block tells the model it has GA4 access, the
    // user asks about traffic, and the model invents numbers. The explicit
    // "GA4_DATA_UNAVAILABLE" marker below instructs the model to refuse
    // numeric answers and ask the user to retry.
    let analyticsDataContext = "";
    const UNAVAILABLE_MARKER = `\n\nGA4_DATA_UNAVAILABLE: Real-time traffic numbers could not be fetched for this request. Do NOT cite any traffic, user count, session, pageview, or bounce-rate figures. Tell the user that live analytics data is temporarily unavailable and to try again in a moment, or to check the GA4 dashboard directly. Do not fabricate numbers under any circumstances.`;
    if ((workspace === "analytics" || workspace === "all") && isAnalyticsConfigured()) {
      const accessToken = (authSession as any)?.accessToken;
      if (!accessToken) {
        analyticsDataContext = UNAVAILABLE_MARKER;
        logWarn("api/chat", "GA4 pre-fetch skipped — no access token in session");
      } else {
        try {
          const overview = await withTimeout(cachedFetch(CacheKeys.ga4Overview("website", "7d"), TTL.GA4_OVERVIEW, () => getTrafficOverview(accessToken, "website", "7d")), null as any);
          if (!overview) throw new Error("GA4 timeout");
          const avgMins = Math.floor(overview.avgSessionDuration / 60);
          const avgSecs = Math.round(overview.avgSessionDuration % 60);
          analyticsDataContext = `\n\nCurrent GA4 data (last 7 days):
- Total Users: ${overview.totalUsers.toLocaleString()}
- Sessions: ${overview.totalSessions.toLocaleString()}
- Pageviews: ${overview.totalPageviews.toLocaleString()}
- Bounce Rate: ${(overview.bounceRate * 100).toFixed(1)}%
- Avg Session Duration: ${avgMins}m ${avgSecs}s
Use these REAL numbers when the user asks about traffic. Do not fabricate data.`;
        } catch (err) {
          analyticsDataContext = UNAVAILABLE_MARKER;
          logWarn("api/chat", "GA4 pre-fetch failed", { error: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    const systemPrompt = buildSystemPrompt({
      pages,
      popups,
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
          logError("api/chat", `Stream error: ${errorMessage}`, { model, workspace, messageCount: messages?.length });
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
    logError("api/chat", errorMessage, { stack: error instanceof Error ? error.stack : undefined });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
