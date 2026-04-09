import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import * as ga from "@/lib/google-analytics";
import * as keap from "@/lib/keap";
import * as thinkific from "@/lib/thinkific";
import type { GA4Property } from "@/lib/google-analytics";
import type { ReportData } from "@/lib/types";
import { logError } from "@/lib/error-logger";

export const runtime = "nodejs";

function dateRangeLabel(range: string): string {
  switch (range) {
    case "today": return "Today";
    case "7d": return "Last 7 days";
    case "30d": return "Last 30 days";
    case "90d": return "Last 90 days";
    default: return "Last 7 days";
  }
}

function fmtPct(value: number): string {
  return (value * 100).toFixed(1) + "%";
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function fmtCurrency(cents: number): string {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "overview";
  const property = (searchParams.get("property") || "website") as GA4Property;
  const range = searchParams.get("range") || "7d";
  const format = searchParams.get("format") || "json";
  const period = dateRangeLabel(range);

  try {
    // Get user session for GA4 access token
    const session = await getServerSession() as any;
    const accessToken = session?.accessToken;

    let report: ReportData;

    switch (type) {
      case "overview":
      case "traffic": {
        if (!accessToken) {
          return NextResponse.json({ error: "Not authenticated for analytics." }, { status: 401 });
        }
        const comparison = await ga.getTrafficOverviewWithComparison(accessToken, property, range);
        const prevLabel = range === "today" ? "vs yesterday" : range === "7d" ? "vs previous 7 days" : range === "90d" ? "vs previous 90 days" : "vs previous 30 days";
        report = {
          title: "Traffic Overview",
          period,
          summary: [
            { label: "Total Users", value: comparison.current.totalUsers, change: comparison.changes.users, changeLabel: prevLabel },
            { label: "Sessions", value: comparison.current.totalSessions, change: comparison.changes.sessions, changeLabel: prevLabel },
            { label: "Pageviews", value: comparison.current.totalPageviews, change: comparison.changes.pageviews, changeLabel: prevLabel },
            { label: "Bounce Rate", value: fmtPct(comparison.current.bounceRate), change: comparison.changes.bounceRate, changeLabel: prevLabel },
          ],
          notes: [
            `Average session duration: ${fmtDuration(comparison.current.avgSessionDuration)} (${comparison.changes.avgSessionDuration > 0 ? "+" : ""}${comparison.changes.avgSessionDuration.toFixed(1)}% ${prevLabel})`,
            `Previous period: ${comparison.previous.totalUsers.toLocaleString()} users, ${comparison.previous.totalSessions.toLocaleString()} sessions`,
          ],
        };
        break;
      }

      case "top-pages": {
        if (!accessToken) {
          return NextResponse.json({ error: "Not authenticated for analytics." }, { status: 401 });
        }
        const pages = await ga.getTopPages(accessToken, property, range, 20);
        report = {
          title: "Top Pages by Pageviews",
          period,
          summary: [
            { label: "Pages Tracked", value: pages.length },
            { label: "Total Pageviews", value: pages.reduce((sum, p) => sum + p.pageviews, 0) },
          ],
          table: {
            headers: ["Page", "Pageviews", "Users", "Bounce Rate"],
            rows: pages.map((p) => [
              p.page,
              p.pageviews,
              p.users,
              fmtPct(p.bounceRate),
            ]),
          },
        };
        break;
      }

      case "sources": {
        if (!accessToken) {
          return NextResponse.json({ error: "Not authenticated for analytics." }, { status: 401 });
        }
        const sources = await ga.getTrafficSources(accessToken, property, range);
        report = {
          title: "Traffic Sources",
          period,
          summary: [
            { label: "Total Sources", value: sources.length },
            { label: "Total Sessions", value: sources.reduce((sum, s) => sum + s.sessions, 0) },
          ],
          table: {
            headers: ["Source", "Medium", "Sessions", "Users"],
            rows: sources.map((s) => [s.source, s.medium, s.sessions, s.users]),
          },
        };
        break;
      }

      case "bounce": {
        if (!accessToken) {
          return NextResponse.json({ error: "Not authenticated for analytics." }, { status: 401 });
        }
        const bouncePages = await ga.getHighBouncePages(accessToken, property, range);
        report = {
          title: "High Bounce Rate Pages",
          period,
          summary: [
            { label: "Pages Needing Attention", value: bouncePages.length },
          ],
          table: {
            headers: ["Page", "Pageviews", "Bounce Rate"],
            rows: bouncePages.map((p) => [p.page, p.pageviews, fmtPct(p.bounceRate)]),
          },
          notes: bouncePages.length > 0
            ? ["These pages have bounce rates above 60% with significant traffic. Consider improving content, load speed, or calls to action."]
            : ["No pages with concerning bounce rates found."],
        };
        break;
      }

      case "contacts": {
        const contactLimit = Number(searchParams.get("limit")) || 100;
        const contactData = await keap.listContacts({ limit: contactLimit, order: "date_created", order_direction: "DESCENDING" });
        report = {
          title: "Contact Overview",
          period,
          summary: [
            { label: "Total Contacts", value: contactData.count },
            { label: "Shown", value: contactData.contacts.length },
          ],
          table: {
            headers: ["Name", "Email", "Tags", "Created", "Last Updated"],
            rows: contactData.contacts.map((c) => [
              `${c.given_name || ""} ${c.family_name || ""}`.trim() || "Unknown",
              c.email_addresses?.[0]?.email || "",
              c.tag_ids?.length || 0,
              c.date_created ? new Date(c.date_created).toLocaleDateString() : "",
              c.last_updated ? new Date(c.last_updated).toLocaleDateString() : "",
            ]),
          },
        };
        break;
      }

      case "contacts-by-tag": {
        const tagId = Number(searchParams.get("tag_id"));
        if (!tagId) {
          return NextResponse.json({ error: "tag_id query parameter is required for contacts-by-tag report." }, { status: 400 });
        }
        const tagLimit = Number(searchParams.get("limit")) || 100;
        const taggedContacts = await keap.getContactsWithTag(tagId, { limit: tagLimit });
        report = {
          title: `Contacts with Tag #${tagId}`,
          period: "Current",
          summary: [
            { label: "Total Contacts", value: taggedContacts.count },
            { label: "Shown", value: taggedContacts.contacts.length },
          ],
          table: {
            headers: ["Name", "Email", "Total Tags", "Created"],
            rows: taggedContacts.contacts.map((c) => [
              `${c.given_name || ""} ${c.family_name || ""}`.trim() || "Unknown",
              c.email_addresses?.[0]?.email || "",
              c.tag_ids?.length || 0,
              c.date_created ? new Date(c.date_created).toLocaleDateString() : "",
            ]),
          },
        };
        break;
      }

      case "tags": {
        const tagLimit2 = Number(searchParams.get("limit")) || 200;
        const tagData = await keap.listTags({ limit: tagLimit2 });
        report = {
          title: "Tag Breakdown",
          period: "Current",
          summary: [
            { label: "Total Tags", value: tagData.count },
          ],
          table: {
            headers: ["Tag Name", "Category", "ID"],
            rows: tagData.tags.map((t) => [
              t.name,
              t.category?.name || "Uncategorized",
              t.id,
            ]),
          },
        };
        break;
      }

      case "campaigns": {
        const campLimit = Number(searchParams.get("limit")) || 100;
        const campData = await keap.listCampaigns({ limit: campLimit });
        report = {
          title: "Campaign Overview",
          period: "Current",
          summary: [
            { label: "Total Campaigns", value: campData.count },
          ],
          table: {
            headers: ["Campaign", "Active Contacts", "Published", "Goals"],
            rows: campData.campaigns.map((c) => [
              c.name,
              c.active_contact_count || 0,
              c.published_date ? new Date(c.published_date).toLocaleDateString() : "Not published",
              c.goals?.length || 0,
            ]),
          },
        };
        break;
      }

      case "revenue": {
        const now = new Date();
        const since = range === "today"
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
          : range === "7d"
          ? new Date(Date.now() - 7 * 86400000).toISOString()
          : range === "90d"
          ? new Date(Date.now() - 90 * 86400000).toISOString()
          : new Date(Date.now() - 30 * 86400000).toISOString();

        const revenueLimit = Number(searchParams.get("limit")) || 200;
        const orderData = await keap.listOrders({ limit: revenueLimit, since });
        const totalRevenue = orderData.orders.reduce((sum, o) => sum + (o.total || 0), 0);
        const orderCount = orderData.orders.length;

        report = {
          title: "Revenue Report",
          period,
          summary: [
            { label: "Total Revenue", value: "$" + totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 }) },
            { label: "Orders", value: orderCount },
            { label: "Avg Order Value", value: orderCount > 0 ? "$" + (totalRevenue / orderCount).toFixed(2) : "$0.00" },
          ],
          table: {
            headers: ["Date", "Contact", "Email", "Total", "Status"],
            rows: orderData.orders.map((o) => [
              new Date(o.order_date).toLocaleDateString(),
              `${o.contact.first_name} ${o.contact.last_name}`,
              o.contact.email || "",
              "$" + o.total.toFixed(2),
              o.status,
            ]),
          },
        };
        break;
      }

      case "orders-detail": {
        const now2 = new Date();
        const orderSince = range === "today"
          ? new Date(now2.getFullYear(), now2.getMonth(), now2.getDate()).toISOString()
          : range === "7d"
          ? new Date(Date.now() - 7 * 86400000).toISOString()
          : range === "90d"
          ? new Date(Date.now() - 90 * 86400000).toISOString()
          : new Date(Date.now() - 30 * 86400000).toISOString();

        const detailLimit = Number(searchParams.get("limit")) || 100;
        const detailOrders = await keap.listOrders({ limit: detailLimit, since: orderSince });

        // Build line-item level rows
        const itemRows: (string | number)[][] = [];
        for (const o of detailOrders.orders) {
          if (o.order_items && o.order_items.length > 0) {
            for (const item of o.order_items) {
              itemRows.push([
                new Date(o.order_date).toLocaleDateString(),
                `${o.contact.first_name} ${o.contact.last_name}`,
                item.name,
                item.quantity,
                "$" + item.price.toFixed(2),
                "$" + (item.quantity * item.price).toFixed(2),
                o.status,
              ]);
            }
          } else {
            itemRows.push([
              new Date(o.order_date).toLocaleDateString(),
              `${o.contact.first_name} ${o.contact.last_name}`,
              o.title || "Order",
              1,
              "$" + o.total.toFixed(2),
              "$" + o.total.toFixed(2),
              o.status,
            ]);
          }
        }

        report = {
          title: "Order Detail Report",
          period,
          summary: [
            { label: "Orders", value: detailOrders.count },
            { label: "Line Items", value: itemRows.length },
            { label: "Total Revenue", value: "$" + detailOrders.orders.reduce((s, o) => s + (o.total || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2 }) },
          ],
          table: {
            headers: ["Date", "Contact", "Product", "Qty", "Unit Price", "Total", "Status"],
            rows: itemRows,
          },
        };
        break;
      }

      case "pipeline": {
        const pipeLimit = Number(searchParams.get("limit")) || 100;
        const [opportunities, stages] = await Promise.all([
          keap.listOpportunities({ limit: pipeLimit }),
          keap.listPipelineStages().catch(() => []),
        ]);

        const totalProjected = opportunities.opportunities.reduce(
          (sum, o) => sum + (o.projected_revenue_high || 0), 0
        );

        // Build stage summary
        const stageCounts: Record<string, { count: number; revenue: number }> = {};
        for (const o of opportunities.opportunities) {
          const stageName = o.stage?.name || "Unknown";
          if (!stageCounts[stageName]) stageCounts[stageName] = { count: 0, revenue: 0 };
          stageCounts[stageName].count++;
          stageCounts[stageName].revenue += o.projected_revenue_high || 0;
        }

        const stageNotes = Object.entries(stageCounts).map(
          ([name, data]) => `${name}: ${data.count} deals, $${data.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })} projected`
        );

        report = {
          title: "Pipeline Status",
          period: "Current",
          summary: [
            { label: "Active Opportunities", value: opportunities.count },
            { label: "Total Projected Revenue", value: "$" + totalProjected.toLocaleString("en-US", { minimumFractionDigits: 2 }) },
            { label: "Pipeline Stages", value: Object.keys(stageCounts).length },
          ],
          table: {
            headers: ["Opportunity", "Contact", "Stage", "Est. Close", "Projected Revenue"],
            rows: opportunities.opportunities.map((o) => [
              o.opportunity_title,
              o.contact ? `${o.contact.first_name} ${o.contact.last_name}` : "N/A",
              o.stage?.name || "Unknown",
              o.estimated_close_date ? new Date(o.estimated_close_date).toLocaleDateString() : "N/A",
              o.projected_revenue_high ? "$" + o.projected_revenue_high.toLocaleString() : "$0",
            ]),
          },
          notes: stageNotes,
        };
        break;
      }

      case "emails": {
        const now3 = new Date();
        const emailSince = range === "today"
          ? new Date(now3.getFullYear(), now3.getMonth(), now3.getDate()).toISOString()
          : range === "7d"
          ? new Date(Date.now() - 7 * 86400000).toISOString()
          : range === "90d"
          ? new Date(Date.now() - 90 * 86400000).toISOString()
          : new Date(Date.now() - 30 * 86400000).toISOString();

        const emailLimit = Number(searchParams.get("limit")) || 200;
        const contactFilter = searchParams.get("contact_id") ? Number(searchParams.get("contact_id")) : undefined;
        const emailData = await keap.listEmails({
          limit: emailLimit,
          since_sent_date: emailSince,
          contact_id: contactFilter,
        });

        const totalSent = emailData.emails.length;

        // Group by subject to show send volume per email
        const subjectCounts: Record<string, number> = {};
        for (const e of emailData.emails) {
          const subj = e.subject || "(no subject)";
          subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
        }
        const uniqueSubjects = Object.keys(subjectCounts).length;

        // Group by date to show send volume over time
        const dateCounts: Record<string, number> = {};
        for (const e of emailData.emails) {
          const d = e.sent_date ? new Date(e.sent_date).toLocaleDateString() : "Unknown";
          dateCounts[d] = (dateCounts[d] || 0) + 1;
        }

        report = {
          title: contactFilter ? `Email History for Contact #${contactFilter}` : "Email Send Activity",
          period,
          summary: [
            { label: "Emails Sent", value: totalSent },
            { label: "Unique Subjects", value: uniqueSubjects },
            { label: "Active Days", value: Object.keys(dateCounts).length },
          ],
          table: {
            headers: ["Date Sent", "Subject", "From", "To"],
            rows: emailData.emails.map((e) => [
              e.sent_date ? new Date(e.sent_date).toLocaleDateString() : "N/A",
              e.subject || "(no subject)",
              e.sent_from_address || "N/A",
              e.sent_to_address || "N/A",
            ]),
          },
          notes: [
            `${totalSent} emails sent across ${Object.keys(dateCounts).length} days.`,
            uniqueSubjects > 0 ? `Most sent: "${Object.entries(subjectCounts).sort((a, b) => b[1] - a[1])[0][0]}" (${Object.entries(subjectCounts).sort((a, b) => b[1] - a[1])[0][1]} sends)` : "",
            "Note: Email open/click tracking is only available in the Keap admin dashboard, not via the API.",
          ].filter(Boolean),
        };
        break;
      }

      case "email-stats": {
        // Send volume grouped by subject line
        const statsNow = new Date();
        const statsSince = range === "today"
          ? new Date(statsNow.getFullYear(), statsNow.getMonth(), statsNow.getDate()).toISOString()
          : range === "7d"
          ? new Date(Date.now() - 7 * 86400000).toISOString()
          : range === "90d"
          ? new Date(Date.now() - 90 * 86400000).toISOString()
          : new Date(Date.now() - 30 * 86400000).toISOString();

        const statsEmails = await keap.listEmails({ limit: 200, since_sent_date: statsSince });

        // Group by subject
        const subjStats: Record<string, { sent: number; recipients: Set<string>; firstSent: string; lastSent: string }> = {};
        for (const e of statsEmails.emails) {
          const subj = e.subject || "(no subject)";
          if (!subjStats[subj]) {
            subjStats[subj] = { sent: 0, recipients: new Set(), firstSent: e.sent_date || "", lastSent: e.sent_date || "" };
          }
          subjStats[subj].sent++;
          if (e.sent_to_address) subjStats[subj].recipients.add(e.sent_to_address);
          if (e.sent_date && e.sent_date > subjStats[subj].lastSent) subjStats[subj].lastSent = e.sent_date;
          if (e.sent_date && (!subjStats[subj].firstSent || e.sent_date < subjStats[subj].firstSent)) subjStats[subj].firstSent = e.sent_date;
        }

        const sortedSubjects = Object.entries(subjStats)
          .sort((a, b) => b[1].sent - a[1].sent);

        report = {
          title: "Email Send Volume by Subject",
          period,
          summary: [
            { label: "Total Sent", value: statsEmails.emails.length },
            { label: "Unique Subjects", value: sortedSubjects.length },
            { label: "Unique Recipients", value: new Set(statsEmails.emails.map((e) => e.sent_to_address).filter(Boolean)).size },
          ],
          table: {
            headers: ["Subject", "Sends", "Recipients", "First Sent", "Last Sent"],
            rows: sortedSubjects.map(([subj, s]) => [
              subj.length > 50 ? subj.slice(0, 47) + "..." : subj,
              s.sent,
              s.recipients.size,
              s.firstSent ? new Date(s.firstSent).toLocaleDateString() : "N/A",
              s.lastSent ? new Date(s.lastSent).toLocaleDateString() : "N/A",
            ]),
          },
          notes: [
            sortedSubjects.length > 0 ? `Most sent: "${sortedSubjects[0][0]}" (${sortedSubjects[0][1].sent} sends to ${sortedSubjects[0][1].recipients.size} recipients)` : "No emails sent in this period.",
            "Note: Open/click rate tracking is not available via the Keap API. Check the Keap admin dashboard for engagement metrics.",
          ],
        };
        break;
      }

      case "enrollments": {
        const enrollments = await thinkific.listEnrollments({ limit: 25 });
        report = {
          title: "Recent Enrollments",
          period,
          summary: [
            { label: "Total Enrollments", value: enrollments.meta.pagination.total_items },
          ],
          table: {
            headers: ["Student", "Course", "Progress", "Enrolled"],
            rows: enrollments.items.map((e) => [
              e.user_name || e.user_email || `User #${e.user_id}`,
              e.course_name || `Course #${e.course_id}`,
              (e.percentage_completed || 0) + "%",
              e.created_at ? new Date(e.created_at).toLocaleDateString() : "",
            ]),
          },
        };
        break;
      }

      case "courses": {
        const courses = await thinkific.listCourses({ limit: 50 });
        report = {
          title: "Course Overview",
          period: "Current",
          summary: [
            { label: "Total Courses", value: courses.meta.pagination.total_items },
          ],
          table: {
            headers: ["Course", "Students", "Status", "Price"],
            rows: courses.items.map((c) => [
              c.name,
              c.user_count || 0,
              c.status,
              c.price || "Free",
            ]),
          },
        };
        break;
      }

      case "cross-service": {
        const subType = searchParams.get("sub") || "business-overview";

        if (subType === "business-overview") {
          const results = await Promise.allSettled([
            accessToken ? ga.getTrafficOverview(accessToken, "website", range) : Promise.reject("No token"),
            keap.listContacts({ limit: 1 }),
            keap.listOrders({ limit: 50, since: new Date(Date.now() - (range === "7d" ? 7 : range === "30d" ? 30 : 90) * 86400000).toISOString() }),
            thinkific.getLMSOverview(),
          ]);

          const traffic = results[0].status === "fulfilled" ? results[0].value : null;
          const contacts = results[1].status === "fulfilled" ? results[1].value : null;
          const orders = results[2].status === "fulfilled" ? results[2].value : null;
          const lms = results[3].status === "fulfilled" ? results[3].value : null;

          const totalRevenue = orders ? orders.orders.reduce((sum, o) => sum + (o.total || 0), 0) : 0;

          report = {
            title: "Business Overview",
            period,
            summary: [
              { label: "Website Users", value: traffic?.totalUsers || "N/A" },
              { label: "Total Contacts", value: contacts?.count || "N/A" },
              { label: "Revenue", value: "$" + totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 }) },
              { label: "LMS Students", value: lms?.total_students || "N/A" },
            ],
            table: {
              headers: ["Metric", "Value"],
              rows: [
                ["Website Sessions", traffic?.totalSessions || "N/A"],
                ["Website Pageviews", traffic?.totalPageviews || "N/A"],
                ["Bounce Rate", traffic ? fmtPct(traffic.bounceRate) : "N/A"],
                ["CRM Contacts", contacts?.count || "N/A"],
                ["Orders This Period", orders?.orders.length || 0],
                ["Total Revenue", "$" + totalRevenue.toFixed(2)],
                ["LMS Enrollments", lms?.total_enrollments || "N/A"],
                ["LMS Courses", lms?.total_courses || "N/A"],
              ],
            },
            notes: [
              traffic ? `Website bounce rate: ${fmtPct(traffic.bounceRate)}` : "Website analytics unavailable (sign in with Google).",
              lms ? `${lms.total_students} total students across ${lms.total_courses} courses.` : "LMS data unavailable.",
            ],
          };
        } else {
          // Default cross-service
          report = {
            title: "Cross-Service Report",
            period,
            summary: [],
            notes: ["Use sub=business-overview for the business overview report."],
          };
        }
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown report type: ${type}. Use: overview, traffic, top-pages, sources, bounce, contacts, contacts-by-tag, tags, campaigns, revenue, orders-detail, pipeline, emails, email-stats, enrollments, courses, cross-service` },
          { status: 400 }
        );
    }

    if (format === "summary") {
      // Return a pre-formatted text summary for AI context
      let text = `**${report.title}** (${report.period})\n\n`;
      if (report.summary) {
        text += report.summary.map((s) => `${s.label}: ${s.value}${s.change !== undefined ? ` (${s.change > 0 ? "+" : ""}${s.change.toFixed(1)}%)` : ""}`).join("\n") + "\n\n";
      }
      if (report.table) {
        text += report.table.headers.join(" | ") + "\n";
        text += report.table.rows.map((row) => row.join(" | ")).join("\n") + "\n\n";
      }
      if (report.notes) {
        text += report.notes.join("\n");
      }
      return NextResponse.json({ summary: text, report });
    }

    return NextResponse.json(report);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Report generation error";
    logError("api/reports", msg, { type, property, range });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
