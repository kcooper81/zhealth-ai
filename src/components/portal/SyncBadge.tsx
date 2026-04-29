"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RotateCw, Check, AlertCircle } from "@/components/icons";

type SyncMeta = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  refreshed: number;
  errors: string[];
};

type Status = {
  all: SyncMeta | null;
  keap: SyncMeta | null;
  thinkific: SyncMeta | null;
  wp: SyncMeta | null;
};

function timeAgo(iso: string | undefined | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function SyncBadge() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/sync-status", { cache: "no-store" });
      if (!res.ok) return;
      setStatus(await res.json());
    } catch {
      // Silent — don't break UI for status fetch failures
    }
  }, []);

  useEffect(() => {
    loadStatus();
    // Refresh the displayed "X ago" every 30s
    const t = setInterval(loadStatus, 30_000);
    return () => clearInterval(t);
  }, [loadStatus]);

  const handleRefresh = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    setJustSynced(false);
    try {
      const res = await fetch("/api/cron/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sync failed");
      } else {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 2500);
        await loadStatus();
        // Re-render the current portal page with fresh cached data
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSyncing(false);
    }
  }, [syncing, loadStatus, router]);

  const lastSyncIso = status?.all?.finishedAt ?? null;
  const errorCount = status?.all?.errors?.length ?? 0;

  return (
    <div className="border-t border-gray-200/70 px-3 py-2.5 dark:border-white/5">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={syncing}
        className={[
          "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition-all",
          "border border-gray-200/80 bg-white/60 hover:bg-white",
          "dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.06]",
          syncing ? "cursor-wait opacity-80" : "cursor-pointer",
        ].join(" ")}
        title={
          status?.all
            ? `Last sync ${timeAgo(lastSyncIso)} · ${status.all.refreshed} cache entries refreshed${errorCount > 0 ? ` · ${errorCount} errors` : ""}`
            : "Click to sync now"
        }
      >
        <span
          className={[
            "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg",
            justSynced
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : error
              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
              : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300",
          ].join(" ")}
        >
          {justSynced ? (
            <Check size={13} />
          ) : error ? (
            <AlertCircle size={13} />
          ) : (
            <RotateCw size={13} className={syncing ? "animate-spin" : ""} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {syncing
              ? "Syncing data…"
              : justSynced
              ? "Synced just now"
              : error
              ? "Sync failed"
              : "Refresh data"}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-500">
            {error
              ? error.slice(0, 60)
              : status?.all
              ? `Last synced ${timeAgo(lastSyncIso)}`
              : "Click to fetch fresh data"}
          </div>
        </div>
      </button>
    </div>
  );
}
