import { getWordPressClient } from "./wordpress";
import * as keap from "./keap";
import * as thinkific from "./thinkific";
import type { PendingAction, ActionResult, PageSnapshot } from "./types";
import { cacheInvalidate } from "./cache";

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

// ---------------------------------------------------------------------------
// Action parameter validation
// ---------------------------------------------------------------------------
//
// Manifest of required fields per action type. Only actions that mutate data
// or look something up by ID are listed here — pure list/search reads have no
// strictly required fields and are skipped (the underlying APIs default to
// "list everything"). When the model emits an action with a missing or
// wrong-typed required field we return a clean validation error to the user
// instead of letting the request hit WordPress / Keap / Thinkific and come
// back with a cryptic 400.

type FieldType = "string" | "number" | "array" | "object" | "nonempty-array";
type FieldSpec = { name: string; type: FieldType };

const ACTION_REQUIRED_FIELDS: Record<string, FieldSpec[]> = {
  // ---- WordPress ----
  get_page: [{ name: "id", type: "number" }],
  create_page: [{ name: "title", type: "string" }],
  update_page: [{ name: "id", type: "number" }],
  delete_page: [{ name: "id", type: "number" }],
  get_post: [{ name: "id", type: "number" }],
  create_post: [{ name: "title", type: "string" }],
  update_post: [{ name: "id", type: "number" }],
  delete_post: [{ name: "id", type: "number" }],
  get_product: [{ name: "id", type: "number" }],
  update_seo: [{ name: "postId", type: "number" }],
  upload_media: [
    { name: "url", type: "string" },
    { name: "filename", type: "string" },
  ],
  update_product: [{ name: "id", type: "number" }],
  create_redirect: [
    { name: "from", type: "string" },
    { name: "to", type: "string" },
  ],

  // ---- Elementor popups ----
  get_popup: [{ name: "id", type: "number" }],
  create_popup: [{ name: "title", type: "string" }],
  update_popup: [{ name: "id", type: "number" }],
  update_popup_conditions: [{ name: "popupId", type: "number" }],
  popup_update_widget: [
    { name: "popupId", type: "number" },
    { name: "widgetPath", type: "string" },
    { name: "changes", type: "object" },
  ],
  delete_popup: [{ name: "id", type: "number" }],

  // ---- Elementor pages ----
  elementor_get_structure: [{ name: "pageId", type: "number" }],
  elementor_update_widget: [
    { name: "pageId", type: "number" },
    { name: "widgetPath", type: "string" },
    { name: "changes", type: "object" },
  ],
  elementor_add_section: [
    { name: "pageId", type: "number" },
    { name: "position", type: "number" },
    { name: "sectionData", type: "object" },
  ],
  elementor_remove_section: [
    { name: "pageId", type: "number" },
    { name: "sectionIndex", type: "number" },
  ],

  // ---- Keap CRM ----
  keap_get_contact: [{ name: "id", type: "number" }],
  keap_update_contact: [{ name: "id", type: "number" }],
  keap_apply_tag: [
    { name: "tagId", type: "number" },
    { name: "contactIds", type: "nonempty-array" },
  ],
  keap_remove_tag: [
    { name: "tagId", type: "number" },
    { name: "contactIds", type: "nonempty-array" },
  ],
  keap_create_tag: [{ name: "name", type: "string" }],
  keap_add_to_campaign: [
    { name: "campaignId", type: "number" },
    { name: "sequenceId", type: "number" },
    { name: "contactId", type: "number" },
  ],
  keap_update_opportunity_stage: [
    { name: "opportunityId", type: "number" },
    { name: "stageId", type: "number" },
  ],
  keap_get_email: [{ name: "id", type: "number" }],
  keap_get_email_opt_status: [{ name: "contact_id", type: "number" }],
  keap_send_email: [
    { name: "contacts", type: "nonempty-array" },
    { name: "subject", type: "string" },
    { name: "html_content", type: "string" },
  ],

  // ---- Thinkific LMS ----
  thinkific_get_course: [{ name: "id", type: "number" }],
  thinkific_update_course: [{ name: "id", type: "number" }],
  thinkific_get_student: [{ name: "id", type: "number" }],
  thinkific_create_student: [
    { name: "first_name", type: "string" },
    { name: "last_name", type: "string" },
    { name: "email", type: "string" },
  ],
  thinkific_create_enrollment: [
    { name: "user_id", type: "number" },
    { name: "course_id", type: "number" },
  ],
  thinkific_update_enrollment: [{ name: "id", type: "number" }],
  thinkific_create_coupon: [{ name: "code", type: "string" }],
  thinkific_course_report: [{ name: "course_id", type: "number" }],
};

export function validateActionParams(action: PendingAction): string | null {
  const required = ACTION_REQUIRED_FIELDS[action.type];
  if (!required) return null;

  const params = (action.params || {}) as Record<string, unknown>;

  for (const field of required) {
    const value = params[field.name];

    if (value === undefined || value === null || value === "") {
      return `Missing required parameter "${field.name}" for action "${action.type}".`;
    }

    switch (field.type) {
      case "string":
        if (typeof value !== "string" || value.trim() === "") {
          return `Parameter "${field.name}" for action "${action.type}" must be a non-empty string.`;
        }
        break;
      case "number":
        if (typeof value !== "number" || Number.isNaN(value)) {
          return `Parameter "${field.name}" for action "${action.type}" must be a number.`;
        }
        break;
      case "array":
        if (!Array.isArray(value)) {
          return `Parameter "${field.name}" for action "${action.type}" must be an array.`;
        }
        break;
      case "nonempty-array":
        if (!Array.isArray(value) || value.length === 0) {
          return `Parameter "${field.name}" for action "${action.type}" must be a non-empty array.`;
        }
        break;
      case "object":
        if (typeof value !== "object" || Array.isArray(value)) {
          return `Parameter "${field.name}" for action "${action.type}" must be an object.`;
        }
        break;
    }
  }

  return null;
}

export async function executeAction(
  action: PendingAction
): Promise<ActionResult> {
  const validationError = validateActionParams(action);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const wp = getWordPressClient();

  try {
    switch (action.type) {
      // ---- Read-only WordPress actions ----
      case "get_pages":
      case "list_pages": {
        const params = action.params as { status?: string; search?: string; per_page?: number };
        const pages = await wp.listPages({ per_page: params.per_page || 50, status: params.status, search: params.search });
        return {
          success: true,
          result: {
            pages: pages.map((p) => ({ id: p.id, title: p.title.rendered, status: p.status, link: p.link })),
            count: pages.length,
          },
        };
      }

      case "get_page": {
        const { id: getPageId } = action.params as { id: number };
        const page = await wp.getPage(getPageId, "view");
        return {
          success: true,
          result: {
            id: page.id,
            title: page.title.rendered,
            status: page.status,
            link: page.link,
            content_preview: (page.content.rendered || "").slice(0, 500),
          },
        };
      }

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

      case "get_post": {
        const { id: getPostId } = action.params as { id: number };
        const post = await wp.getPost(getPostId, "view");
        return {
          success: true,
          result: {
            id: post.id,
            title: post.title.rendered,
            status: post.status,
            link: post.link,
            content_preview: (post.content.rendered || "").slice(0, 500),
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

      case "delete_post": {
        const { id: delPostId, force: forcePost } = action.params as { id: number; force?: boolean };
        await wp.deletePost(delPostId, forcePost);
        return { success: true, result: { id: delPostId, deleted: true } };
      }

      case "list_products": {
        const prodParams = action.params as { search?: string; status?: string; per_page?: number };
        const products = await wp.listProducts({ search: prodParams.search, status: prodParams.status, per_page: prodParams.per_page || 50 });
        return {
          success: true,
          result: {
            products: products.map((p) => ({ id: p.id, name: p.name, price: p.price, status: p.status, permalink: p.permalink })),
            count: products.length,
          },
        };
      }

      case "get_product": {
        const { id: getProdId } = action.params as { id: number };
        const product = await wp.getProduct(getProdId);
        return {
          success: true,
          result: {
            id: product.id,
            name: product.name,
            price: product.price,
            regular_price: product.regular_price,
            sale_price: product.sale_price,
            status: product.status,
            description: product.short_description?.slice(0, 500) || "",
            sku: product.sku,
            permalink: product.permalink,
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
        // Attempt common cache-clearing endpoints, fall back to honest message
        const siteUrl = process.env.WORDPRESS_URL || "";
        let cacheCleared = false;
        try {
          // Try WP Super Cache
          const wpscRes = await fetch(`${siteUrl}/wp-json/wp-super-cache/v1/cache`, {
            method: "DELETE",
            headers: { Authorization: `Basic ${Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString("base64")}` },
          });
          if (wpscRes.ok) cacheCleared = true;
        } catch { /* not available */ }
        if (!cacheCleared) {
          try {
            // Try LiteSpeed Cache
            const lsRes = await fetch(`${siteUrl}/wp-json/litespeed/v1/purge/all`, {
              method: "POST",
              headers: { Authorization: `Basic ${Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString("base64")}` },
            });
            if (lsRes.ok) cacheCleared = true;
          } catch { /* not available */ }
        }
        return {
          success: true,
          result: {
            message: cacheCleared
              ? "Cache has been cleared successfully."
              : `Cache clearing is not automated. Please clear cache manually in your WordPress admin at ${siteUrl}/wp-admin/ using your caching plugin.`,
            automated: cacheCleared,
          },
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
        const { from, to, type: redirectType } = action.params as {
          from: string;
          to: string;
          type?: number;
        };
        const siteUrl = process.env.WORDPRESS_URL || "";
        let redirectCreated = false;
        try {
          // Try the Redirection plugin REST API
          const redRes = await fetch(`${siteUrl}/wp-json/redirection/v1/redirect`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString("base64")}`,
            },
            body: JSON.stringify({
              url: from,
              action_data: { url: to },
              action_type: "url",
              action_code: redirectType || 301,
              group_id: 1,
              match_type: "url",
            }),
          });
          if (redRes.ok) redirectCreated = true;
        } catch { /* Redirection plugin not available */ }
        return {
          success: true,
          result: {
            from,
            to,
            type: redirectType || 301,
            message: redirectCreated
              ? `Redirect created: ${from} -> ${to} (${redirectType || 301})`
              : `Redirect creation requires the Redirection plugin. Please create the redirect manually at ${siteUrl}/wp-admin/tools.php?page=redirection.php -- From: ${from} To: ${to} (${redirectType || 301})`,
            automated: redirectCreated,
          },
        };
      }

      // ---- Elementor Popup Actions ----

      case "list_popups": {
        const params = action.params as { status?: string; search?: string; per_page?: number };
        const popups = await wp.listPopups({ per_page: params.per_page || 50, status: params.status, search: params.search });
        return {
          success: true,
          result: {
            popups: popups.map((p) => ({ id: p.id, title: p.title.rendered, status: p.status })),
            count: popups.length,
          },
        };
      }

      case "get_popup": {
        const { id: popupId } = action.params as { id: number };
        const popup = await wp.getPopup(popupId, "edit");
        const conditions = await wp.getPopupDisplayConditions(popupId);
        const { summarizeElementorData } = await import("./claude");
        const elData = await wp.getPopupElementorData(popupId);
        const structure = elData ? summarizeElementorData(elData) : null;
        return {
          success: true,
          result: {
            id: popup.id,
            title: popup.title.rendered || popup.title.raw,
            status: popup.status,
            content_preview: (popup.content.rendered || "").slice(0, 500),
            displayConditions: conditions,
            elementorStructure: structure,
          },
        };
      }

      case "create_popup": {
        const { title, content, status, conditions, triggers, timing, elementor_data } = action.params as {
          title: string;
          content?: string;
          status?: string;
          conditions?: unknown[];
          triggers?: Record<string, unknown>;
          timing?: Record<string, unknown>;
          elementor_data?: unknown[];
        };
        const meta: Record<string, unknown> = {};
        if (conditions) meta._elementor_conditions = conditions;
        if (triggers) meta._elementor_popup_triggers = triggers;
        if (timing) meta._elementor_popup_timing = timing;
        if (elementor_data) {
          meta._elementor_data = JSON.stringify(elementor_data);
        }
        const result = await wp.createPopup({ title, content, status: status || "draft", meta });
        return {
          success: true,
          result: {
            id: result.id,
            title: result.title.rendered,
            status: result.status,
          },
        };
      }

      case "update_popup": {
        const { id: upId, title, content, status } = action.params as {
          id: number;
          title?: string;
          content?: string;
          status?: string;
        };
        const updateData: Record<string, unknown> = {};
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (status !== undefined) updateData.status = status;
        const result = await wp.updatePopup(upId, updateData);
        return {
          success: true,
          result: {
            id: result.id,
            title: result.title.rendered,
            status: result.status,
          },
        };
      }

      case "update_popup_conditions": {
        const { popupId: condId, conditions, triggers, timing } = action.params as {
          popupId: number;
          conditions?: unknown[];
          triggers?: Record<string, unknown>;
          timing?: Record<string, unknown>;
        };
        await wp.updatePopupDisplayConditions(condId, { conditions, triggers, timing });
        return {
          success: true,
          result: {
            popupId: condId,
            updated: true,
            conditions: conditions || "unchanged",
            triggers: triggers || "unchanged",
            timing: timing || "unchanged",
          },
        };
      }

      case "popup_update_widget": {
        const { popupId: pwId, widgetPath: pwPath, changes: pwChanges } = action.params as {
          popupId: number;
          widgetPath: string;
          changes: Record<string, unknown>;
        };
        const popupElData = await wp.getPopupElementorData(pwId);
        if (!popupElData) {
          return { success: false, error: `Popup ${pwId} has no Elementor data.` };
        }
        const pathParts = pwPath.split(".");
        let current: unknown = popupElData;
        for (let i = 0; i < pathParts.length; i++) {
          const part = pathParts[i];
          if (current === null || current === undefined) {
            return { success: false, error: `Invalid widget path at "${pathParts.slice(0, i + 1).join(".")}"` };
          }
          if (Array.isArray(current)) {
            const idx = parseInt(part, 10);
            if (isNaN(idx) || idx < 0 || idx >= current.length) {
              return { success: false, error: `Invalid index ${part} at path "${pathParts.slice(0, i + 1).join(".")}"` };
            }
            current = current[idx];
          } else if (typeof current === "object") {
            current = (current as Record<string, unknown>)[part];
          } else {
            return { success: false, error: `Cannot traverse path at "${pathParts.slice(0, i + 1).join(".")}"` };
          }
        }
        const widget = current as Record<string, unknown>;
        if (!widget || typeof widget !== "object") {
          return { success: false, error: `No widget found at path "${pwPath}"` };
        }
        const existingSettings = (widget.settings || {}) as Record<string, unknown>;
        widget.settings = { ...existingSettings, ...pwChanges };
        await wp.updatePopupElementorData(pwId, popupElData);
        return {
          success: true,
          result: { popupId: pwId, widgetPath: pwPath, updatedSettings: Object.keys(pwChanges) },
        };
      }

      case "delete_popup": {
        const { id: delPopupId, force: forcePopup } = action.params as { id: number; force?: boolean };
        await wp.deletePopup(delPopupId, forcePopup);
        return { success: true, result: { id: delPopupId, deleted: true } };
      }

      // ---- Elementor Actions ----

      case "elementor_get_structure": {
        const { pageId } = action.params as { pageId: number };
        const elementorData = await wp.getElementorData(pageId);
        if (!elementorData) {
          return {
            success: false,
            error: `Page ${pageId} has no Elementor data, or the page does not exist.`,
          };
        }
        // Import summarizeElementorData dynamically to avoid circular deps
        const { summarizeElementorData } = await import("./claude");
        const summary = summarizeElementorData(elementorData);
        return {
          success: true,
          result: {
            pageId,
            sectionCount: elementorData.length,
            structure: summary,
          },
        };
      }

      case "elementor_update_widget": {
        const { pageId: ewPageId, widgetPath, changes } = action.params as {
          pageId: number;
          widgetPath: string;
          changes: Record<string, unknown>;
        };
        const elData = await wp.getElementorData(ewPageId);
        if (!elData) {
          return { success: false, error: `Page ${ewPageId} has no Elementor data.` };
        }

        // Navigate the Elementor tree using the dot-separated path
        // Path format: "0.elements.0.elements.1" means data[0].elements[0].elements[1]
        const pathParts = widgetPath.split(".");
        let current: unknown = elData;
        for (let i = 0; i < pathParts.length; i++) {
          const part = pathParts[i];
          if (current === null || current === undefined) {
            return { success: false, error: `Invalid widget path: could not traverse at "${pathParts.slice(0, i + 1).join(".")}"` };
          }
          if (Array.isArray(current)) {
            const idx = parseInt(part, 10);
            if (isNaN(idx) || idx < 0 || idx >= current.length) {
              return { success: false, error: `Invalid index ${part} at path "${pathParts.slice(0, i + 1).join(".")}"` };
            }
            current = current[idx];
          } else if (typeof current === "object") {
            current = (current as Record<string, unknown>)[part];
          } else {
            return { success: false, error: `Cannot traverse path at "${pathParts.slice(0, i + 1).join(".")}"` };
          }
        }

        const widget = current as Record<string, unknown>;
        if (!widget || typeof widget !== "object") {
          return { success: false, error: `No widget found at path "${widgetPath}"` };
        }

        // Merge changes into the widget's settings
        const existingSettings = (widget.settings || {}) as Record<string, unknown>;
        widget.settings = { ...existingSettings, ...changes };

        // Write back
        await wp.updateElementorData(ewPageId, elData);
        return {
          success: true,
          result: {
            pageId: ewPageId,
            widgetPath,
            updatedSettings: Object.keys(changes),
          },
        };
      }

      case "elementor_add_section": {
        const { pageId: asPageId, position, sectionData } = action.params as {
          pageId: number;
          position: number;
          sectionData: Record<string, unknown>;
        };
        const asData = await wp.getElementorData(asPageId);
        if (!asData) {
          return { success: false, error: `Page ${asPageId} has no Elementor data.` };
        }

        // Ensure the section has required Elementor fields
        const newSection: Record<string, unknown> = {
          id: Math.random().toString(36).substring(2, 10),
          elType: "section",
          isInner: false,
          settings: {},
          elements: [],
          ...sectionData,
        };

        // Insert at the requested position (clamped to valid range)
        const insertAt = Math.max(0, Math.min(position, asData.length));
        asData.splice(insertAt, 0, newSection);

        await wp.updateElementorData(asPageId, asData);
        return {
          success: true,
          result: {
            pageId: asPageId,
            insertedAt: insertAt,
            totalSections: asData.length,
          },
        };
      }

      case "elementor_remove_section": {
        const { pageId: rsPageId, sectionIndex } = action.params as {
          pageId: number;
          sectionIndex: number;
        };
        const rsData = await wp.getElementorData(rsPageId);
        if (!rsData) {
          return { success: false, error: `Page ${rsPageId} has no Elementor data.` };
        }
        if (sectionIndex < 0 || sectionIndex >= rsData.length) {
          return { success: false, error: `Section index ${sectionIndex} is out of range (0-${rsData.length - 1}).` };
        }

        await takeSnapshot(rsPageId);
        rsData.splice(sectionIndex, 1);
        await wp.updateElementorData(rsPageId, rsData);
        return {
          success: true,
          result: {
            pageId: rsPageId,
            removedIndex: sectionIndex,
            remainingSections: rsData.length,
          },
        };
      }

      // ---- Keap CRM Actions ----
      case "keap_list_contacts": {
        const { email, name, limit: contactLimit } = action.params as { email?: string; name?: string; limit?: number };
        const result = await keap.listContacts({ email, given_name: name, limit: contactLimit || 30 });
        return { success: true, result: { contacts: result.contacts, count: result.count } };
      }
      case "keap_get_contact": {
        const { id: contactId } = action.params as { id: number };
        const contact = await keap.getContact(contactId);
        return { success: true, result: contact };
      }
      case "keap_create_contact": {
        const contact = await keap.createContact(action.params as any);
        return { success: true, result: contact };
      }
      case "keap_update_contact": {
        const { id: kcId, ...kcData } = action.params as { id: number; [key: string]: any };
        const updated = await keap.updateContact(kcId, kcData);
        return { success: true, result: updated };
      }
      case "keap_apply_tag": {
        const { tagId, contactIds } = action.params as { tagId: number; contactIds: number[] };
        await keap.applyTagToContacts(tagId, contactIds);
        return { success: true, result: { tagId, contactIds, applied: true } };
      }
      case "keap_remove_tag": {
        const { tagId: rtId, contactIds: rtIds } = action.params as { tagId: number; contactIds: number[] };
        await keap.removeTagFromContacts(rtId, rtIds);
        return { success: true, result: { tagId: rtId, contactIds: rtIds, removed: true } };
      }
      case "keap_list_tags": {
        const { name: tagName, limit: tagLimit } = action.params as { name?: string; limit?: number };
        const tags = await keap.listTags({ name: tagName, limit: tagLimit || 100 });
        return { success: true, result: tags };
      }
      case "keap_create_tag": {
        const tag = await keap.createTag(action.params as { name: string; description?: string });
        return { success: true, result: tag };
      }
      case "keap_list_campaigns": {
        const campaigns = await keap.listCampaigns(action.params as any);
        return { success: true, result: campaigns };
      }
      case "keap_add_to_campaign": {
        const { campaignId, sequenceId, contactId: campContactId } = action.params as { campaignId: number; sequenceId: number; contactId: number };
        await keap.addContactToCampaignSequence(campaignId, sequenceId, campContactId);
        return { success: true, result: { campaignId, sequenceId, contactId: campContactId, added: true } };
      }
      case "keap_list_opportunities": {
        const opps = await keap.listOpportunities(action.params as any);
        return { success: true, result: opps };
      }
      case "keap_create_opportunity": {
        const opp = await keap.createOpportunity(action.params as any);
        return { success: true, result: opp };
      }
      case "keap_update_opportunity_stage": {
        const { opportunityId, stageId } = action.params as { opportunityId: number; stageId: number };
        const updatedOpp = await keap.updateOpportunityStage(opportunityId, stageId);
        return { success: true, result: updatedOpp };
      }
      case "keap_list_orders": {
        const orders = await keap.listOrders(action.params as any);
        return { success: true, result: orders };
      }
      case "keap_list_emails": {
        const emailParams = action.params as { contact_id?: number; email?: string; since_sent_date?: string; limit?: number };
        // listEmails now defaults to sent_date DESCENDING and limit 200, so we
        // pass through user params and let the wrapper apply sane defaults.
        const emails = await keap.listEmails({
          contact_id: emailParams.contact_id,
          email: emailParams.email,
          since_sent_date: emailParams.since_sent_date,
          limit: emailParams.limit ?? 200,
        });
        return {
          success: true,
          result: {
            emails: emails.emails.map((e) => ({
              id: e.id,
              subject: e.subject,
              sent_to: e.sent_to_address,
              sent_from: e.sent_from_address,
              sent_date: e.sent_date,
              received_date: e.received_date,
            })),
            count: emails.count,
          },
        };
      }
      case "keap_get_email": {
        const { id: emailId } = action.params as { id: number };
        const email = await keap.getEmail(emailId);
        return { success: true, result: email };
      }
      case "keap_get_email_opt_status": {
        const { contact_id: optContactId } = action.params as { contact_id: number };
        const optStatus = await keap.getContactEmailOptStatus(optContactId);
        return { success: true, result: optStatus };
      }
      case "keap_send_email": {
        await keap.sendEmail(action.params as any);
        return { success: true, result: { sent: true } };
      }

      // ---- Thinkific LMS Actions ----
      case "thinkific_list_courses": {
        const courses = await thinkific.listCourses(action.params as any);
        return { success: true, result: courses };
      }
      case "thinkific_get_course": {
        const { id: courseId } = action.params as { id: number };
        const course = await thinkific.getCourse(courseId);
        return { success: true, result: course };
      }
      case "thinkific_update_course": {
        const { id: tcId, ...tcData } = action.params as { id: number; [key: string]: any };
        const updatedCourse = await thinkific.updateCourse(tcId, tcData);
        return { success: true, result: updatedCourse };
      }
      case "thinkific_list_students": {
        const students = await thinkific.listUsers(action.params as any);
        return { success: true, result: students };
      }
      case "thinkific_get_student": {
        const { id: studentId } = action.params as { id: number };
        const student = await thinkific.getUser(studentId);
        return { success: true, result: student };
      }
      case "thinkific_create_student": {
        const newStudent = await thinkific.createUser(action.params as any);
        return { success: true, result: newStudent };
      }
      case "thinkific_list_enrollments": {
        const enrollments = await thinkific.listEnrollments(action.params as any);
        return { success: true, result: enrollments };
      }
      case "thinkific_create_enrollment": {
        const enrollment = await thinkific.createEnrollment(action.params as any);
        return { success: true, result: enrollment };
      }
      case "thinkific_update_enrollment": {
        const { id: enrId, ...enrData } = action.params as { id: number; [key: string]: any };
        const updatedEnr = await thinkific.updateEnrollment(enrId, enrData);
        return { success: true, result: updatedEnr };
      }
      case "thinkific_list_orders": {
        const tOrders = await thinkific.listOrders(action.params as any);
        return { success: true, result: tOrders };
      }
      case "thinkific_list_coupons": {
        const coupons = await thinkific.listCoupons(action.params as any);
        return { success: true, result: coupons };
      }
      case "thinkific_create_coupon": {
        const coupon = await thinkific.createCoupon(action.params as any);
        return { success: true, result: coupon };
      }
      case "thinkific_course_report": {
        const { course_id: reportCourseId } = action.params as { course_id: number };
        const report = await thinkific.getCourseReport(reportCourseId);
        return { success: true, result: report };
      }
      case "thinkific_lms_overview": {
        const overview = await thinkific.getLMSOverview();
        return { success: true, result: overview };
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
  } finally {
    // Invalidate relevant caches after write actions
    invalidateCacheForAction(action.type);
  }
}

/**
 * Invalidate cached data when write actions modify external systems.
 * Fire-and-forget — doesn't block the response.
 */
function invalidateCacheForAction(actionType: string): void {
  switch (actionType) {
    case "create_page":
    case "update_page":
    case "delete_page":
      cacheInvalidate("wp:pages:");
      break;
    case "create_post":
    case "update_post":
    case "delete_post":
      cacheInvalidate("wp:posts:");
      break;
    case "create_popup":
    case "update_popup":
    case "delete_popup":
    case "update_popup_conditions":
    case "popup_update_widget":
      cacheInvalidate("wp:popups:");
      break;
    case "elementor_update_widget":
    case "elementor_add_section":
    case "elementor_remove_section":
      cacheInvalidate("wp:pages:");
      break;
    case "keap_create_contact":
    case "keap_update_contact":
    case "keap_apply_tag":
    case "keap_remove_tag":
      cacheInvalidate("keap:");
      break;
    case "keap_create_tag":
      cacheInvalidate("keap:tags");
      break;
    case "keap_create_opportunity":
    case "keap_update_opportunity_stage":
      cacheInvalidate("keap:pipeline");
      break;
    case "thinkific_update_course":
    case "thinkific_create_enrollment":
    case "thinkific_update_enrollment":
      cacheInvalidate("thinkific:");
      break;
  }
}
