"use client";

import React from "react";
import { X } from "./icons";

interface PanelShellProps {
  title: string;
  show: boolean;
  onClose: () => void;
  width?: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
}

/**
 * Shared slide-in panel shell for right-side panels.
 * Provides consistent header, close button, backdrop, and animation.
 */
export default function PanelShell({
  title,
  show,
  onClose,
  width = "w-[380px]",
  children,
  headerActions,
}: PanelShellProps) {
  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/10 backdrop-blur-[2px] z-50"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full ${width} bg-white dark:bg-[#1c1c1e] border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 flex flex-col animate-slide-in-right max-w-[90vw]`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {headerActions}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}
