"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Plus, X, Funnel as FunnelIcon } from "@/components/icons";

type EventOption = { value: string; label: string; description: string };

type Props = {
  /** Pre-known landing pages from the LP map, shown at the top of the dropdown. */
  knownPages: Array<{ path: string; label: string }>;
  /** GA4 top-pages in window (suggested entries). */
  topPages: Array<{ path: string; pageviews: number }>;
  /** Catalog of events the user can pick at each step. */
  eventCatalog: EventOption[];
  /** Current entry path from URL params, or null. */
  currentEntry: string | null;
  /** Current steps from URL params (event names), or null for default. */
  currentSteps: string[] | null;
  /** Current property (website / lms). */
  currentProperty: "website" | "lms";
};

const DEFAULT_STEPS = ["page_view", "cta_click", "form_submit", "enroll_click", "begin_checkout", "purchase"];

export default function FunnelBuilder({
  knownPages,
  topPages,
  eventCatalog,
  currentEntry,
  currentSteps,
  currentProperty,
}: Props) {
  const pathname = usePathname();
  const search = useSearchParams();

  const [entry, setEntry] = useState(currentEntry || "");
  const [property, setProperty] = useState<"website" | "lms">(currentProperty);
  const [steps, setSteps] = useState<string[]>(
    currentSteps && currentSteps.length > 0 ? currentSteps : DEFAULT_STEPS
  );
  const [open, setOpen] = useState(false);

  const apply = () => {
    const params = new URLSearchParams(Array.from(search.entries()));
    if (entry.trim()) {
      params.set("entry", entry.trim());
      params.set("steps", steps.join(","));
      params.set("property", property);
    } else {
      params.delete("entry");
      params.delete("steps");
      params.delete("property");
    }
    const qs = params.toString();
    window.location.assign(`${pathname}${qs ? `?${qs}` : ""}`);
  };

  const reset = () => {
    const params = new URLSearchParams(Array.from(search.entries()));
    params.delete("entry");
    params.delete("steps");
    params.delete("property");
    const qs = params.toString();
    window.location.assign(`${pathname}${qs ? `?${qs}` : ""}`);
  };

  const updateStep = (idx: number, value: string) => {
    setSteps((s) => s.map((v, i) => (i === idx ? value : v)));
  };
  const removeStep = (idx: number) => {
    setSteps((s) => s.filter((_, i) => i !== idx));
  };
  const addStep = () => {
    setSteps((s) => [...s, "purchase"]);
  };
  const moveStep = (idx: number, dir: -1 | 1) => {
    setSteps((s) => {
      const next = [...s];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return s;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  // Combine known pages + GA4 top pages, dedup by path
  const seen = new Set<string>();
  const allPages: Array<{ path: string; label: string; sublabel?: string }> = [];
  for (const lp of knownPages) {
    if (seen.has(lp.path)) continue;
    seen.add(lp.path);
    allPages.push({ path: lp.path, label: lp.label, sublabel: lp.path });
  }
  for (const p of topPages.slice(0, 30)) {
    if (seen.has(p.path)) continue;
    seen.add(p.path);
    allPages.push({ path: p.path, label: p.path, sublabel: `${p.pageviews.toLocaleString()} views` });
  }

  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-[#1f1f22]">
      <div className="mb-4 flex items-center gap-2">
        <FunnelIcon size={16} className="text-brand-blue" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Build a custom funnel</h3>
        {currentEntry && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            Active: {currentEntry}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Entry-page selector */}
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Entry page (path)
          </label>
          <div className="relative">
            <input
              type="text"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder="/lower-back  or  /blog/your-post-slug"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm font-mono text-gray-900 dark:border-white/10 dark:bg-[#19191c] dark:text-gray-100"
              onFocus={() => setOpen(true)}
            />
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
            >
              <ChevronDown size={14} />
            </button>
            {open && allPages.length > 0 && (
              <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200/80 bg-white shadow-xl ring-1 ring-black/5 dark:border-white/10 dark:bg-[#1f1f22] dark:ring-white/10">
                <ul className="py-1">
                  {allPages.map((p) => (
                    <li key={p.path}>
                      <button
                        type="button"
                        onClick={() => {
                          setEntry(p.path);
                          setOpen(false);
                        }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        <span className="text-gray-900 dark:text-gray-100">{p.label}</span>
                        {p.sublabel && (
                          <span className="font-mono text-[11px] text-gray-500">{p.sublabel}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            Pick a known LP from the list, type any GA4 pagePath, or use a partial like <code>/blog</code> to match a section.
          </p>
        </div>

        {/* Property selector */}
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            GA4 property
          </label>
          <div className="flex gap-2">
            {(["website", "lms"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setProperty(opt)}
                className={[
                  "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                  property === opt
                    ? "border-brand-blue bg-brand-blue/10 font-medium text-brand-blue"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10",
                ].join(" ")}
              >
                {opt === "website" ? "Website" : "LMS / Thinkific"}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            Use <strong>website</strong> for funnels starting on zhealtheducation.com, <strong>LMS</strong> when starting on a Thinkific page.
          </p>
        </div>
      </div>

      {/* Step editor */}
      <div className="mt-6">
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Funnel steps ({steps.length})
        </label>
        <div className="space-y-2">
          {steps.map((stepEvent, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-6 text-center text-xs font-semibold text-gray-500">{idx + 1}.</span>
              <select
                value={stepEvent}
                onChange={(e) => updateStep(idx, e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-white/10 dark:bg-[#19191c] dark:text-gray-100"
              >
                {eventCatalog.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.value})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => moveStep(idx, -1)}
                disabled={idx === 0}
                className="rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-30 dark:border-white/10 dark:hover:bg-white/5"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveStep(idx, 1)}
                disabled={idx === steps.length - 1}
                className="rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-30 dark:border-white/10 dark:hover:bg-white/5"
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeStep(idx)}
                disabled={steps.length <= 1}
                className="rounded-md border border-gray-200 px-1.5 py-1 text-gray-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30 dark:border-white/10 dark:hover:bg-rose-950/30"
                title="Remove step"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addStep}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700 dark:border-white/10 dark:hover:border-white/20 dark:hover:text-gray-300"
        >
          <Plus size={12} /> Add step
        </button>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          onClick={apply}
          disabled={!entry.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-black disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          Build funnel
        </button>
        {currentEntry && (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
          >
            Clear · show presets
          </button>
        )}
        <p className="ml-auto text-[11px] text-gray-500">
          Steps tagged on-page (page_view, cta_click, form_submit) are filtered to your entry path.
          Downstream steps (enroll, checkout, purchase) match anywhere.
        </p>
      </div>
    </div>
  );
}
