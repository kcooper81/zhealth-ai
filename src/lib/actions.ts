import { getWordPressClient } from "./wordpress";
import * as keap from "./keap";
import * as thinkific from "./thinkific";
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
  }
}
