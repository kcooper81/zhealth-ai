"use client";

import React, { useRef } from "react";
import { useClickOutside } from "@/lib/hooks";
import { X } from "./icons";

interface KeyboardShortcutsProps {
  show: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ["Enter"], description: "Send message" },
  { keys: ["Shift", "Enter"], description: "New line" },
  { keys: ["Cmd", "N"], description: "New conversation" },
  { keys: ["Cmd", "P"], description: "Toggle preview panel" },
  { keys: ["Cmd", "B"], description: "Toggle sidebar" },
  { keys: ["Cmd", "J"], description: "Toggle jobs panel" },
  { keys: ["Cmd", "E"], description: "Toggle workspace panel" },
  { keys: ["Esc"], description: "Cancel / Close" },
  { keys: ["?"], description: "Show this help" },
];

export default function KeyboardShortcuts({ show, onClose }: KeyboardShortcutsProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  useClickOutside(cardRef, onClose);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div
        ref={cardRef}
        className="relative bg-white dark:bg-[#2c2c2e] rounded-2xl shadow-2xl max-w-md w-full animate-scale-in overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 transition-colors touch-target"
          >
            <X size={18} />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="px-6 py-4 space-y-1">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.description}
              className="flex items-center justify-between py-2.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0"
            >
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="px-2 py-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 min-w-[28px] text-center"
                  >
                    {key === "Cmd" ? (navigator?.platform?.includes("Mac") ? "\u2318" : "Ctrl") : key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
