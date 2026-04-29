import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getSyncMeta } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [all, keap, thinkific, wp] = await Promise.all([
    getSyncMeta("all"),
    getSyncMeta("keap"),
    getSyncMeta("thinkific"),
    getSyncMeta("wp"),
  ]);

  return NextResponse.json({
    all,
    keap,
    thinkific,
    wp,
  });
}
