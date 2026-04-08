import { NextRequest, NextResponse } from "next/server";
import { getWorkflow, saveWorkflow, deleteWorkflow } from "@/lib/workflows";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const workflow = await getWorkflow(params.id);
    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(workflow);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch workflow";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const existing = await getWorkflow(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updated = { ...existing, ...body, id: params.id };
    await saveWorkflow(updated);
    return NextResponse.json(updated);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to update workflow";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const deleted = await deleteWorkflow(params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to delete workflow";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
