"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Plus, X, Funnel as FunnelIcon, Search } from "@/components/icons";

type EventOption = { value: string; label: string; description: string };

export type PageGroup =
  | "Mapped landing pages"
  | "WordPress pages"
  | "WordPress posts"
  | "Thinkific courses"
  | "Recent GA4 traffic";

type GroupedPage = { path: string; label: string; sublabel?: string };

type Props = {
  /** Pages grouped by source (mapped LPs / WP pages / WP posts / Thinkific / GA4 top). */
  pageGroups: Record<PageGroup, GroupedPage[]>;
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

const GROUP_ORDER: PageGroup[] = [
  "Mapped landing pages",
  "WordPress pages",
  "WordPress posts",
  "Thinkific courses",
  "Recent GA4 traffic",
];

/** Heuristic: anything pointing at a Thinkific URL/path is "lms", everything else is "website". */
function detectProperty(path: string): "website" | "lms" {
  return /\/courses\/|thinkific\.com/i.test(path) ? "lms" : "website";
}

export default function FunnelBuilder({
  pageGroups,
  eventCatalog,
  currentEntry,
  currentSteps,
  currentProperty,
}: Props) {
  const pathname = usePathname();
  const search = useSearchParams();

  const [entry, setEntry] = useState(currentEntry || "");
  const [property, setProperty] = useState<"website" | "lms">(currentProperty);
  const [autoProperty, setAutoProperty] = useState(true);
  const [steps, setSteps] = useState<string[]>(
    currentSteps && currentSteps.length > 0 ? currentSteps : DEFAULT_STEPS
  );
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Auto-detect property when entry changes (unless user manually overrode it)
  useEffect(() => {
    if (autoProperty && entry) {
      const detected = detectProperty(entry);
      if (detected !== property) setProperty(detected);
    }
  }, [entry, autoProperty]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

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

  const updateStep = (idx: number, value: string) => setSteps((s) => s.map((v, i) => (i === idx ? value : v)));
  const removeStep = (idx: number) => setSteps((s) => s.filter((_, i) => i !== idx));
  const addStep = () => setSteps((s) => [...s, "purchase"]);
  const moveStep = (idx: number, dir: -1 | 1) => {
    setSteps((s) => {
      const next = [...s];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return s;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  // Filter pages by typed text against path / label / sublabel
  const filteredGroups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return pageGroups;
    const out = {} as Record<PageGroup, GroupedPage[]>;
    for (const g of GROUP_ORDER) {
      out[g] = (pageGroups[g] || []).filter((p) =>
        [p.path, p.label, p.sublabel || ""].some((s) => s.toLowerCase().includes(q))
      );
    }
    return out;
  }, [filter, pageGroups]);

  const visibleCount = GROUP_ORDER.reduce((sum, g) => sum + (filteredGroups[g]?.length || 0), 0);

  return (
    <div ref={wrapperRef} className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-[#1f1f22]">
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
        <div className="relative">
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Entry page (path)
          </label>
          <input
            type="text"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder="/lower-back, /blog/post-slug, /courses/i-phase…"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm font-mono text-gray-900 dark:border-white/10 dark:bg-[#19191c] dark:text-gray-100"
            onFocus={() => setOpen(true)}
          />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="absolute right-2 top-[33px] text-gray-500"
          >
            <ChevronDown size={14} />
          </button>

          {open && (
            <div className="absolute z-30 mt-1 max-h-[460px] w-full overflow-hidden rounded-lg border border-gray-200/80 bg-white shadow-xl ring-1 ring-black/5 dark:border-white/10 dark:bg-[#1f1f22] dark:ring-white/10">
              <div className="flex items-center gap-2 border-b border-gray-200/60 bg-gray-50/50 px-3 py-2 dark:border-white/5 dark:bg-white/[0.02]">
                <Search size={12} className="text-gray-400" />
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={`Filter ${visibleCount} pages…`}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 dark:text-gray-100"
                  autoFocus
                />
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {GROUP_ORDER.map((g) => {
                  const items = filteredGroups[g] || [];
                  if (items.length === 0) return null;
                  return (
                    <div key={g}>
                      <div className="sticky top-0 bg-gray-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:bg-[#19191c] dark:text-gray-400">
                        {g} <span className="ml-1 text-gray-400">({items.length})</span>
                      </div>
                      <ul>
                        {items.slice(0, 100).map((p) => (
                          <li key={`${g}-${p.path}`}>
                            <button
                              type="button"
                              onClick={() => {
                                setEntry(p.path);
                                setOpen(false);
                                setFilter("");
                              }}
                              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5"
                            >
                              <span className="truncate text-gray-900 dark:text-gray-100">{p.label}</span>
                              {p.sublabel && (
                                <span className="ml-2 flex-shrink-0 truncate font-mono text-[11px] text-gray-500" style={{ maxWidth: "55%" }}>
                                  {p.sublabel}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
                {visibleCount === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-gray-500">
                    No pages match &ldquo;{filter}&rdquo;. You can also type the path manually in the input above.
                  </p>
                )}
              </div>
            </div>
          )}

          <p className="mt-1 text-[11px] text-gray-500">
            Pick from any WP page/post, Thinkific course, or LP from the catalog. Type a partial like <code>/blog</code> to capture a section.
          </p>
        </div>

        {/* Property selector */}
        <div>
          <label className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <span>GA4 property</span>
            <label className="flex items-center gap-1 text-[10px] normal-case font-normal tracking-normal text-gray-500">
              <input
                type="checkbox"
                checked={autoProperty}
                onChange={(e) => setAutoProperty(e.target.checked)}
                className="h-3 w-3"
              />
              Auto-detect from path
            </label>
          </label>
          <div className="flex gap-2">
            {(["website", "lms"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setAutoProperty(false);
                  setProperty(opt);
                }}
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
            Auto switches to LMS when the entry path matches <code>/courses/</code> or <code>thinkific.com</code>.
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
          On-page steps (page_view, cta_click, form_submit) auto-filter to your entry path.
        </p>
      </div>
    </div>
  );
}
