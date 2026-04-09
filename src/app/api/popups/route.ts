import { NextRequest, NextResponse } from "next/server";
import { getWordPressClient } from "@/lib/wordpress";
import { requireAuth } from "@/lib/auth";
import { logError } from "@/lib/error-logger";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const wp = getWordPressClient();

    const popups = await wp.listPopups({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      per_page: Number(searchParams.get("per_page")) || 20,
      page: Number(searchParams.get("page")) || 1,
    });

    const simplified = popups.map((p) => ({
      id: p.id,
      title: p.title.rendered,
      status: p.status,
      modified: p.modified,
      slug: p.slug,
    }));

    return NextResponse.json(simplified);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch popups";
    logError("api/popups", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
