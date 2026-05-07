/**
 * /api/portal/funnels
 *
 *   GET    → list all saved custom funnels
 *   POST   → save (create or update) a custom funnel
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { listSavedFunnels, saveFunnel } from "@/lib/saved-funnels";

export const dynamic = "force-dynamic";

async function requireAuth(): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return null;
}

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const funnels = await listSavedFunnels();
  return NextResponse.json({ funnels });
}

export async function POST(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  try {
    const body = await req.json();
    const { id, label, description, property, entryPath, steps } = body || {};
    if (!label || !entryPath || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: "label, entryPath, and a non-empty steps[] are required" },
        { status: 400 }
      );
    }
    if (property !== "website" && property !== "lms") {
      return NextResponse.json({ error: "property must be 'website' or 'lms'" }, { status: 400 });
    }
    // Normalize steps — accept either {name,eventName,pageMatch?} or just event-name strings
    const normalized = steps.map((s: any) => {
      if (typeof s === "string") {
        return { name: s, eventName: s };
      }
      return {
        name: s.name || s.eventName,
        eventName: s.eventName,
        pageMatch: s.pageMatch || undefined,
      };
    });
    const saved = await saveFunnel({
      id,
      label,
      description,
      property,
      entryPath,
      steps: normalized,
    });
    return NextResponse.json({ funnel: saved });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save funnel" },
      { status: 500 }
    );
  }
}
