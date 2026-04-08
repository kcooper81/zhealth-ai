import { NextResponse } from "next/server";
import { getWordPressClient } from "@/lib/wordpress";

export async function GET() {
  try {
    const wp = getWordPressClient();
    const [siteInfo, postTypes] = await Promise.all([
      wp.getSiteInfo(),
      wp.getPostTypes(),
    ]);

    const capabilities = [
      "pages",
      "posts",
      "media",
      "elementor",
      "seo",
      "woocommerce",
    ];

    return NextResponse.json({
      site: {
        name: siteInfo.name,
        description: siteInfo.description,
        url: siteInfo.url,
        home: siteInfo.home,
        timezone: siteInfo.timezone_string,
      },
      postTypes: Object.keys(postTypes),
      capabilities,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch site info";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
