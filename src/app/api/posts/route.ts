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
    const posts = useCache
      ? await cachedFetch(CacheKeys.wpPosts(cacheStatus), TTL.WP_POSTS, () => wp.listPosts({ search, status: cacheStatus, per_page: perPage, page }))
      : await wp.listPosts({ search, status, per_page: perPage, page });

    const simplified = posts.map((p) => ({
      id: p.id,
      title: p.title.rendered,
      status: p.status,
      url: p.link,
      modified: p.modified,
      slug: p.slug,
      categories: p.categories,
      tags: p.tags,
    }));

    return NextResponse.json(simplified);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch posts";
    logError("api/posts", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
