"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { X, Search, Trash, Copy, Bug, ClipboardCopy } from "./icons";
import { notify } from "@/lib/notifications";
import type { ErrorLog } from "@/lib/error-logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LevelFilter = "all" | "error" | "warn" | "info";

// ---------------------------------------------------------------------------
// Hook: subscribe to server-side logs via polling
// ---------------------------------------------------------------------------

function useErrorLogs() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);

  useEffect(() => {
    let mounted = true;

    async function fetchLogs() {
      try {
        const res = await fetch("/api/logs");
        if (res.ok && mounted) {
          const data = await res.json();
          if (Array.isArray(data)) setLogs(data);
        }
      } catch {
        // Silently fail
      }
    }

    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return logs;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(timestamp: string): string {
  try {
    return timestamp.slice(11, 19);
  } catch {
    return "";
  }
}

function formatFullTimestamp(timestamp: string): string {
  try {
    return timestamp.replace("T", " ").slice(0, 19);
  } catch {
    return timestamp;
  }
}

function getLevelBadge(level: ErrorLog["level"]): {
  label: string;
  className: string;
  rowClassName: string;
} {
  switch (level) {
    case "error":
      return {
        label: "ERROR",
        className:
          "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
        rowClassName:
          "bg-red-50/60 dark:bg-red-900/10 border-l-2 border-red-400 dark:border-red-600",
      };
    case "warn":
      return {
        label: "WARN",
        className:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
        rowClassName:
          "bg-amber-50/60 dark:bg-amber-900/10 border-l-2 border-amber-400 dark:border-amber-600",
      };
    case "info":
      return {
        label: "INFO",
        className:
          "bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400",
        rowClassName:
          "bg-gray-50/40 dark:bg-gray-800/20 border-l-2 border-gray-300 dark:border-gray-600",
      };
  }
}

function formatLogEntry(entry: ErrorLog): string {
  const time = formatTime(entry.timestamp);
  const tag =
    entry.level === "error"
      ? "[ERROR]"
      : entry.level === "warn"
      ? "[WARN]"
      : "[INFO]";
  let line = `${tag} ${time} | ${entry.source} | ${entry.message}`;
  if (entry.details) {
    line += `\n  Details: ${entry.details}`;
  }
  return line;
}

// ---------------------------------------------------------------------------
// DebugPanel
// ---------------------------------------------------------------------------

interface DebugPanelProps {
  show: boolean;
  onClose: () => void;
}

export default function DebugPanel({ show, onClose }: DebugPanelProps) {
  const logs = useErrorLogs();
  const [filter, setFilter] = useState<LevelFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let filtered = logs;
    if (filter !== "all") {
      filtered = filtered.filter((l) => l.level === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.source.toLowerCase().includes(q) ||
          (l.details && l.details.toLowerCase().includes(q))
      );
    }
    // Newest first
    return [...filtered].reverse();
  }, [logs, filter, searchQuery]);

  // Counts
  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;
  const infoCount = logs.filter((l) => l.level === "info").length;

  const handleCopyAll = useCallback(async () => {
    try {
      const res = await fetch("/api/logs?format=text");
      if (res.ok) {
        const text = await res.text();
        await navigator.clipboard.writeText(text);
        notify("success", "Copied all logs to clipboard");
      }
    } catch {
      notify("error", "Failed to copy logs");
    }
  }, []);

  const handleCopyEntry = useCallback(async (entry: ErrorLog) => {
    try {
      const text = formatLogEntry(entry);
      await navigator.clipboard.writeText(text);
      notify("success", "Copied log entry");
    } catch {
      notify("error", "Failed to copy");
    }
  }, []);

  const handleClearLogs = useCallback(async () => {
    try {
      await fetch("/api/logs", { method: "DELETE" });
      notify("info", "Logs cleared");
    } catch {
      notify("error", "Failed to clear logs");
    }
  }, []);

  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[480px] md:w-[540px] bg-white dark:bg-[#1c1c1e] shadow-2xl z-[61] flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bug size={18} className="text-gray-500 dark:text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Error Log
            </h2>
            {logs.length > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                ({logs.length})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Copy all logs to clipboard"
            >
              <ClipboardCopy size={14} />
              Copy All
            </button>
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Clear all logs"
            >
              <Trash size={14} />
              Clear
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <FilterPill
            label="All"
            count={logs.length}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterPill
            label="Errors"
            count={errorCount}
            active={filter === "error"}
            onClick={() => setFilter("error")}
            color="red"
          />
          <FilterPill
            label="Warnings"
            count={warnCount}
            active={filter === "warn"}
            onClick={() => setFilter("warn")}
            color="amber"
          />
          <FilterPill
            label="Info"
            count={infoCount}
            active={filter === "info"}
            onClick={() => setFilter("info")}
            color="gray"
          />
        </div>

        {/* Search */}
        <div className="px-4 py-2 flex-shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Log entries */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <Bug size={32} className="text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                {logs.length === 0
                  ? "No errors logged. That's a good thing!"
                  : "No matching log entries."}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {logs.length === 0
                  ? "Errors, warnings, and info messages from API routes will appear here."
                  : "Try adjusting your filter or search query."}
              </p>
            </div>
          ) : (
            <div className="space-y-1 pt-1">
              {filteredLogs.map((entry) => {
                const badge = getLevelBadge(entry.level);
                const isExpanded = expandedId === entry.id;

                return (
                  <div
                    key={entry.id}
                    className={`rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${badge.rowClassName} hover:opacity-90`}
                    onClick={() =>
                      setExpandedId(isExpanded ? null : entry.id)
                    }
                  >
                    <div className="flex items-start gap-2">
                      {/* Level badge */}
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${badge.className}`}
                      >
                        {badge.label}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono flex-shrink-0">
                            {formatTime(entry.timestamp)}
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium flex-shrink-0">
                            {entry.source}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 break-words">
                          {entry.message}
                        </p>
                      </div>

                      {/* Copy single entry */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyEntry(entry);
                        }}
                        className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                        style={{ opacity: 0.5 }}
                        title="Copy this entry"
                      >
                        <Copy size={12} />
                      </button>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && entry.details && (
                      <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Details
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                            {formatFullTimestamp(entry.timestamp)}
                          </span>
                        </div>
                        <pre className="text-xs text-gray-600 dark:text-gray-300 font-mono whitespace-pre-wrap break-words bg-white/50 dark:bg-black/20 rounded-md p-2 max-h-60 overflow-y-auto">
                          {entry.details}
                        </pre>
                      </div>
                    )}

                    {isExpanded && !entry.details && (
                      <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                          No additional details available.
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono ml-2">
                          {formatFullTimestamp(entry.timestamp)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {logs.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {logs.length} entries (max 200)
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              Cmd+D to toggle
            </span>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// FilterPill
// ---------------------------------------------------------------------------

function FilterPill({
  label,
  count,
  active,
  onClick,
  color,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: "red" | "amber" | "gray";
}) {
  const baseClass = active
    ? color === "red"
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
      : color === "amber"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
      : "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200"
    : "bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50";

  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1 ${baseClass}`}
    >
      {label}
      {count > 0 && (
        <span className="text-[10px] opacity-70">{count}</span>
      )}
    </button>
  );
}
