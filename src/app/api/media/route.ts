import { NextRequest, NextResponse } from "next/server";
import { getWordPressClient } from "@/lib/wordpress";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const wp = getWordPressClient();

    const media = await wp.listMedia({
      search: searchParams.get("search") || undefined,
      per_page: Number(searchParams.get("per_page")) || 20,
      page: Number(searchParams.get("page")) || 1,
      mime_type: searchParams.get("mime_type") || undefined,
    });

    const simplified = media.map((m) => ({
      id: m.id,
      title: m.title.rendered,
      url: m.source_url,
      mimeType: m.mime_type,
      alt: m.alt_text,
      date: m.date,
      width: m.media_details?.width,
      height: m.media_details?.height,
    }));

    return NextResponse.json(simplified);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch media";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wp = getWordPressClient();
    const result = await wp.uploadMedia(buffer, file.name, file.type);

    return NextResponse.json({
      id: result.id,
      title: result.title.rendered,
      url: result.source_url,
      mimeType: result.mime_type,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to upload media";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
