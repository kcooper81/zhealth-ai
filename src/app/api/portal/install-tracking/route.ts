/**
 * POST /api/portal/install-tracking
 * Pushes the canonical tracking snippet from src/lib/wp-tracking-installer.ts
 * into the WP site as an Elementor Custom Code, then purges the SiteGround
 * dynamic cache so the new code is served immediately.
 *
 * GET returns the current install status (installed? live on site? last modified?)
 */
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import {
  installOrUpdateTracking,
  getTrackingStatus,
} from "@/lib/wp-tracking-installer";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function requireAuth(): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return null;
}

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const status = await getTrackingStatus();
  return NextResponse.json(status);
}

export async function POST() {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const result = await installOrUpdateTracking();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
