"use client";

import { useState } from "react";
import FunnelBuilder, { FunnelBuilderTrigger, type PageGroup, type SavedFunnelInput } from "./FunnelBuilder";
import Modal from "./Modal";
import { Edit, X, RotateCw, Settings } from "@/components/icons";

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
  const [builderOpen, setBuilderOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editing, setEditing] = useState<SavedFunnel | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const seedCount = savedFunnels.filter((f) => f.id.startsWith("seed-")).length;
  const customCount = savedFunnels.length - seedCount;

  const onCloseBuilder = () => {
    setBuilderOpen(false);
    setEditing(null);
  };

  const onEdit = (f: SavedFunnel) => {
    setEditing(f);
    setManageOpen(false);
    setBuilderOpen(true);
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
    if (!confirm("Restore the default built-in funnel reports? Default funnels reset; your own custom funnels are preserved.")) return;
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
      {/* Compact toolbar — no list of funnels taking up vertical space */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200/70 bg-white/50 px-4 py-2.5 dark:border-white/5 dark:bg-white/[0.02]">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-gray-100">{savedFunnels.length}</span> funnel report{savedFunnels.length === 1 ? "" : "s"}
          {seedCount > 0 && <> · <span className="text-gray-400">{seedCount} default</span></>}
          {customCount > 0 && <> · <span className="text-blue-700 dark:text-blue-400">{customCount} custom</span></>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          >
            <Settings size={12} />
            <span>Manage</span>
          </button>
          <FunnelBuilderTrigger onClick={() => { setEditing(null); setBuilderOpen(true); }} />
        </div>
      </div>

      {/* Manage modal — list of all funnels with edit/delete */}
      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Manage funnel reports"
        description="Edit or delete any funnel — defaults can be customized too."
        size="3xl"
        footer={
          <>
            <button
              type="button"
              onClick={onResetDefaults}
              disabled={resetting}
              className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
              title="Restore the default funnel reports (custom funnels are preserved)"
            >
              <RotateCw size={11} />
              <span>{resetting ? "Resetting…" : "Restore defaults"}</span>
            </button>
            <button
              type="button"
              onClick={() => setManageOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
            >
              Done
            </button>
          </>
        }
      >
        {savedFunnels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-8 text-center dark:border-white/10 dark:bg-white/[0.02]">
            <p className="text-sm text-gray-600 dark:text-gray-400">No funnel reports yet.</p>
            <p className="mt-1 text-xs text-gray-500">
              Close this and click <strong>Build a new funnel</strong>.
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
      </Modal>

      {/* Build/edit modal */}
      <FunnelBuilder
        pageGroups={pageGroups}
        eventCatalog={eventCatalog}
        open={builderOpen}
        onClose={onCloseBuilder}
        initial={editing || undefined}
      />
    </>
  );
}
