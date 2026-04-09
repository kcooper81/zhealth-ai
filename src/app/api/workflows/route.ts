import { NextRequest, NextResponse } from "next/server";
import { listWorkflows, saveWorkflow } from "@/lib/workflows";
import type { Workflow } from "@/lib/workflows";
import { requireAuth } from "@/lib/auth";
import { logError } from "@/lib/error-logger";

export async function GET() {
  try {
    await requireAuth();
    const workflows = await listWorkflows();
    return NextResponse.json(workflows);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to list workflows";
    logError("api/workflows", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const workflow = body as Workflow;

    if (!workflow.id) {
      workflow.id = `wf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
    if (!workflow.createdAt) {
      workflow.createdAt = new Date().toISOString();
    }
    if (workflow.runCount === undefined) {
      workflow.runCount = 0;
    }

    await saveWorkflow(workflow);
    return NextResponse.json(workflow, { status: 201 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create workflow";
    logError("api/workflows", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
