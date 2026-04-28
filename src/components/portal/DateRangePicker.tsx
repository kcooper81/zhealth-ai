"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "@/components/icons";

const PRESETS = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "12mo", label: "Last 12 months" },
  { id: "ytd", label: "Year to date" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom range…" },
] as const;

export default function DateRangePicker() {
  const router = useRouter();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const current = search.get("range") || "30d";
  const fromVal = search.get("from") || "";
  const toVal = search.get("to") || "";

  useEffect(() => {
    if (current === "custom") setShowCustom(true);
  }, [current]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const setRange = (id: string) => {
    const params = new URLSearchParams(Array.from(search.entries()));
    params.set("range", id);
    if (id !== "custom") {
      params.delete("from");
      params.delete("to");
      setShowCustom(false);
    } else {
      setShowCustom(true);
    }
    router.replace(`?${params.toString()}`, { scroll: false });
    if (id !== "custom") setOpen(false);
  };

  const setCustomDate = (which: "from" | "to", val: string) => {
    const params = new URLSearchParams(Array.from(search.entries()));
    params.set("range", "custom");
    params.set(which, val);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const activeLabel =
    PRESETS.find((p) => p.id === current)?.label || "Last 30 days";

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200/80 bg-white/80 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm backdrop-blur transition-colors hover:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>{activeLabel}</span>
        <ChevronDown size={14} className="text-gray-500" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 origin-top-right overflow-hidden rounded-xl border border-gray-200/80 bg-white/95 shadow-xl ring-1 ring-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-[#1f1f22]/95 dark:ring-white/10 animate-fade-in"
        >
          <ul className="py-1">
            {PRESETS.map((p) => {
              const isActive = p.id === current;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setRange(p.id)}
                    className={[
                      "flex w-full items-center justify-between px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-gray-100 font-medium text-gray-900 dark:bg-white/10 dark:text-gray-50"
                        : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5",
                    ].join(" ")}
                  >
                    {p.label}
                    {isActive && <span className="text-xs text-brand-blue">•</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {showCustom && (
            <div className="border-t border-gray-200/70 p-3 dark:border-white/5">
              <div className="space-y-2">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    From
                  </span>
                  <input
                    type="date"
                    value={fromVal.slice(0, 10)}
                    onChange={(e) => setCustomDate("from", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-white/10 dark:bg-[#19191c] dark:text-gray-100"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    To
                  </span>
                  <input
                    type="date"
                    value={toVal.slice(0, 10)}
                    onChange={(e) => setCustomDate("to", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-white/10 dark:bg-[#19191c] dark:text-gray-100"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
