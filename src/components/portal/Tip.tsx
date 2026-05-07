"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "@/components/icons";

type Props = {
  /** Plain-language explanation. Shown on hover/tap. */
  text: string;
  /** Optional element to wrap. If omitted, renders just a small ? icon. */
  children?: React.ReactNode;
  /** Side to render the tip on. */
  side?: "top" | "right" | "bottom" | "left";
};

/**
 * Tiny accessible tooltip used to demystify technical terms (utm_campaign,
 * CTR, LCP/INP/CLS, etc) without clogging up the UI. Renders a subtle
 * underline + question-mark on the wrapped term, opens a 240px popover
 * on hover/focus.
 */
export default function Tip({ text, children, side = "top" }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

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

  const sideCls = {
    top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
    right: "left-full top-1/2 ml-2 -translate-y-1/2",
    bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
    left: "right-full top-1/2 mr-2 -translate-y-1/2",
  }[side];

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex items-center gap-1"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children ? (
        <span className="cursor-help underline decoration-dotted decoration-gray-400 underline-offset-2">
          {children}
        </span>
      ) : (
        <button
          type="button"
          aria-label={text}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          onClick={() => setOpen((o) => !o)}
        >
          <HelpCircle size={12} />
        </button>
      )}

      {open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-50 w-60 rounded-lg bg-gray-900 px-3 py-2 text-[11px] font-normal leading-snug text-gray-100 shadow-xl ring-1 ring-white/10 dark:bg-[#22243a] ${sideCls}`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
