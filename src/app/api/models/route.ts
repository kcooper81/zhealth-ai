import { NextResponse } from "next/server";
import { getAvailableModels, getModelInfo, getDefaultModel } from "@/lib/ai-router";
import type { AIModel } from "@/lib/ai-router";

export async function GET() {
  const available = getAvailableModels();
  const defaultModel = getDefaultModel();

  const models = available.map((model: AIModel) => ({
    id: model,
    ...getModelInfo(model),
  }));

  return NextResponse.json({
    models,
    default: defaultModel,
  });
}
