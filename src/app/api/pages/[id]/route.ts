import { NextRequest, NextResponse } from "next/server";
import { getWordPressClient } from "@/lib/wordpress";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pageId = parseInt(params.id, 10);
    if (isNaN(pageId)) {
      return NextResponse.json({ error: "Invalid page ID" }, { status: 400 });
    }

    const wp = getWordPressClient();
    const page = await wp.getPage(pageId, "edit");

    return NextResponse.json({
      id: page.id,
      title: page.title.raw || page.title.rendered,
      content: page.content.raw || page.content.rendered,
      excerpt: page.excerpt.raw || page.excerpt.rendered,
      status: page.status,
      slug: page.slug,
      link: page.link,
      template: page.template,
      modified: page.modified,
      meta: page.meta,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch page";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
