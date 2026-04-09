"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { QuickAction, Workspace } from "@/lib/types";
import { getWorkspace } from "@/lib/workspaces";
import {
  X,
  GripVertical,
  Edit,
  Trash,
  Plus,
  EyeOff,
  Eye,
  ArrowUp,
  ArrowDown,
  Check,
  RotateCw,
} from "./icons";

interface QuickActionsManagerProps {
  show: boolean;
  onClose: () => void;
  workspace: Workspace;
  quickActions: QuickAction[];
  onRefresh: () => void;
}

export default function QuickActionsManager({
  show,
  onClose,
  workspace,
  quickActions,
  onRefresh,
}: QuickActionsManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const newLabelRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const workspaceConfig = getWorkspace(workspace);

  // Focus label input when editing starts
  useEffect(() => {
    if (editingId && labelInputRef.current) {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    }
  }, [editingId]);

  // Focus new label input when add form opens
  useEffect(() => {
    if (showAddForm && newLabelRef.current) {
      newLabelRef.current.focus();
    }
  }, [showAddForm]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Close on Escape
  useEffect(() => {
    if (!show) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingId) {
          setEditingId(null);
        } else if (showAddForm) {
          setShowAddForm(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [show, editingId, showAddForm, onClose]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  // --- API Calls ---

  const handleSaveEdit = async (action: QuickAction) => {
    if (!editLabel.trim() || !editPrompt.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/quick-actions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: action.id,
          label: editLabel.trim(),
          prompt: editPrompt.trim(),
        }),
      });
      if (res.ok) {
        setEditingId(null);
        showToast("Updated");
        onRefresh();
      }
    } catch {
      showToast("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (action: QuickAction) => {
    setSaving(true);
    try {
      const res = await fetch("/api/quick-actions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: action.id }),
      });
      if (res.ok) {
        showToast("Deleted");
        onRefresh();
      }
    } catch {
      showToast("Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  const handleHideDefault = async (action: QuickAction) => {
    setSaving(true);
    try {
      const res = await fetch("/api/quick-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "hide",
          workspace,
          prompt: action.prompt,
        }),
      });
      if (res.ok) {
        showToast(action.isHidden ? "Restored" : "Hidden");
        onRefresh();
      }
    } catch {
      showToast("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newLabel.trim() || !newPrompt.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/quick-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace,
          label: newLabel.trim(),
          prompt: newPrompt.trim(),
        }),
      });
      if (res.ok) {
        setNewLabel("");
        setNewPrompt("");
        setShowAddForm(false);
        showToast("Added");
        onRefresh();
      }
    } catch {
      showToast("Failed to add");
    } finally {
      setSaving(false);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const items = [...quickActions];
    const temp = items[index];
    items[index] = items[index - 1];
    items[index - 1] = temp;
    const orderedIds = items.map((a) => a.id);
    try {
      await fetch("/api/quick-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", workspace, orderedIds }),
      });
      onRefresh();
    } catch {
      showToast("Failed to reorder");
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index >= quickActions.length - 1) return;
    const items = [...quickActions];
    const temp = items[index];
    items[index] = items[index + 1];
    items[index + 1] = temp;
    const orderedIds = items.map((a) => a.id);
    try {
      await fetch("/api/quick-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", workspace, orderedIds }),
      });
      onRefresh();
    } catch {
      showToast("Failed to reorder");
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/quick-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", workspace }),
      });
      if (res.ok) {
        showToast("Reset to defaults");
        onRefresh();
      }
    } catch {
      showToast("Failed to reset");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (action: QuickAction) => {
    setEditingId(action.id);
    setEditLabel(action.label);
    setEditPrompt(action.prompt);
  };

  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Panel: right side on desktop, bottom sheet on mobile */}
      <div
        ref={panelRef}
        className="fixed z-[61] bg-white dark:bg-[#1c1c1e] shadow-2xl transition-transform duration-300 ease-out
          md:right-0 md:top-0 md:bottom-0 md:w-[420px] md:rounded-l-2xl
          inset-x-0 bottom-0 top-[10vh] rounded-t-2xl md:rounded-t-none md:inset-x-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Quick Actions
            </h2>
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: workspaceConfig.color }}
            >
              {workspaceConfig.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: "calc(100% - 130px)" }}>
          {quickActions.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                No quick actions yet. Add one below.
              </p>
            </div>
          )}

          <div className="space-y-1">
            {quickActions.map((action, index) => (
              <div key={action.id}>
                {editingId === action.id ? (
                  /* Edit mode */
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-2 border border-gray-200 dark:border-gray-700">
                    <input
                      ref={labelInputRef}
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Label"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-blue-400 dark:focus:border-blue-500 text-gray-800 dark:text-gray-200 transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(action);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      placeholder="Prompt text"
                      rows={3}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-blue-400 dark:focus:border-blue-500 text-gray-800 dark:text-gray-200 resize-none transition-colors"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(action)}
                        disabled={saving || !editLabel.trim() || !editPrompt.trim()}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display mode */
                  <div
                    className="group flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    {/* Grip handle */}
                    <div className="flex-shrink-0 text-gray-300 dark:text-gray-600">
                      <GripVertical size={14} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {action.label}
                        </p>
                        {action.isDefault && (
                          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded flex-shrink-0">
                            Default
                          </span>
                        )}
                      </div>
                      {action.prompt !== action.label && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                          {action.prompt}
                        </p>
                      )}
                    </div>

                    {/* Action buttons -- always visible on mobile */}
                    <div className="flex items-center gap-0.5 max-md:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {/* Move up */}
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                        title="Move up"
                      >
                        <ArrowUp size={13} />
                      </button>
                      {/* Move down */}
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index >= quickActions.length - 1}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                        title="Move down"
                      >
                        <ArrowDown size={13} />
                      </button>

                      {action.isDefault ? (
                        /* Hide/show for defaults */
                        <button
                          onClick={() => handleHideDefault(action)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title={action.isHidden ? "Show" : "Hide"}
                        >
                          {action.isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                      ) : (
                        <>
                          {/* Edit for custom */}
                          <button
                            onClick={() => startEdit(action)}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="Edit"
                          >
                            <Edit size={13} />
                          </button>
                          {/* Delete for custom */}
                          <button
                            onClick={() => handleDelete(action)}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete"
                          >
                            <Trash size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add new form */}
          {showAddForm ? (
            <div className="mt-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-2 border border-gray-200 dark:border-gray-700">
              <input
                ref={newLabelRef}
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label (e.g. 'Check SEO status')"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-blue-400 dark:focus:border-blue-500 text-gray-800 dark:text-gray-200 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowAddForm(false);
                }}
              />
              <textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="Prompt text that will be sent to the AI..."
                rows={3}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-blue-400 dark:focus:border-blue-500 text-gray-800 dark:text-gray-200 resize-none transition-colors"
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => { setShowAddForm(false); setNewLabel(""); setNewPrompt(""); }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !newLabel.trim() || !newPrompt.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-all"
            >
              <Plus size={14} />
              Add Quick Action
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            <RotateCw size={12} />
            Reset to defaults
          </button>
          <span className="text-[11px] text-gray-300 dark:text-gray-600">
            {quickActions.length} action{quickActions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Toast notification */}
        {toast && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium rounded-full shadow-lg animate-fade-in">
            <Check size={12} />
            {toast}
          </div>
        )}
      </div>
    </>
  );
}
