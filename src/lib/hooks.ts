"use client";

import { useEffect, useRef, useCallback, useState } from "react";

/**
 * Auto-resize a textarea to fit its content.
 */
export function useAutoResize(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxRows = 6
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 24;
    const maxHeight = lineHeight * maxRows;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [ref, value, maxRows]);
}

/**
 * Auto-scroll a container to the bottom when dependencies change.
 */
export function useScrollToBottom(
  ref: React.RefObject<HTMLElement | null>,
  deps: unknown[]
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Register global keyboard shortcuts.
 *
 * Inside editable targets (input, textarea, contenteditable) we only fire
 * shortcuts that have a Ctrl/Cmd modifier or are Escape. Otherwise plain
 * keystrokes like `?` or `/` get swallowed by preventDefault and the user
 * can't actually type them.
 */
export function useKeyboardShortcuts(
  handlers: Record<string, (e: KeyboardEvent) => void>
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      let key = "";
      if (meta) key += "mod+";
      if (e.shiftKey) key += "shift+";
      key += e.key.toLowerCase();

      if (!handlers[key]) return;

      // If the user is typing in an editable element, only allow modifier
      // shortcuts and Escape through. Plain-key shortcuts (e.g. "shift+?",
      // "/", "j") must not steal characters from the input.
      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isEditable && !meta && e.key !== "Escape") return;

      e.preventDefault();
      handlers[key](e);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}

/**
 * Persistent state via localStorage.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Always start with defaultValue to avoid hydration mismatch.
  // Hydrate from localStorage in useEffect (client-only).
  const [state, setState] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setState(JSON.parse(stored));
      }
    } catch {
      // localStorage unavailable
    }
    setHydrated(true);
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Storage full or unavailable
        }
        return next;
      });
    },
    [key]
  );

  return [state, setValue];
}

/**
 * Detect clicks outside a ref element.
 */
export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handlerRef.current();
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref]);
}
