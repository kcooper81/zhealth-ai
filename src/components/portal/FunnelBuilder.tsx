"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { ChevronDown, Plus, X, Funnel as FunnelIcon, Search, Check } from "@/components/icons";
import { describeStep } from "@/lib/funnel-config";

type EventOption = { value: string; label: string; description: string };

export type PageGroup =
  | "Mapped landing pages"
  | "WordPress pages"
  | "WordPress posts"
  | "Thinkific courses"
  | "Recent GA4 traffic";

type GroupedPage = { path: string; label: string; sublabel?: string };

export type SavedFunnelInput = {
  id?: string;
  label: string;
  description?: string;
  property: "website" | "lms";
  entryPath: string;
  steps: Array<{ name: string; eventName: string; pageMatch?: string }>;
};

type Props = {
  /** Pages grouped by source (mapped LPs / WP pages / WP posts / Thinkific / GA4 top). */
  pageGroups: Record<PageGroup, GroupedPage[]>;
  /** Catalog of events the user can pick at each step. */
  eventCatalog: EventOption[];
  /** Optional initial values when editing an existing saved funnel */
  initial?: SavedFunnelInput;
  /** Whether the modal is open */
  open: boolean;
  onClose: () => void;
};

const DEFAULT_STEPS = ["page_view", "cta_click", "form_submit", "enroll_click", "begin_checkout", "purchase"];
const ON_PAGE_EVENTS = new Set(["page_view", "session_start", "cta_click", "form_submit", "outbound_click"]);

const GROUP_ORDER: PageGroup[] = [
  "Mapped landing pages",
  "WordPress pages",
  "WordPress posts",
  "Thinkific courses",
  "Recent GA4 traffic",
];

function detectProperty(path: string): "website" | "lms" {
  return /\/courses\/|thinkific\.com/i.test(path) ? "lms" : "website";
}

export default function FunnelBuilder({ pageGroups, eventCatalog, initial, open, onClose }: Props) {
  const router = useRouter();

  const [name, setName] = useState(initial?.label || "");
  const [entry, setEntry] = useState(initial?.entryPath || "");
  const [property, setProperty] = useState<"website" | "lms">(initial?.property || "website");
  const [autoProperty, setAutoProperty] = useState(!initial); // editing → keep manual choice
  const [steps, setSteps] = useState<string[]>(
    initial?.steps && initial.steps.length > 0 ? initial.steps.map((s) => s.eventName) : DEFAULT_STEPS
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens with new initial values
  useEffect(() => {
    if (!open) return;
    setName(initial?.label || "");
    setEntry(initial?.entryPath || "");
    setProperty(initial?.property || "website");
    setAutoProperty(!initial);
    setSteps(initial?.steps && initial.steps.length > 0 ? initial.steps.map((s) => s.eventName) : DEFAULT_STEPS);
    setFilter("");
    setError(null);
  }, [open, initial]);

  // Auto-detect property
  useEffect(() => {
    if (autoProperty && entry) {
      const detected = detectProperty(entry);
      if (detected !== property) setProperty(detected);
    }
  }, [entry, autoProperty]); // eslint-disable-line react-hooks/exhaustive-deps

  // Outside-click for picker dropdown
  useEffect(() => {
    if (!pickerOpen) return;
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [pickerOpen]);

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

  const updateStep = (i: number, v: string) => setSteps((s) => s.map((x, idx) => (idx === i ? v : x)));
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));
  const addStep = () => setSteps((s) => [...s, "purchase"]);
  const moveStep = (i: number, dir: -1 | 1) =>
    setSteps((s) => {
      const next = [...s];
      const swap = i + dir;
      if (swap < 0 || swap >= next.length) return s;
      [next[i], next[swap]] = [next[swap], next[i]];
      return next;
    });

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("Name is required");
    if (!entry.trim()) return setError("Entry page is required");
    if (steps.length === 0) return setError("At least one step is required");

    setSaving(true);
    try {
      const trimmedEntry = entry.trim();
      const stepObjs = steps.map((ev) => ({
        name: describeStep(ev, ON_PAGE_EVENTS.has(ev) ? trimmedEntry : null),
        eventName: ev,
        pageMatch: ON_PAGE_EVENTS.has(ev) ? trimmedEntry : undefined,
      }));
      const r = await fetch("/api/portal/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: initial?.id,
          label: name.trim(),
          property,
          entryPath: entry.trim(),
          steps: stepObjs,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Save failed (${r.status})`);
      }
      onClose();
      // Re-render the page so the new funnel data flows in
      router.refresh();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit funnel report" : "Build a funnel report"}
      description={initial ? `Editing "${initial.label}"` : "Pick an entry page and the events that follow it. Save to add it to your funnel reports."}
      size="3xl"
      footer={
        <>
          {error && <span className="mr-auto text-xs text-rose-600 dark:text-rose-400">{error}</span>}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !name.trim() || !entry.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-black disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {saving ? <span className="h-2 w-2 animate-pulse rounded-full bg-current" /> : <Check size={14} />}
            <span>{saving ? "Saving…" : initial ? "Save changes" : "Save funnel"}</span>
          </button>
        </>
      }
    >
      {/* Name */}
      <div className="mb-4">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Funnel name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Lower Back launch funnel"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-[#19191c] dark:text-gray-100"
        />
      </div>

      {/* Entry + property */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div ref={pickerRef} className="relative">
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Entry page (path)
          </label>
          <input
            type="text"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder="/lower-back, /blog/post-slug, /courses/i-phase…"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm font-mono text-gray-900 dark:border-white/10 dark:bg-[#19191c] dark:text-gray-100"
            onFocus={() => setPickerOpen(true)}
          />
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="absolute right-2 top-[33px] text-gray-500"
          >
            <ChevronDown size={14} />
          </button>

          {pickerOpen && (
            <div className="absolute z-30 mt-1 max-h-[400px] w-full overflow-hidden rounded-lg border border-gray-200/80 bg-white shadow-xl ring-1 ring-black/5 dark:border-white/10 dark:bg-[#1f1f22] dark:ring-white/10">
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
              <div className="max-h-[330px] overflow-y-auto">
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
                                setPickerOpen(false);
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
                    No pages match &ldquo;{filter}&rdquo;. Type the path manually in the input above.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

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
              Auto-detect
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
        </div>
      </div>

      {/* Steps */}
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
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveStep(idx, 1)}
                disabled={idx === steps.length - 1}
                className="rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-30 dark:border-white/10 dark:hover:bg-white/5"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeStep(idx)}
                disabled={steps.length <= 1}
                className="rounded-md border border-gray-200 px-1.5 py-1 text-gray-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30 dark:border-white/10 dark:hover:bg-rose-950/30"
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
        <p className="mt-2 text-[11px] text-gray-500">
          On-page steps (page_view, cta_click, form_submit, outbound_click) auto-filter to your entry path.
          Downstream steps (enroll_click, begin_checkout, purchase) match anywhere on site.
        </p>
      </div>
    </Modal>
  );
}

/** Floating "Build a new funnel" trigger button. */
export function FunnelBuilderTrigger({
  onClick,
  label = "Build a new funnel",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
    >
      <FunnelIcon size={14} />
      <span>{label}</span>
    </button>
  );
}
