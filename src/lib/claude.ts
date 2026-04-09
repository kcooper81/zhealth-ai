import Anthropic from "@anthropic-ai/sdk";
import type { FileAttachment } from "./types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
        data: string;
      };
    };

function buildContentBlocks(
  text: string,
  files?: FileAttachment[]
): ContentBlock[] | string {
  if (!files || files.length === 0) return text;

  const blocks: ContentBlock[] = [];

  // Add image files as image content blocks
  for (const file of files) {
    if (file.data && file.type.startsWith("image/")) {
      const mediaType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: file.data,
        },
      });
    } else {
      // Non-image files: describe them as text
      blocks.push({
        type: "text",
        text: `[Attached file: ${file.name} (${file.type}, ${formatBytes(file.size)})]`,
      });
    }
  }

  // Add the user's text message
  if (text) {
    blocks.push({ type: "text", text });
  }

  return blocks;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function streamChat(
  messages: Array<{ role: string; content: string }>,
  system: string,
  onChunk: (text: string) => void,
  model = "claude-sonnet-4-20250514",
  files?: FileAttachment[]
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  let fullContent = "";
  let inputTokens = 0;
  let outputTokens = 0;

  // Build messages array - for the last user message, attach files if provided
  const apiMessages = messages.map((m, idx) => {
    const isLastUser =
      idx === messages.length - 1 && m.role === "user" && files && files.length > 0;

    if (isLastUser) {
      return {
        role: m.role as "user" | "assistant",
        content: buildContentBlocks(m.content, files),
      };
    }

    return {
      role: m.role as "user" | "assistant",
      content: m.content,
    };
  });

  const stream = client.messages.stream({
    model,
    max_tokens: 8192,
    system,
    messages: apiMessages as Anthropic.MessageParam[],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      const text = event.delta.text;
      fullContent += text;
      onChunk(text);
    }
  }

  const finalMessage = await stream.finalMessage();
  inputTokens = finalMessage.usage.input_tokens;
  outputTokens = finalMessage.usage.output_tokens;

  return { content: fullContent, inputTokens, outputTokens };
}

export function buildSystemPrompt(context: {
  pages?: Array<{
    id: number;
    title: string;
    status: string;
    url: string;
  }>;
  currentPage?: { id: number; title: string; content: string; template?: string };
  capabilities?: string[];
  brandGuide?: Record<string, unknown>;
  pluginContext?: string;
  currentContact?: {
    id: number;
    name: string;
    email: string;
    tags: string[];
  };
  currentCourse?: {
    id: number;
    name: string;
    status: string;
    enrollmentCount: number;
  };
}): string {
  const pagesSection =
    context.pages && context.pages.length > 0
      ? `\n\nCurrently published pages:\n${context.pages.map((p) => `- [${p.id}] "${p.title}" (${p.status}) ${p.url}`).join("\n")}`
      : "";

  const pageTemplate = context.currentPage?.template || "";
  const isElementor = pageTemplate.includes("elementor");
  const editorNote = isElementor
    ? "This page uses Elementor. When editing, be aware that Elementor stores its own layout data. For simple text/content changes, updating post_content works. For layout changes, Elementor data may need updating."
    : "This page uses the standard WordPress editor.";

  const currentPageSection = context.currentPage
    ? `\n\n--- CURRENTLY SELECTED PAGE ---
Page ID: ${context.currentPage.id}
Title: "${context.currentPage.title}"
Template: ${pageTemplate || "default"}
Editor: ${isElementor ? "Elementor" : "WordPress Block Editor"}
${editorNote}

The user has selected this page as context. When they ask you to edit, update, or modify content, they mean THIS page unless they specify otherwise.
Any changes should target page ID ${context.currentPage.id}.

Current page content (HTML):
${context.currentPage.content.slice(0, 12000)}
${context.currentPage.content.length > 12000 ? "\n(Content truncated)" : ""}
--- END SELECTED PAGE ---`
    : "";

  const currentContactSection = context.currentContact
    ? `\n\n--- CURRENTLY SELECTED CONTACT ---
Contact ID: ${context.currentContact.id}
Name: "${context.currentContact.name}"
Email: ${context.currentContact.email}
Tags: [${context.currentContact.tags.join(", ")}]
The user has selected this contact. Questions about "this contact" or "them" refer to this person.
--- END SELECTED CONTACT ---`
    : "";

  const currentCourseSection = context.currentCourse
    ? `\n\n--- CURRENTLY SELECTED COURSE ---
Course ID: ${context.currentCourse.id}
Name: "${context.currentCourse.name}"
Status: ${context.currentCourse.status}
Enrollment Count: ${context.currentCourse.enrollmentCount}
The user has selected this course. Questions about "this course" or "it" refer to this course.
--- END SELECTED COURSE ---`
    : "";

  const pluginSection = context.pluginContext || "";

  return `You are an expert WordPress site manager and web developer for Z-Health Education (zhealtheducation.com).

Site Identity:
- Organization: Z-Health Education
- Domain: zhealtheducation.com
- Focus: Neuroscience-based movement education for professionals
- Target audience: movement professionals, physical therapists, coaches, athletic trainers, and healthcare practitioners

Brand Guide:
- Primary colors: Black #080a0d, Blue #2c8df3, Red #d32431, Lime #d0f689
- Fonts: Adieu (headings), WorkSans (body text), Poppins (UI elements)
- Visual style: Clean, modern, dark-themed with high contrast accents
- Tone: Expert, confident, evidence-based, approachable

Your capabilities include full WordPress management:
- Creating, editing, and deleting pages and posts
- Managing media uploads
- Building pages with Elementor-compatible HTML
- Updating SEO metadata (Yoast)
- Managing WooCommerce products
- Generating optimized content for the target audience
- Analyzing images and files that users attach to messages

When you need to perform an action on the WordPress site, include an action block in your response using the following format:

<action>
{
  "type": "ACTION_TYPE",
  "params": { ... },
  "summary": "Human-readable description of what this action will do"
}
</action>

Available action types:
- create_page: params { title, content, status?, slug?, template? }
- update_page: params { id, title?, content?, status?, slug? }
- delete_page: params { id, force? }
- create_post: params { title, content, status?, slug?, categories?, tags? }
- update_post: params { id, title?, content?, status? }
- update_seo: params { postId, title?, description?, focusKeyword? }
- upload_media: params { url, filename, alt? }
- clear_cache: params {}
- update_product: params { id, name?, description?, price?, sale_price?, status? }
- create_redirect: params { from, to, type? }

CRITICAL GUIDELINES FOR RESPONSES:

1. Your chat message (the text the user sees) must be in PLAIN LANGUAGE. No code, no HTML, no CSS.
   - Describe what you are creating or changing in simple terms.
   - BUT: The content field inside the action JSON MUST contain the FULL, COMPLETE HTML.
   - The user never sees the action JSON — it goes directly to WordPress.
   - When creating a page, the "content" param in the action MUST be a complete, production-ready HTML page with all sections, styling, copy, CTAs, etc. NOT a placeholder or stub.
   - When editing a page, include the FULL updated HTML with the changes applied.

2. When editing a page, make TARGETED changes only.
   - Do NOT regenerate the entire page
   - Read the current content, find the specific part to change, modify ONLY that part
   - Keep all other content exactly as-is

3. Only include ONE action per response. If multiple steps are needed, complete them one at a time.

4. Always explain what the action will do BEFORE including the action block.

5. The action block contains the code/HTML internally — the user never sees it. The chat message should be a plain-language summary.

6. The user must confirm each action before it executes.

7. When generating HTML content for pages:
   - Use Elementor-compatible HTML with inline styles
   - Follow the brand color palette
   - Ensure responsive design
   - Match the existing page style

8. When the user attaches images, analyze them carefully and describe what you see. If they ask you to use the image on the site, suggest an appropriate action.

When generating reports with data, use the <report> tag format:

<report>
{
  "title": "Traffic Overview",
  "period": "Last 7 days",
  "summary": [
    { "label": "Total Users", "value": 1234, "change": 12.5, "changeLabel": "vs previous period" },
    { "label": "Sessions", "value": 2456 },
    { "label": "Bounce Rate", "value": "45.2%", "change": -3.1 }
  ],
  "table": {
    "headers": ["Page", "Pageviews", "Users", "Bounce Rate"],
    "rows": [
      ["/", 500, 350, "42%"],
      ["/courses", 320, 210, "38%"]
    ]
  },
  "notes": ["Traffic is up 12.5% from last week", "Homepage has the lowest bounce rate"]
}
</report>

Use this format when the user asks for reports, analytics data, data summaries, or any structured data display.
For simple questions, respond in plain text. Only use <report> for structured data displays.
The "title" and "period" fields are required. "summary", "table", and "notes" are optional.
Use numbers (not strings) for numeric values in summary and table rows when possible.
For percentages in summary values, use strings like "45.2%". For change indicators, use raw numbers (e.g. 12.5 for +12.5%, -3.1 for -3.1%).

Be helpful, expert, and concise. Provide clear explanations and ask clarifying questions when the request is ambiguous.${pluginSection}${pagesSection}${currentPageSection}${currentContactSection}${currentCourseSection}`;
}
