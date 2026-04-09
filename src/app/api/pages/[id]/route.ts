import { NextRequest, NextResponse } from "next/server";
import { getWordPressClient } from "@/lib/wordpress";
import { requireAuth } from "@/lib/auth";
import { summarizeElementorData } from "@/lib/claude";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const pageId = parseInt(params.id, 10);
    if (isNaN(pageId)) {
      return NextResponse.json({ error: "Invalid page ID" }, { status: 400 });
    }

    const wp = getWordPressClient();
    const page = await wp.getPage(pageId, "edit");

    // Optionally include Elementor summary
    let elementorSummary: string | undefined;
    const tpl = page.template || "";
    const meta = page.meta as Record<string, unknown> | undefined;
    if (tpl.includes("elementor") || (meta && meta._elementor_edit_mode)) {
      try {
        const elData = await wp.getElementorData(pageId);
        if (elData && elData.length > 0) {
          elementorSummary = summarizeElementorData(elData);
        }
      } catch {
        // Elementor data unavailable
      }
    }

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
      elementorSummary,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch page";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const pageId = parseInt(params.id, 10);
    if (isNaN(pageId)) {
      return NextResponse.json({ error: "Invalid page ID" }, { status: 400 });
    }

    const body = await request.json();
    const wp = getWordPressClient();

    // If elementor_data is provided, update it via meta
    if (body.elementor_data) {
      const data = typeof body.elementor_data === "string"
        ? JSON.parse(body.elementor_data)
        : body.elementor_data;
      await wp.updateElementorData(pageId, data);
    }

    // If other page fields are provided, update them too
    const updateFields: Record<string, unknown> = {};
    if (body.title !== undefined) updateFields.title = body.title;
    if (body.content !== undefined) updateFields.content = body.content;
    if (body.status !== undefined) updateFields.status = body.status;
    if (body.slug !== undefined) updateFields.slug = body.slug;
    if (body.template !== undefined) updateFields.template = body.template;

    let page;
    if (Object.keys(updateFields).length > 0) {
      page = await wp.updatePage(pageId, updateFields as Parameters<typeof wp.updatePage>[1]);
    } else {
      page = await wp.getPage(pageId, "edit");
    }

    return NextResponse.json({
      id: page.id,
      title: page.title.raw || page.title.rendered,
      status: page.status,
      link: page.link,
      modified: page.modified,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to update page";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
