import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import * as ga from "@/lib/google-analytics";
import type { GA4Property } from "@/lib/google-analytics";
import { logError } from "@/lib/error-logger";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const property = (searchParams.get("property") || "website") as GA4Property;
  const dateRange = searchParams.get("range") || "7d";

  try {
    // Get the user's Google access token from the session
    const session = await getServerSession() as any;
    const accessToken = session?.accessToken;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Not authenticated. Please sign in with Google to access analytics." },
        { status: 401 }
      );
    }

    switch (action) {
      case "overview": {
        const data = await ga.getTrafficOverview(accessToken, property, dateRange);
        return NextResponse.json(data);
      }

      case "top-pages": {
        const limit = parseInt(searchParams.get("limit") || "20");
        const data = await ga.getTopPages(accessToken, property, dateRange, limit);
        return NextResponse.json(data);
      }

      case "sources": {
        const data = await ga.getTrafficSources(accessToken, property, dateRange);
        return NextResponse.json(data);
      }

      case "page-performance": {
        const pagePath = searchParams.get("page");
        if (!pagePath) {
          return NextResponse.json({ error: "page parameter required" }, { status: 400 });
        }
        const data = await ga.getPagePerformance(accessToken, pagePath, property, dateRange);
        return NextResponse.json(data);
      }

      case "daily": {
        const data = await ga.getTrafficByDay(accessToken, property, dateRange);
        return NextResponse.json(data);
      }

      case "high-bounce": {
        const minPageviews = parseInt(searchParams.get("min_pageviews") || "50");
        const data = await ga.getHighBouncePages(accessToken, property, dateRange, minPageviews);
        return NextResponse.json(data);
      }

      default:
        return NextResponse.json(
          { error: "Unknown action. Use: overview, top-pages, sources, page-performance, daily, high-bounce" },
          { status: 400 }
        );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Analytics error";
    logError("api/analytics", msg, { action, property, dateRange });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
