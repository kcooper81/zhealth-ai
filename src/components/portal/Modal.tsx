"use client";

import { useEffect, useRef } from "react";
import { X } from "@/components/icons";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Modal max-width, defaults to "3xl" (~768px) */
  size?: "lg" | "xl" | "2xl" | "3xl" | "4xl";
  /** Optional footer slot (action buttons, etc) */
  footer?: React.ReactNode;
};

const SIZES: Record<NonNullable<Props["size"]>, string> = {
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
};

export default function Modal({ open, onClose, title, description, children, size = "3xl", footer }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-12 backdrop-blur-sm"
      onMouseDown={(e) => {
        // Close on backdrop click (not on inner clicks)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className={`w-full ${SIZES[size]} overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-2xl ring-1 ring-black/[0.04] dark:border-white/10 dark:bg-[#1f1f22] dark:ring-white/[0.04]`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-gray-200/70 px-6 py-4 dark:border-white/5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-gray-200/70 bg-gray-50/50 px-6 py-3 dark:border-white/5 dark:bg-white/[0.02]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
