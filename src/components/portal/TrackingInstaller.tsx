"use client";

import { useState, useEffect } from "react";
import { Check, AlertCircle, RotateCw, Zap } from "@/components/icons";

type Status = {
  installed: boolean;
  snippetId: number | null;
  liveOnSite: boolean;
  modifiedAt: string | null;
  message: string;
};

type InstallResult = {
  ok: boolean;
  snippetId: number | null;
  cachePurged: boolean;
  liveOnSite: boolean;
  action: "created" | "updated" | "error";
  error?: string;
};

export default function TrackingInstaller() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<InstallResult | null>(null);

  const refresh = async () => {
    try {
      const r = await fetch("/api/portal/install-tracking", { cache: "no-store" });
      const j = await r.json();
      setStatus(j);
    } catch {
      setStatus(null);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const install = async () => {
    setBusy(true);
    setLastResult(null);
    try {
      const r = await fetch("/api/portal/install-tracking", { method: "POST" });
      const j = (await r.json()) as InstallResult;
      setLastResult(j);
      await refresh();
    } catch (e) {
      setLastResult({
        ok: false,
        snippetId: null,
        cachePurged: false,
        liveOnSite: false,
        action: "error",
        error: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  };

  const dotCls = !status
    ? "bg-gray-300"
    : status.liveOnSite
    ? "bg-emerald-500"
    : status.installed
    ? "bg-amber-500"
    : "bg-rose-500";

  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-[#1f1f22]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${dotCls}`} />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              Z-Health Unified Tracking on WordPress
            </h3>
          </div>
          {status && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {status.message}
              {status.snippetId && (
                <span className="ml-2 font-mono text-xs text-gray-500">snippet #{status.snippetId}</span>
              )}
              {status.modifiedAt && (
                <span className="ml-2 text-xs text-gray-500">· last pushed {new Date(status.modifiedAt + "Z").toLocaleString()}</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
            title="Re-check status"
          >
            <RotateCw size={12} />
          </button>
          <button
            type="button"
            onClick={install}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-black disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {busy ? (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                <span>Pushing…</span>
              </>
            ) : (
              <>
                <Zap size={14} />
                <span>{status?.installed ? "Re-push to WP" : "Install on WP"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {lastResult && (
        <div
          className={[
            "mt-4 rounded-lg p-3 text-xs",
            lastResult.ok
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200",
          ].join(" ")}
        >
          <div className="flex items-center gap-2">
            {lastResult.ok ? <Check size={14} /> : <AlertCircle size={14} />}
            <strong>
              {lastResult.ok
                ? lastResult.action === "created"
                  ? "Created on WP"
                  : "Updated on WP"
                : "Push failed"}
            </strong>
          </div>
          <ul className="mt-1.5 ml-5 list-disc space-y-0.5">
            {lastResult.snippetId && <li>Elementor Custom Code id: {lastResult.snippetId}</li>}
            <li>Cache purged: {lastResult.cachePurged ? "yes" : "no (already fresh)"}</li>
            <li>Tracking visible on live site: {lastResult.liveOnSite ? "yes" : "not yet (give it ~30s)"}</li>
            {lastResult.error && <li>Error: {lastResult.error}</li>}
          </ul>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-500">
        <strong>What this installs:</strong> a single Elementor Custom Code in <span className="font-mono">&lt;head&gt;</span> that:
        bootstraps first-touch UTM/landing into sessionStorage, fires custom GA4 events
        (cta_click, form_submit, outbound_click, enroll_click, page_context), and
        auto-tags every link to courses.zhealtheducation.com / *.thinkific.com with
        utm_source / utm_medium / utm_campaign so attribution survives the domain hop.
        Source of truth: <span className="font-mono">src/lib/wp-tracking-installer.ts</span>.
      </div>
    </div>
  );
}
