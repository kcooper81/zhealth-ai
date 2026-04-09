import { NextRequest, NextResponse } from "next/server";
import { getLogs, logError, logWarn, logInfo, clearLogs, getLogsAsText } from "@/lib/error-logger";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  if (format === "text") {
    return new Response(getLogsAsText(), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json(getLogs());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { level, source, message, details } = body as {
      level?: string;
      source?: string;
      message?: string;
      details?: unknown;
    };

    if (!source || !message) {
      return NextResponse.json(
        { error: "source and message are required" },
        { status: 400 }
      );
    }

    if (level === "warn") {
      logWarn(source, message, details);
    } else if (level === "info") {
      logInfo(source, message, details);
    } else {
      logError(source, message, details);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to log entry" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  clearLogs();
  return NextResponse.json({ ok: true });
}
