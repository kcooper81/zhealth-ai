import { NextRequest, NextResponse } from "next/server";
import { getWordPressClient } from "@/lib/wordpress";
import { requireAuth } from "@/lib/auth";
import { logError } from "@/lib/error-logger";
import { cachedFetch, CacheKeys, TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const wp = getWordPressClient();

    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const perPage = Number(searchParams.get("per_page")) || 20;
    const page = Number(searchParams.get("page")) || 1;

    const useCache = !search && page === 1 && perPage >= 50;
    const cacheStatus = status || "publish,draft,pending,private";
    const popups = useCache
      ? await cachedFetch(CacheKeys.wpPopups(cacheStatus), TTL.WP_POPUPS, () => wp.listPopups({ search, status: cacheStatus, per_page: perPage, page }))
      : await wp.listPopups({ search, status, per_page: perPage, page });

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
