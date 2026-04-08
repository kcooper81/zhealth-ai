import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function streamChat(
  messages: Array<{ role: string; content: string }>,
  system: string,
  onChunk: (text: string) => void,
  model = "claude-sonnet-4-20250514"
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  let fullContent = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = client.messages.stream({
    model,
    max_tokens: 8192,
    system,
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
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
  currentPage?: { id: number; title: string; content: string };
  capabilities?: string[];
  brandGuide?: Record<string, unknown>;
  pluginContext?: string;
}): string {
  const pagesSection =
    context.pages && context.pages.length > 0
      ? `\n\nCurrently published pages:\n${context.pages.map((p) => `- [${p.id}] "${p.title}" (${p.status}) ${p.url}`).join("\n")}`
      : "";

  const currentPageSection = context.currentPage
    ? `\n\n--- CURRENTLY SELECTED PAGE ---
Page ID: ${context.currentPage.id}
Title: "${context.currentPage.title}"
The user has selected this page as context. When they ask you to edit, update, or modify content, they mean THIS page unless they specify otherwise.
Any changes should target page ID ${context.currentPage.id}.

Current page content (HTML):
\`\`\`html
${context.currentPage.content.slice(0, 12000)}
\`\`\`
${context.currentPage.content.length > 12000 ? `\n(Content truncated — showing first 12,000 of ${context.currentPage.content.length} characters)` : ""}
--- END SELECTED PAGE ---`
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

1. NEVER show code or HTML in the chat. The user does not want to see code.
   - Describe what you're doing in plain, simple language
   - Example GOOD: "I will update the hero headline to Pain Is Weird and change the CTA button color to green."
   - Example BAD: showing HTML tags or CSS code in the chat message

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

Be helpful, expert, and concise. Provide clear explanations and ask clarifying questions when the request is ambiguous.${pluginSection}${pagesSection}${currentPageSection}`;
}
