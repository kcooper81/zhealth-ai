"use client";

import { useState } from "react";
import FunnelBuilder, { FunnelBuilderTrigger, type PageGroup, type SavedFunnelInput } from "./FunnelBuilder";
import { Edit, X, RotateCw } from "@/components/icons";

type EventOption = { value: string; label: string; description: string };

type SavedFunnel = SavedFunnelInput & {
  id: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  savedFunnels: SavedFunnel[];
  pageGroups: Record<PageGroup, GroupedPage[]>;
  eventCatalog: EventOption[];
};

type GroupedPage = { path: string; label: string; sublabel?: string };

export default function FunnelManager({ savedFunnels, pageGroups, eventCatalog }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SavedFunnel | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const seedCount = savedFunnels.filter((f) => f.id.startsWith("seed-")).length;
  const customCount = savedFunnels.length - seedCount;

  const onClose = () => {
    setOpen(false);
    setEditing(null);
  };

  const onEdit = (f: SavedFunnel) => {
    setEditing(f);
    setOpen(true);
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this funnel report? This can't be undone.")) return;
    setDeletingId(id);
    try {
      const r = await fetch(`/api/portal/funnels/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Delete failed (${r.status})`);
      }
      window.location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const onResetDefaults = async () => {
    if (!confirm("Restore the default built-in funnel reports? Any seed-* funnels will be reset; your own custom funnels are preserved.")) return;
    setResetting(true);
    try {
      const r = await fetch("/api/portal/funnels/seed?mode=force", { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Reset failed (${r.status})`);
      }
      window.location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-[#1f1f22]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              Funnel reports
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {savedFunnels.length} total
              {seedCount > 0 && ` · ${seedCount} from defaults`}
              {customCount > 0 && ` · ${customCount} your own`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResetDefaults}
              disabled={resetting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
              title="Restore the default built-in funnel reports (your own customs are preserved)"
            >
              <RotateCw size={11} />
              <span>{resetting ? "Resetting…" : "Restore defaults"}</span>
            </button>
            <FunnelBuilderTrigger onClick={() => { setEditing(null); setOpen(true); }} />
          </div>
        </div>

        {savedFunnels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-6 text-center dark:border-white/10 dark:bg-white/[0.02]">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No custom funnel reports yet.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Click <strong>Build a new funnel</strong> to add one. Saved funnels appear here and on the page below.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/5">
            {savedFunnels.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{f.label}</span>
                    {f.id.startsWith("seed-") ? (
                      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-gray-700 dark:bg-white/5 dark:text-gray-400">
                        Default
                      </span>
                    ) : (
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                        Custom
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className="font-mono">{f.entryPath}</span>
                    <span>·</span>
                    <span>{f.property === "lms" ? "LMS / Thinkific" : "Website"}</span>
                    <span>·</span>
                    <span>{f.steps.length} step{f.steps.length === 1 ? "" : "s"}</span>
                    <span>·</span>
                    <span title={`Updated ${new Date(f.updatedAt).toLocaleString()}`}>
                      Updated {new Date(f.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(f)}
                    className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
                  >
                    <Edit size={12} className="inline" />
                    <span className="ml-1">Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(f.id)}
                    disabled={deletingId === f.id}
                    className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  >
                    <X size={12} className="inline" />
                    <span className="ml-1">{deletingId === f.id ? "Deleting…" : "Delete"}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FunnelBuilder
        pageGroups={pageGroups}
        eventCatalog={eventCatalog}
        open={open}
        onClose={onClose}
        initial={editing || undefined}
      />
    </>
  );
}
