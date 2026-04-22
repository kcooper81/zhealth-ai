// ---------------------------------------------------------------------------
// Client-side logger — POSTs to /api/logs which routes to error-logger.ts
// ---------------------------------------------------------------------------
//
// Use this from any client component when a fire-and-forget operation fails.
// It is intentionally fire-and-forget itself: the .catch is a recursion guard,
// not a swallow — if the logger endpoint is down, retrying or surfacing the
// failure would just create more noise.

export type LogLevel = "error" | "warn" | "info";

export function logClientError(
  source: string,
  message: string,
  details?: unknown
): void {
  logClient("error", source, message, details);
}

export function logClientWarn(
  source: string,
  message: string,
  details?: unknown
): void {
  logClient("warn", source, message, details);
}

export function logClientInfo(
  source: string,
  message: string,
  details?: unknown
): void {
  logClient("info", source, message, details);
}

function logClient(
  level: LogLevel,
  source: string,
  message: string,
  details?: unknown
): void {
  if (typeof window === "undefined") return;
  try {
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level,
        source,
        message,
        details:
          details instanceof Error
            ? { name: details.name, message: details.message, stack: details.stack }
            : details,
      }),
    }).catch(() => {});
  } catch {
    // Defensive: never throw from a logger.
  }
}
