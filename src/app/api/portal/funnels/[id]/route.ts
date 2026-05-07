/**
 * /api/portal/funnels/[id]
 *
 *   DELETE → remove a saved custom funnel
 */
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { deleteFunnel } from "@/lib/saved-funnels";

export const dynamic = "force-dynamic";

async function requireAuth(): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return null;
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  try {
    const result = await deleteFunnel(params.id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
