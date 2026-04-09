import type { ReportData } from "./types";

/**
 * Parse <report> tags from AI responses.
 * Returns the cleaned message text and any parsed ReportData.
 */
export function parseReport(aiResponse: string): {
  message: string;
  reportData: ReportData | null;
} {
  const reportRegex = /<report>\s*([\s\S]*?)\s*<\/report>/;
  const match = aiResponse.match(reportRegex);

  if (!match) {
    return { message: aiResponse, reportData: null };
  }

  const message = aiResponse.replace(reportRegex, "").trim();

  try {
    const reportData: ReportData = JSON.parse(match[1]);
    // Validate required fields
    if (!reportData.title || !reportData.period) {
      return { message: aiResponse, reportData: null };
    }
    return { message, reportData };
  } catch {
    return {
      message:
        aiResponse +
        "\n\n[Warning: Failed to parse report data.]",
      reportData: null,
    };
  }
}

/**
 * Strip <report> blocks from streaming display text.
 * Handles both complete and incomplete (still-streaming) report blocks.
 */
export function stripReportTags(text: string): string {
  // Strip complete <report>...</report> blocks
  let cleaned = text.replace(/<report>[\s\S]*?<\/report>/g, "");
  // Strip incomplete <report> blocks (still streaming)
  cleaned = cleaned.replace(/<report>[\s\S]*/g, "");
  return cleaned.trim();
}
