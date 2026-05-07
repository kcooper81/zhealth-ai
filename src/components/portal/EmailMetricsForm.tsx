"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Metrics = {
  week_of?: string;
  click_rate?: number | null;
  open_rate?: number | null;
  complaint_rate?: number | null;
  unsubscribes_30d?: number | null;
  unsubscribe_reasons?: string | null;
  notes?: string | null;
} | null;

export default function EmailMetricsForm({ initial }: { initial: Metrics }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [weekOf, setWeekOf] = useState<string>(
    initial?.week_of || new Date().toISOString().slice(0, 10)
  );
  const [clickRate, setClickRate] = useState<string>(
    initial?.click_rate != null ? (initial.click_rate * 100).toFixed(2) : ""
  );
  const [openRate, setOpenRate] = useState<string>(
    initial?.open_rate != null ? (initial.open_rate * 100).toFixed(2) : ""
  );
  const [complaintRate, setComplaintRate] = useState<string>(
    initial?.complaint_rate != null ? (initial.complaint_rate * 100).toFixed(2) : ""
  );
  const [unsubscribes30d, setUnsubscribes30d] = useState<string>(
    initial?.unsubscribes_30d != null ? String(initial.unsubscribes_30d) : ""
  );
  const [unsubscribeReasons, setUnsubscribeReasons] = useState<string>(
    initial?.unsubscribe_reasons || ""
  );
  const [notes, setNotes] = useState<string>(initial?.notes || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/email-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_of: weekOf,
          click_rate: clickRate ? parseFloat(clickRate) / 100 : null,
          open_rate: openRate ? parseFloat(openRate) / 100 : null,
          complaint_rate: complaintRate ? parseFloat(complaintRate) / 100 : null,
          unsubscribes_30d: unsubscribes30d ? parseInt(unsubscribes30d, 10) : null,
          unsubscribe_reasons: unsubscribeReasons || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Save failed (${res.status})`);
      } else {
        setOpen(false);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
      >
        Update email metrics →
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-[#1f1f22]"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          Update email metrics
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          Cancel
        </button>
      </div>
      <p className="mb-5 text-xs text-gray-500 dark:text-gray-400">
        Enter percentages as numbers (e.g. <code>43.11</code> for 43.11%). Find these in Keap admin
        → Reports → Email Performance.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Week of
          </span>
          <input
            type="date"
            value={weekOf}
            onChange={(e) => setWeekOf(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#19191c] dark:text-gray-100"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Click rate (%)
          </span>
          <input
            type="number"
            step="0.01"
            value={clickRate}
            onChange={(e) => setClickRate(e.target.value)}
            placeholder="1.80"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#19191c] dark:text-gray-100"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Open rate (%)
          </span>
          <input
            type="number"
            step="0.01"
            value={openRate}
            onChange={(e) => setOpenRate(e.target.value)}
            placeholder="43.11"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#19191c] dark:text-gray-100"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Complaint rate (%)
          </span>
          <input
            type="number"
            step="0.01"
            value={complaintRate}
            onChange={(e) => setComplaintRate(e.target.value)}
            placeholder="0.27"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#19191c] dark:text-gray-100"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Unsubscribes (last 30 days)
          </span>
          <input
            type="number"
            value={unsubscribes30d}
            onChange={(e) => setUnsubscribes30d(e.target.value)}
            placeholder="318"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#19191c] dark:text-gray-100"
          />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Unsubscribe reasons (one per line — paste from Keap admin)
        </span>
        <textarea
          rows={5}
          value={unsubscribeReasons}
          onChange={(e) => setUnsubscribeReasons(e.target.value)}
          placeholder={"Too many emails\nAlready receiving these on another email\nNo time…"}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-sm dark:border-white/10 dark:bg-[#19191c] dark:text-gray-100"
        />
      </label>
      <label className="mt-4 block">
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Notes (optional)
        </span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything noteworthy about this week's emails…"
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#19191c] dark:text-gray-100"
        />
      </label>
      {error && (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </p>
      )}
      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
