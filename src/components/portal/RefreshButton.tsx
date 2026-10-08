"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Forces a server-side recompute of a report snapshot, then refreshes the
 * route so the page re-renders from the freshly cached data.
 */
export default function RefreshButton({ endpoint, label = "Refresh" }: { endpoint: string; label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  const spinning = busy || isPending;
  return (
    <button
      onClick={onClick}
      disabled={spinning}
      title={err ? `Last refresh failed: ${err}` : "Pull the latest data now"}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.08]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={spinning ? "animate-spin" : ""}>
        <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {spinning ? "Refreshing…" : (err ? "Retry" : label)}
    </button>
  );
}
