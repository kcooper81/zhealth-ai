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
        const data = await ga.getTrafficOverview(accessToken, property, range);
        report = {
          title: "Traffic Overview",
          period,
          summary: [
            { label: "Total Users", value: data.totalUsers },
            { label: "Sessions", value: data.totalSessions },
            { label: "Pageviews", value: data.totalPageviews },
            { label: "Bounce Rate", value: fmtPct(data.bounceRate) },
          ],
          notes: [
            `Average session duration: ${fmtDuration(data.avgSessionDuration)}`,
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
        const contactData = await keap.listContacts({ limit: 25, order: "date_created", order_direction: "DESCENDING" });
        report = {
          title: "Contact Overview",
          period,
          summary: [
            { label: "Total Contacts", value: contactData.count },
            { label: "Shown", value: contactData.contacts.length },
          ],
          table: {
            headers: ["Name", "Email", "Tags", "Created"],
            rows: contactData.contacts.map((c) => [
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
        const tagData = await keap.listTags({ limit: 50 });
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

      case "revenue": {
        const now = new Date();
        const since = range === "today"
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
          : range === "7d"
          ? new Date(Date.now() - 7 * 86400000).toISOString()
          : range === "90d"
          ? new Date(Date.now() - 90 * 86400000).toISOString()
          : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const orderData = await keap.listOrders({ limit: 50, since });
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
            headers: ["Date", "Contact", "Total", "Status"],
            rows: orderData.orders.slice(0, 20).map((o) => [
              new Date(o.order_date).toLocaleDateString(),
              `${o.contact.first_name} ${o.contact.last_name}`,
              "$" + o.total.toFixed(2),
              o.status,
            ]),
          },
        };
        break;
      }

      case "pipeline": {
        const [opportunities, stages] = await Promise.all([
          keap.listOpportunities({ limit: 50 }),
          keap.listPipelineStages().catch(() => []),
        ]);

        const totalProjected = opportunities.opportunities.reduce(
          (sum, o) => sum + (o.projected_revenue_high || 0), 0
        );

        report = {
          title: "Pipeline Status",
          period: "Current",
          summary: [
            { label: "Active Opportunities", value: opportunities.count },
            { label: "Total Projected Revenue", value: "$" + totalProjected.toLocaleString("en-US", { minimumFractionDigits: 2 }) },
          ],
          table: {
            headers: ["Opportunity", "Contact", "Stage", "Projected Revenue"],
            rows: opportunities.opportunities.map((o) => [
              o.opportunity_title,
              o.contact ? `${o.contact.first_name} ${o.contact.last_name}` : "N/A",
              o.stage?.name || "Unknown",
              o.projected_revenue_high ? "$" + o.projected_revenue_high.toLocaleString() : "$0",
            ]),
          },
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
          { error: `Unknown report type: ${type}. Use: overview, traffic, top-pages, sources, bounce, contacts, tags, revenue, pipeline, enrollments, courses, cross-service` },
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
