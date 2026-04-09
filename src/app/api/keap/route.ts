import { NextRequest, NextResponse } from "next/server";
import * as keap from "@/lib/keap";
import { logError } from "@/lib/error-logger";
import { cachedFetch, CacheKeys, TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    if (!keap.isConfigured()) {
      return NextResponse.json(
        { error: "Keap API key not configured" },
        { status: 400 }
      );
    }

    switch (action) {
      case "contacts": {
        const email = searchParams.get("email") || undefined;
        const name = searchParams.get("name") || undefined;
        const limit = parseInt(searchParams.get("limit") || "50");
        const offset = parseInt(searchParams.get("offset") || "0");
        // Cache default contact list only (no search, no offset)
        const isDefaultList = !email && !name && offset === 0;
        const result = isDefaultList
          ? await cachedFetch(CacheKeys.keapContacts(), TTL.KEAP_CONTACTS, () => keap.listContacts({ limit, offset }))
          : await keap.listContacts({ limit, offset, email, given_name: name });
        return NextResponse.json(result);
      }

      case "contact": {
        const id = parseInt(searchParams.get("id") || "0");
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const contact = await keap.getContact(id);
        return NextResponse.json(contact);
      }

      case "tags": {
        const name = searchParams.get("name") || undefined;
        const limit = parseInt(searchParams.get("limit") || "100");
        const result = name
          ? await keap.listTags({ limit, name })
          : await cachedFetch(CacheKeys.keapTags(), TTL.KEAP_TAGS, () => keap.listTags({ limit }));
        return NextResponse.json(result);
      }

      case "campaigns": {
        const search = searchParams.get("search") || undefined;
        const result = await keap.listCampaigns({ search_text: search });
        return NextResponse.json(result);
      }

      case "opportunities": {
        const stageId = searchParams.get("stage_id")
          ? parseInt(searchParams.get("stage_id")!)
          : undefined;
        const result = stageId
          ? await keap.listOpportunities({ stage_id: stageId })
          : await cachedFetch(CacheKeys.keapPipelineStats(), TTL.KEAP_STATS, () => keap.listOpportunities({}));
        return NextResponse.json(result);
      }

      case "pipeline-stages": {
        const stages = await keap.listPipelineStages();
        return NextResponse.json(stages);
      }

      case "orders": {
        const contactId = searchParams.get("contact_id")
          ? parseInt(searchParams.get("contact_id")!)
          : undefined;
        const since = searchParams.get("since") || undefined;
        const until = searchParams.get("until") || undefined;
        const result = await keap.listOrders({ contact_id: contactId, since, until });
        return NextResponse.json(result);
      }

      case "account": {
        const info = await keap.getAccountInfo();
        return NextResponse.json(info);
      }

      case "report": {
        // Generate a report by aggregating data
        const reportType = searchParams.get("type") || "overview";
        const report = await generateReport(reportType, searchParams);
        return NextResponse.json(report);
      }

      default:
        return NextResponse.json(
          { error: "Unknown action. Use: contacts, tags, campaigns, opportunities, orders, pipeline-stages, account, report" },
          { status: 400 }
        );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Keap API error";
    logError("api/keap", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!keap.isConfigured()) {
      return NextResponse.json(
        { error: "Keap API key not configured" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "create_contact": {
        const contact = await keap.createContact(body.data);
        return NextResponse.json({ success: true, contact });
      }

      case "update_contact": {
        const contact = await keap.updateContact(body.contactId, body.data);
        return NextResponse.json({ success: true, contact });
      }

      case "delete_contact": {
        await keap.deleteContact(body.contactId);
        return NextResponse.json({ success: true });
      }

      case "apply_tag": {
        await keap.applyTagToContacts(body.tagId, body.contactIds);
        return NextResponse.json({ success: true });
      }

      case "remove_tag": {
        await keap.removeTagFromContacts(body.tagId, body.contactIds);
        return NextResponse.json({ success: true });
      }

      case "create_tag": {
        const tag = await keap.createTag(body.data);
        return NextResponse.json({ success: true, tag });
      }

      case "add_to_campaign": {
        await keap.addContactToCampaignSequence(
          body.campaignId,
          body.sequenceId,
          body.contactId
        );
        return NextResponse.json({ success: true });
      }

      case "create_opportunity": {
        const opp = await keap.createOpportunity(body.data);
        return NextResponse.json({ success: true, opportunity: opp });
      }

      case "update_opportunity_stage": {
        const opp = await keap.updateOpportunityStage(
          body.opportunityId,
          body.stageId
        );
        return NextResponse.json({ success: true, opportunity: opp });
      }

      case "send_email": {
        await keap.sendEmail(body.data);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Keap API error";
    logError("api/keap", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ---- Report Generation ----

async function generateReport(
  type: string,
  params: URLSearchParams
): Promise<any> {
  switch (type) {
    case "overview": {
      // Get high-level CRM stats
      const [contacts, tags, campaigns, orders, opportunities] =
        await Promise.all([
          keap.listContacts({ limit: 1 }).catch(() => ({ count: 0 })),
          keap.listTags({ limit: 1 }).catch(() => ({ count: 0 })),
          keap.listCampaigns({ limit: 1 }).catch(() => ({ count: 0 })),
          keap.listOrders({ limit: 1 }).catch(() => ({ count: 0 })),
          keap.listOpportunities({ limit: 1 }).catch(() => ({ count: 0 })),
        ]);

      return {
        type: "overview",
        data: {
          total_contacts: (contacts as any).count || 0,
          total_tags: (tags as any).count || 0,
          active_campaigns: (campaigns as any).count || 0,
          total_orders: (orders as any).count || 0,
          open_opportunities: (opportunities as any).count || 0,
        },
      };
    }

    case "recent_contacts": {
      const limit = parseInt(params.get("limit") || "20");
      const result = await keap.listContacts({
        limit,
        order: "date_created",
        order_direction: "DESCENDING",
      });
      return {
        type: "recent_contacts",
        data: result.contacts.map((c) => ({
          id: c.id,
          name: `${c.given_name || ""} ${c.family_name || ""}`.trim(),
          email: c.email_addresses?.[0]?.email || "N/A",
          created: c.date_created,
          tags: c.tag_ids?.length || 0,
        })),
        total: result.count,
      };
    }

    case "tag_breakdown": {
      const tags = await keap.listTags({ limit: 100 });
      // Get contact count per tag (top 20 tags)
      const topTags = tags.tags.slice(0, 20);
      const tagCounts = await Promise.all(
        topTags.map(async (tag) => {
          try {
            const result = await keap.getContactsWithTag(tag.id, { limit: 1 });
            return { id: tag.id, name: tag.name, count: result.count };
          } catch {
            return { id: tag.id, name: tag.name, count: 0 };
          }
        })
      );
      return {
        type: "tag_breakdown",
        data: tagCounts.sort((a, b) => b.count - a.count),
      };
    }

    case "pipeline": {
      const [stages, opportunities] = await Promise.all([
        keap.listPipelineStages(),
        keap.listOpportunities({ limit: 200 }),
      ]);

      const stageMap = new Map<number, { name: string; count: number; revenue: number }>();
      for (const stage of stages) {
        stageMap.set(stage.id, { name: stage.name, count: 0, revenue: 0 });
      }

      for (const opp of opportunities.opportunities) {
        if (opp.stage?.id && stageMap.has(opp.stage.id)) {
          const s = stageMap.get(opp.stage.id)!;
          s.count++;
          s.revenue += opp.projected_revenue_high || 0;
        }
      }

      return {
        type: "pipeline",
        data: Array.from(stageMap.values()),
        total_opportunities: opportunities.count,
      };
    }

    case "orders": {
      const since = params.get("since") || new Date(Date.now() - 30 * 86400000).toISOString();
      const orders = await keap.listOrders({ since, limit: 200 });

      let totalRevenue = 0;
      const ordersByDate = new Map<string, { count: number; revenue: number }>();

      for (const order of orders.orders) {
        totalRevenue += order.total || 0;
        const date = order.order_date?.slice(0, 10) || "unknown";
        const existing = ordersByDate.get(date) || { count: 0, revenue: 0 };
        existing.count++;
        existing.revenue += order.total || 0;
        ordersByDate.set(date, existing);
      }

      return {
        type: "orders",
        data: {
          total_orders: orders.count,
          total_revenue: totalRevenue,
          by_date: Object.fromEntries(ordersByDate),
        },
        period: { since },
      };
    }

    default:
      return { type, error: "Unknown report type. Use: overview, recent_contacts, tag_breakdown, pipeline, orders" };
  }
}
