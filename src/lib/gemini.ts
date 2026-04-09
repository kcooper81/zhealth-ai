import type { FileAttachment } from "./types";

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildGeminiParts(
  text: string,
  files?: FileAttachment[]
): GeminiPart[] {
  const parts: GeminiPart[] = [];

  if (files && files.length > 0) {
    for (const file of files) {
      if (file.data && file.type.startsWith("image/")) {
        parts.push({
          inlineData: {
            mimeType: file.type,
            data: file.data,
          },
        });
      } else {
        parts.push({
          text: `[Attached file: ${file.name} (${file.type}, ${formatBytes(file.size)})]`,
        });
      }
    }
  }

  if (text) {
    parts.push({ text });
  }

  return parts;
}

export async function streamGeminiChat(
  messages: Array<{ role: string; content: string }>,
  system: string,
  onChunk: (text: string) => void,
  model = "gemini-2.0-flash",
  files?: FileAttachment[]
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured");
  }

  // Convert messages from Claude format to Gemini format
  const geminiContents = messages.map((m, idx) => {
    const isLastUser =
      idx === messages.length - 1 && m.role === "user" && files && files.length > 0;

    if (isLastUser) {
      return {
        role: "user",
        parts: buildGeminiParts(m.content, files),
      };
    }

    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }] as GeminiPart[],
    };
  });

  const requestBody: Record<string, unknown> = {
    contents: geminiContents,
    systemInstruction: {
      parts: [{ text: system }],
    },
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.7,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    let errorMessage: string;
    try {
      const errorBody = await response.json();
      errorMessage =
        errorBody.error?.message || errorBody.message || response.statusText;
    } catch {
      errorMessage = response.statusText;
    }
    throw new Error(`Gemini API error (${response.status}): ${errorMessage}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response stream from Gemini");
  }

  const decoder = new TextDecoder();
  let fullContent = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      const jsonStr = trimmed.slice(6);
      if (jsonStr === "[DONE]") continue;

      try {
        const data = JSON.parse(jsonStr);

        // Extract text from candidates
        if (data.candidates) {
          for (const candidate of data.candidates) {
            if (candidate.content?.parts) {
              for (const part of candidate.content.parts) {
                if (part.text) {
                  fullContent += part.text;
                  onChunk(part.text);
                }
              }
            }
          }
        }

        // Extract usage metadata
        if (data.usageMetadata) {
          if (data.usageMetadata.promptTokenCount) {
            inputTokens = data.usageMetadata.promptTokenCount;
          }
          if (data.usageMetadata.candidatesTokenCount) {
            outputTokens = data.usageMetadata.candidatesTokenCount;
          }
        }
      } catch {
        // Skip malformed JSON lines
        continue;
      }
    }
  }

  return { content: fullContent, inputTokens, outputTokens };
}
