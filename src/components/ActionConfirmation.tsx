"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { PendingAction } from "@/lib/types";
import { Document, AlertCircle } from "./icons";

interface ActionConfirmationProps {
  action: PendingAction | null;
  onConfirm: (action: PendingAction) => void;
  onCancel: (actionId: string) => void;
}

const TIMEOUT_SECONDS = 30;

export default function ActionConfirmation({
  action,
  onConfirm,
  onCancel,
}: ActionConfirmationProps) {
  const [countdown, setCountdown] = useState(TIMEOUT_SECONDS);

  useEffect(() => {
    if (!action) return;
    setCountdown(TIMEOUT_SECONDS);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onCancel(action.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [action, onCancel]);

  const handleConfirm = useCallback(() => {
    if (action) onConfirm(action);
  }, [action, onConfirm]);

  const handleCancel = useCallback(() => {
    if (action) onCancel(action.id);
  }, [action, onCancel]);

  if (!action) return null;

  const progress = (countdown / TIMEOUT_SECONDS) * 100;

  return (
    <div className="px-4 md:px-8 pb-2">
      <div className="max-w-3xl mx-auto">
        <div className="relative bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 border-l-4 border-l-amber-400 rounded-xl p-3 animate-slide-up overflow-hidden">
          {/* Countdown bar */}
          <div
            className="absolute bottom-0 left-0 h-0.5 bg-amber-400/40 transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />

          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-800/30 flex items-center justify-center">
              {action.type.includes("delete") ? (
                <AlertCircle size={16} className="text-amber-600 dark:text-amber-400" />
              ) : (
                <Document size={16} className="text-amber-600 dark:text-amber-400" />
              )}
            </div>

            {/* Description */}
            <p className="flex-1 text-sm text-gray-700 dark:text-gray-200 font-medium">
              {action.summary}
            </p>

            {/* Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleConfirm}
                className="px-3.5 py-1.5 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-blue-600 active:scale-[0.97] transition-all duration-200"
              >
                Confirm
              </button>
              <button
                onClick={handleCancel}
                className="px-3.5 py-1.5 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 active:scale-[0.97] transition-all duration-200"
              >
                Cancel
              </button>
            </div>

            {/* Countdown ring */}
            <div className="flex-shrink-0 w-6 h-6 relative">
              <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-amber-200 dark:text-amber-800/40"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={`${(progress / 100) * 62.83} 62.83`}
                  className="text-amber-500 transition-all duration-1000 ease-linear"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-amber-600 dark:text-amber-400">
                {countdown}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
