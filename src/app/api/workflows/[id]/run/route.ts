import { NextRequest } from "next/server";
import { getWorkflow, updateWorkflowRunStats } from "@/lib/workflows";
import { streamChat, buildSystemPrompt } from "@/lib/claude";
import { executeAction } from "@/lib/actions";
import type { PendingAction } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workflow = await getWorkflow(params.id);
    if (!workflow) {
      return new Response(
        JSON.stringify({ error: "Workflow not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { pageId, title, variables = {} } = body as {
      pageId?: number;
      title?: string;
      variables?: Record<string, string>;
    };

    const encoder = new TextEncoder();
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        send({
          type: "workflow_start",
          runId,
          workflowId: workflow.id,
          workflowName: workflow.name,
          totalSteps: workflow.steps.length,
        });

        const results: Array<{ stepId: string; status: string; result?: any; error?: string }> = [];
        let currentPageId = pageId || null;
        let currentPageUrl = "";

        for (let i = 0; i < workflow.steps.length; i++) {
          const step = workflow.steps[i];
          const stepLabel = replaceVariables(step.label, variables);
          const stepDescription = replaceVariables(step.description, variables);

          send({
            type: "step_start",
            stepIndex: i,
            step: { ...step, label: stepLabel, description: stepDescription },
          });

          try {
            let actionResult: any = null;

            if (step.usesAI && step.prompt) {
              // Use Claude to generate content for this step
              const prompt = replaceVariables(step.prompt, variables);

              const systemPrompt = buildSystemPrompt({});
              let aiContent = "";

              await streamChat(
                [{ role: "user", content: prompt }],
                systemPrompt + "\n\nIMPORTANT: Respond with just the requested content. Do not include action blocks. For JSON requests, return valid JSON only.",
                (text: string) => {
                  aiContent += text;
                  send({
                    type: "step_ai_token",
                    stepIndex: i,
                    token: text,
                  });
                }
              );

              send({
                type: "step_ai_complete",
                stepIndex: i,
                content: aiContent,
              });

              // Now execute the action using AI-generated content
              actionResult = await executeStepAction(step, aiContent, currentPageId, variables);
            } else {
              // Execute the action directly without AI
              actionResult = await executeStepAction(step, null, currentPageId, variables);
            }

            // Track page ID from create/duplicate actions for use in subsequent steps
            if (actionResult?.result?.id && (step.type === "create_page" || step.type === "create_post" || step.type === "duplicate_page")) {
              currentPageId = actionResult.result.id;
              if (actionResult.result.link) {
                currentPageUrl = actionResult.result.link;
              }
            }

            if (actionResult?.success) {
              results.push({ stepId: step.id, status: "completed", result: actionResult.result });
              send({
                type: "step_complete",
                stepIndex: i,
                result: actionResult.result,
              });
            } else {
              results.push({ stepId: step.id, status: "failed", error: actionResult?.error || "Unknown error" });
              send({
                type: "step_error",
                stepIndex: i,
                error: actionResult?.error || "Unknown error",
              });
              // Continue with next steps even if one fails
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Step execution failed";
            results.push({ stepId: step.id, status: "failed", error: errorMessage });
            send({
              type: "step_error",
              stepIndex: i,
              error: errorMessage,
            });
          }
        }

        // Update run stats
        try {
          await updateWorkflowRunStats(workflow.id);
        } catch {
          // Non-critical, ignore
        }

        send({
          type: "workflow_complete",
          runId,
          results,
          pageUrl: currentPageUrl,
        });

        controller.close();
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

async function executeStepAction(
  step: any,
  aiContent: string | null,
  currentPageId: number | null,
  variables: Record<string, string>
): Promise<{ success: boolean; result?: any; error?: string }> {
  const config = { ...step.config };

  // Replace variables in config values
  for (const key of Object.keys(config)) {
    if (typeof config[key] === "string") {
      config[key] = replaceVariables(config[key], variables);
    }
  }

  switch (step.type) {
    case "create_page": {
      const action: PendingAction = {
        id: `action_${Date.now()}`,
        type: "create_page",
        params: {
          title: config.title || "New Page",
          content: aiContent || "",
          status: config.status || "draft",
          slug: config.slug || undefined,
          template: config.template || undefined,
        },
        summary: `Create page: ${config.title}`,
      };
      return executeAction(action);
    }

    case "update_page": {
      const targetId = config.pageId || currentPageId;
      if (!targetId) {
        return { success: false, error: "No page ID specified for update" };
      }
      const action: PendingAction = {
        id: `action_${Date.now()}`,
        type: "update_page",
        params: {
          id: targetId,
          content: aiContent || undefined,
        },
        summary: `Update page #${targetId}`,
      };
      return executeAction(action);
    }

    case "duplicate_page": {
      const sourceId = config.sourcePageId || currentPageId;
      if (!sourceId) {
        return { success: false, error: "No source page ID for duplication" };
      }
      // Duplicate is: get page content, then create a new page with that content
      try {
        const { getWordPressClient } = await import("@/lib/wordpress");
        const wp = getWordPressClient();
        const source = await wp.getPage(sourceId, "edit");
        const action: PendingAction = {
          id: `action_${Date.now()}`,
          type: "create_page",
          params: {
            title: config.newTitle || `${source.title.raw || source.title.rendered} (Copy)`,
            content: source.content.raw || source.content.rendered,
            status: "draft",
          },
          summary: `Duplicate page #${sourceId}`,
        };
        return executeAction(action);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Duplication failed";
        return { success: false, error: msg };
      }
    }

    case "update_seo": {
      const targetId = config.pageId || currentPageId;
      if (!targetId) {
        return { success: false, error: "No page ID specified for SEO update" };
      }

      let seoData: { title?: string; description?: string; focusKeyword?: string } = {};

      if (aiContent) {
        // Try to parse AI-generated JSON
        try {
          const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            seoData = JSON.parse(jsonMatch[0]);
          }
        } catch {
          // Use the raw content as description if JSON parse fails
          seoData = { description: aiContent.slice(0, 160) };
        }
      }

      // Override with explicit config values
      if (config.title) seoData.title = config.title;
      if (config.description) seoData.description = config.description;
      if (config.focusKeyword) seoData.focusKeyword = config.focusKeyword;

      const action: PendingAction = {
        id: `action_${Date.now()}`,
        type: "update_seo",
        params: {
          postId: targetId,
          ...seoData,
        },
        summary: `Update SEO for page #${targetId}`,
      };
      return executeAction(action);
    }

    case "set_featured_image": {
      const targetId = config.pageId || currentPageId;
      if (!targetId || !config.imageUrl) {
        return { success: false, error: "Page ID and image URL required" };
      }
      const action: PendingAction = {
        id: `action_${Date.now()}`,
        type: "upload_media",
        params: {
          url: config.imageUrl,
          filename: `featured-${targetId}.jpg`,
          alt: config.alt || "",
        },
        summary: `Set featured image for page #${targetId}`,
      };
      return executeAction(action);
    }

    case "publish_page": {
      const targetId = config.pageId || currentPageId;
      if (!targetId) {
        return { success: false, error: "No page ID specified for publishing" };
      }
      const action: PendingAction = {
        id: `action_${Date.now()}`,
        type: "update_page",
        params: { id: targetId, status: "publish" },
        summary: `Publish page #${targetId}`,
      };
      return executeAction(action);
    }

    case "schedule_page": {
      const targetId = config.pageId || currentPageId;
      if (!targetId) {
        return { success: false, error: "No page ID specified for scheduling" };
      }
      const action: PendingAction = {
        id: `action_${Date.now()}`,
        type: "update_page",
        params: { id: targetId, status: "future", date: config.publishDate },
        summary: `Schedule page #${targetId}`,
      };
      return executeAction(action);
    }

    case "create_post": {
      const action: PendingAction = {
        id: `action_${Date.now()}`,
        type: "create_post",
        params: {
          title: config.title || "New Post",
          content: aiContent || "",
          status: config.status || "draft",
          slug: config.slug || undefined,
        },
        summary: `Create post: ${config.title}`,
      };
      return executeAction(action);
    }

    case "update_product": {
      if (!config.productId) {
        return { success: false, error: "Product ID required" };
      }
      const action: PendingAction = {
        id: `action_${Date.now()}`,
        type: "update_product",
        params: {
          id: config.productId,
          name: config.name || undefined,
          price: config.price || undefined,
          sale_price: config.salePrice || undefined,
          description: aiContent || undefined,
        },
        summary: `Update product #${config.productId}`,
      };
      return executeAction(action);
    }

    case "create_redirect": {
      if (!config.from || !config.to) {
        return { success: false, error: "Redirect 'from' and 'to' URLs required" };
      }
      const action: PendingAction = {
        id: `action_${Date.now()}`,
        type: "create_redirect",
        params: {
          from: config.from,
          to: config.to,
          type: config.type || 301,
        },
        summary: `Create redirect: ${config.from} -> ${config.to}`,
      };
      return executeAction(action);
    }

    case "clear_cache": {
      const action: PendingAction = {
        id: `action_${Date.now()}`,
        type: "clear_cache",
        params: {},
        summary: "Clear site cache",
      };
      return executeAction(action);
    }

    case "send_notification": {
      return {
        success: true,
        result: { message: config.message || "Workflow step completed" },
      };
    }

    default:
      return { success: false, error: `Unknown step type: ${step.type}` };
  }
}
