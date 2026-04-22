// ---------------------------------------------------------------------------
// Error Logger — in-memory ring buffer + Supabase persistence
// ---------------------------------------------------------------------------
//
// The in-memory ring buffer powers the live error panel in the UI. Supabase
// persistence (table: error_logs) makes errors survive serverless cold starts
// and queryable historically. If the error_logs table is missing or the
// Supabase write fails for any reason we log to console and keep going — we
// must NEVER throw from here, since a throw would itself trigger error
// reporting and recurse infinitely.

import { supabase, isSupabaseConfigured } from "./supabase";

export interface ErrorLog {
  id: string;
  timestamp: string;
  level: "error" | "warn" | "info";
  source: string;
  message: string;
  details?: string;
  workspace?: string;
  userId?: string;
}

type Listener = (logs: ErrorLog[]) => void;

const MAX_LOGS = 200;
let logs: ErrorLog[] = [];
const listeners = new Set<Listener>();

// Recursion guard: while we are mid-write to Supabase, any error from the
// write itself must not re-enter addLog. Without this a transient DB failure
// would create an infinite loop of "failed to log error" entries.
let isPersistingError = false;

function emit() {
  const copy = [...logs];
  listeners.forEach((fn) => fn(copy));
}

function generateId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function persistToSupabase(entry: ErrorLog): void {
  if (!isSupabaseConfigured || isPersistingError) return;
  isPersistingError = true;
  // Fire-and-forget; never await, never throw.
  supabase
    .from("error_logs")
    .insert({
      level: entry.level,
      source: entry.source,
      message: entry.message,
      details: entry.details ?? null,
      user_id: entry.userId ?? null,
      workspace: entry.workspace ?? null,
    })
    .then(({ error }) => {
      if (error) {
        // Drop quietly. PGRST205 means the error_logs table doesn't exist
        // yet — the migration in db-schema.sql hasn't been run. Other errors
        // are also dropped because surfacing them would defeat the purpose
        // of a logger that has to keep working even when storage is broken.
        console.error("[error-logger] supabase write failed:", error.message);
      }
    })
    .catch(() => {})
    .then(() => {
      isPersistingError = false;
    });
}

function addLog(
  level: ErrorLog["level"],
  source: string,
  message: string,
  details?: unknown
): void {
  const entry: ErrorLog = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    details: details
      ? typeof details === "string"
        ? details
        : JSON.stringify(details, null, 2)
      : undefined,
  };
  logs = [...logs.slice(-(MAX_LOGS - 1)), entry];
  emit();
  persistToSupabase(entry);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function logError(source: string, message: string, details?: unknown): void {
  addLog("error", source, message, details);
  // Also keep the original console.error for server-side visibility
  console.error(`[ERROR] ${source}: ${message}`, details ?? "");
}

export function logWarn(source: string, message: string, details?: unknown): void {
  addLog("warn", source, message, details);
  console.warn(`[WARN] ${source}: ${message}`, details ?? "");
}

export function logInfo(source: string, message: string, details?: unknown): void {
  addLog("info", source, message, details);
}

export function getLogs(): ErrorLog[] {
  return [...logs];
}

export function clearLogs(): void {
  logs = [];
  emit();
}

export function getLogsAsText(): string {
  if (logs.length === 0) return "=== Z-Health AI Error Log ===\nNo entries logged.\n";

  const header = `=== Z-Health AI Error Log ===\nGenerated: ${new Date().toISOString().replace("T", " ").slice(0, 19)}\nEntries: ${logs.length}\n`;

  const lines = logs
    .slice()
    .reverse()
    .map((entry) => {
      const time = entry.timestamp.slice(11, 19);
      const tag =
        entry.level === "error"
          ? "[ERROR]"
          : entry.level === "warn"
          ? "[WARN]"
          : "[INFO]";
      let line = `${tag} ${time} | ${entry.source} | ${entry.message}`;
      if (entry.details) {
        line += `\n  Details: ${entry.details.split("\n").join("\n  ")}`;
      }
      return line;
    });

  return header + "\n" + lines.join("\n\n") + "\n";
}

// ---------------------------------------------------------------------------
// React hook — subscribe to log updates
// ---------------------------------------------------------------------------

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): ErrorLog[] {
  return logs;
}
