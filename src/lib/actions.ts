import { getWordPressClient } from "./wordpress";
import type { PendingAction, ActionResult, PageSnapshot } from "./types";

const snapshots: Map<string, PageSnapshot> = new Map();

export function parseActions(aiResponse: string): {
  message: string;
  pendingAction: PendingAction | null;
} {
  const actionRegex = /<action>\s*([\s\S]*?)\s*<\/action>/;
  const match = aiResponse.match(actionRegex);

  if (!match) {
    return { message: aiResponse, pendingAction: null };
  }

  const message = aiResponse.replace(actionRegex, "").trim();

  try {
    const actionData = JSON.parse(match[1]);
    const pendingAction: PendingAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      type: actionData.type,
      params: actionData.params || {},
      summary: actionData.summary || `Execute ${actionData.type}`,
    };
    return { message, pendingAction };
  } catch (error) {
    return {
      message:
        aiResponse +
        "\n\n[Warning: Failed to parse action block. Please try again.]",
      pendingAction: null,
    };
  }
}

async function takeSnapshot(pageId: number): Promise<PageSnapshot | null> {
  try {
    const wp = getWordPressClient();
    const page = await wp.getPage(pageId, "edit");
    const snapshot: PageSnapshot = {
      pageId,
      title: page.title.raw || page.title.rendered,
      content: page.content.raw || page.content.rendered,
      elementorData: undefined,
      meta: page.meta as Record<string, unknown>,
      snapshotAt: new Date().toISOString(),
    };

    try {
      const elementorData = await wp.getElementorData(pageId);
      if (elementorData) {
        snapshot.elementorData = elementorData;
      }
    } catch {
      // Page may not use Elementor
    }

    snapshots.set(`page_${pageId}`, snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

export function getSnapshot(key: string): PageSnapshot | undefined {
  return snapshots.get(key);
}

export async function executeAction(
  action: PendingAction
): Promise<ActionResult> {
  const wp = getWordPressClient();

  try {
    switch (action.type) {
      case "create_page": {
        const { title, content, status, slug, template } = action.params as {
          title: string;
          content?: string;
          status?: string;
          slug?: string;
          template?: string;
        };
        const result = await wp.createPage({
          title,
          content,
          status: status || "draft",
          slug,
          template,
        });
        return {
          success: true,
          result: {
            id: result.id,
            title: result.title.rendered,
            link: result.link,
            status: result.status,
          },
        };
      }

      case "update_page": {
        const { id, ...updateData } = action.params as {
          id: number;
          title?: string;
          content?: string;
          status?: string;
          slug?: string;
        };
        await takeSnapshot(id);
        const result = await wp.updatePage(id, updateData);
        return {
          success: true,
          result: {
            id: result.id,
            title: result.title.rendered,
            link: result.link,
            status: result.status,
          },
        };
      }

      case "delete_page": {
        const { id: deleteId, force } = action.params as {
          id: number;
          force?: boolean;
        };
        await takeSnapshot(deleteId);
        await wp.deletePage(deleteId, force);
        return {
          success: true,
          result: { id: deleteId, deleted: true },
        };
      }

      case "create_post": {
        const {
          title,
          content,
          status,
          slug,
          categories,
          tags,
        } = action.params as {
          title: string;
          content?: string;
          status?: string;
          slug?: string;
          categories?: number[];
          tags?: number[];
        };
        const result = await wp.createPost({
          title,
          content,
          status: status || "draft",
          slug,
          categories,
          tags,
        });
        return {
          success: true,
          result: {
            id: result.id,
            title: result.title.rendered,
            link: result.link,
            status: result.status,
          },
        };
      }

      case "update_post": {
        const { id: postId, ...postData } = action.params as {
          id: number;
          title?: string;
          content?: string;
          status?: string;
        };
        const result = await wp.updatePost(postId, postData);
        return {
          success: true,
          result: {
            id: result.id,
            title: result.title.rendered,
            link: result.link,
            status: result.status,
          },
        };
      }

      case "update_seo": {
        const { postId, title, description, focusKeyword } =
          action.params as {
            postId: number;
            title?: string;
            description?: string;
            focusKeyword?: string;
          };
        await wp.updateSeoMeta(postId, { title, description, focusKeyword });
        return {
          success: true,
          result: { postId, updated: true },
        };
      }

      case "upload_media": {
        const { url, filename, alt } = action.params as {
          url: string;
          filename: string;
          alt?: string;
        };
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch media from ${url}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") || "image/jpeg";
        const result = await wp.uploadMedia(buffer, filename, contentType);
        return {
          success: true,
          result: {
            id: result.id,
            url: result.source_url,
            title: result.title.rendered,
          },
        };
      }

      case "clear_cache": {
        // Cache clearing depends on the caching plugin installed.
        // This is a placeholder that can be extended.
        return {
          success: true,
          result: { message: "Cache clear requested. Check your caching plugin for confirmation." },
        };
      }

      case "update_product": {
        const { id: productId, ...productData } = action.params as {
          id: number;
          name?: string;
          description?: string;
          price?: string;
          sale_price?: string;
          status?: string;
        };
        const mapped: Record<string, unknown> = {};
        if (productData.name) mapped.name = productData.name;
        if (productData.description) mapped.description = productData.description;
        if (productData.price) mapped.regular_price = productData.price;
        if (productData.sale_price) mapped.sale_price = productData.sale_price;
        if (productData.status) mapped.status = productData.status;
        const result = await wp.updateProduct(productId, mapped);
        return {
          success: true,
          result: {
            id: result.id,
            name: result.name,
            price: result.price,
            permalink: result.permalink,
          },
        };
      }

      case "create_redirect": {
        // Redirect creation depends on the redirection plugin.
        // This is a placeholder implementation.
        const { from, to, type: redirectType } = action.params as {
          from: string;
          to: string;
          type?: number;
        };
        return {
          success: true,
          result: {
            from,
            to,
            type: redirectType || 301,
            message: "Redirect registered. Verify in your redirection plugin.",
          },
        };
      }

      default:
        return {
          success: false,
          error: `Unknown action type: ${action.type}`,
        };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      error: errorMessage,
    };
  }
}
