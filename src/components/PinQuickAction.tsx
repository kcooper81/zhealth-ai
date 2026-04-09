"use client";

import React, { useState, useRef, useEffect } from "react";
import type { Workspace } from "@/lib/types";
import { WORKSPACES } from "@/lib/workspaces";
import { notify } from "@/lib/notifications";
import { Bookmark, Check, X } from "./icons";

interface PinQuickActionProps {
  messageContent: string;
  workspace: Workspace;
  onClose: () => void;
}

export default function PinQuickAction({
  messageContent,
  workspace,
  onClose,
}: PinQuickActionProps) {
  const [label, setLabel] = useState(
    messageContent.length > 40
      ? messageContent.slice(0, 40) + "..."
      : messageContent
  );
  const [prompt, setPrompt] = useState(messageContent);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace>(workspace);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    labelRef.current?.focus();
    labelRef.current?.select();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSave = async () => {
    if (!label.trim() || !prompt.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/quick-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace: selectedWorkspace,
          label: label.trim(),
          prompt: prompt.trim(),
        }),
      });
      if (res.ok) {
        setSaved(true);
        notify("success", "Quick action saved");
        setTimeout(() => onClose(), 1200);
      }
    } catch {
      notify("error", "Failed to save quick action");
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div
        ref={popoverRef}
        className="absolute bottom-full right-0 mb-2 bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 z-50 animate-fade-in"
        style={{ width: 220 }}
      >
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <Check size={16} />
          <span className="text-sm font-medium">Saved!</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full right-0 mb-2 bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 z-50 animate-fade-in"
      style={{ width: 280 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Bookmark size={14} className="text-gray-500" />
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Save as Quick Action
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      <div className="space-y-2">
        <input
          ref={labelRef}
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label"
          className="w-full px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-blue-400 dark:focus:border-blue-500 text-gray-800 dark:text-gray-200 transition-colors"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") onClose();
          }}
        />

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Prompt"
          rows={2}
          className="w-full px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-blue-400 dark:focus:border-blue-500 text-gray-800 dark:text-gray-200 resize-none transition-colors"
        />

        <select
          value={selectedWorkspace}
          onChange={(e) => setSelectedWorkspace(e.target.value as Workspace)}
          className="w-full px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-blue-400 dark:focus:border-blue-500 text-gray-800 dark:text-gray-200 transition-colors"
        >
          {WORKSPACES.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>

        <button
          onClick={handleSave}
          disabled={saving || !label.trim() || !prompt.trim()}
          className="w-full py-1.5 text-xs font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
