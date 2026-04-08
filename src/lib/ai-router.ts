import { streamChat } from "./claude";
import { streamGeminiChat } from "./gemini";

export type AIModel =
  | "claude-sonnet-4-6"
  | "claude-opus-4-6"
  | "claude-haiku-4-5"
  | "gemini-2.0-flash"
  | "gemini-2.5-pro";

interface ModelInfo {
  name: string;
  provider: "claude" | "gemini";
  speed: string;
  description: string;
  apiModel: string;
}

const MODEL_INFO: Record<AIModel, ModelInfo> = {
  "claude-sonnet-4-6": {
    name: "Claude Sonnet 4.6",
    provider: "claude",
    speed: "Balanced",
    description: "Best balance of speed and intelligence",
    apiModel: "claude-sonnet-4-20250514",
  },
  "claude-opus-4-6": {
    name: "Claude Opus 4.6",
    provider: "claude",
    speed: "Slower",
    description: "Most capable, best for complex tasks",
    apiModel: "claude-opus-4-20250514",
  },
  "claude-haiku-4-5": {
    name: "Claude Haiku 4.5",
    provider: "claude",
    speed: "Fastest",
    description: "Fastest responses, great for simple tasks",
    apiModel: "claude-haiku-4-5-20241022",
  },
  "gemini-2.0-flash": {
    name: "Gemini 2.0 Flash",
    provider: "gemini",
    speed: "Fast",
    description: "Free tier, fast responses",
    apiModel: "gemini-2.0-flash",
  },
  "gemini-2.5-pro": {
    name: "Gemini 2.5 Pro",
    provider: "gemini",
    speed: "Balanced",
    description: "Capable reasoning model",
    apiModel: "gemini-2.5-pro",
  },
};

export function getModelInfo(model: AIModel): ModelInfo {
  return MODEL_INFO[model] || MODEL_INFO["claude-sonnet-4-6"];
}

export function getAllModels(): Array<AIModel & string> {
  return Object.keys(MODEL_INFO) as Array<AIModel & string>;
}

/**
 * Returns only models whose provider has an API key configured.
 */
export function getAvailableModels(): AIModel[] {
  const hasClaude = !!process.env.ANTHROPIC_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;

  return (Object.keys(MODEL_INFO) as AIModel[]).filter((model) => {
    const info = MODEL_INFO[model];
    if (info.provider === "claude") return hasClaude;
    if (info.provider === "gemini") return hasGemini;
    return false;
  });
}

export function isValidModel(model: string): model is AIModel {
  return model in MODEL_INFO;
}

/**
 * Pick the best available default model.
 */
export function getDefaultModel(): AIModel {
  const available = getAvailableModels();
  // Prefer Gemini Flash (free), then Sonnet, then whatever is available
  if (available.includes("gemini-2.0-flash")) return "gemini-2.0-flash";
  if (available.includes("claude-sonnet-4-6")) return "claude-sonnet-4-6";
  return available[0] || "gemini-2.0-flash";
}

export async function streamAIChat(
  model: AIModel,
  messages: Array<{ role: string; content: string }>,
  system: string,
  onChunk: (text: string) => void
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const info = getModelInfo(model);

  if (info.provider === "gemini") {
    return streamGeminiChat(messages, system, onChunk, info.apiModel);
  }

  // Claude provider
  return streamChat(messages, system, onChunk, info.apiModel);
}
