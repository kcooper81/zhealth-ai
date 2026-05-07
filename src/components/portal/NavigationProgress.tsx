"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Top-of-window progress bar that animates while a route transition is in
 * flight. Same UX pattern as Linear / Vercel / GitHub: gives users immediate
 * confirmation that their click registered, even if the next page is slow
 * to server-render.
 *
 * Implementation: we listen for clicks on intra-app <a> links and start
 * the bar; we stop it when the pathname/search params actually change
 * (i.e., navigation completed).
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  // Stop the bar when the URL changes (navigation completed)
  useEffect(() => {
    if (visible) {
      setProgress(100);
      const t = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 250);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search?.toString()]);

  // Listen for any same-origin link click that would trigger client-side nav
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const a = target.closest("a") as HTMLAnchorElement | null;
      if (!a || !a.href) return;
      try {
        const url = new URL(a.href);
        if (url.origin !== location.origin) return;
        // Only if the destination is different from the current
        if (url.pathname === location.pathname && url.search === location.search) return;
        // Skip downloads / new-tab targets
        if (a.target === "_blank" || a.hasAttribute("download")) return;
        setVisible(true);
        setProgress(15);
      } catch {}
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Auto-advance the bar while visible (asymptotic creep toward ~85%)
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= 85) return p; // hold near completion until route resolves
        const remaining = 85 - p;
        return Math.min(85, p + Math.max(1, remaining * 0.08));
      });
    }, 120);
    return () => clearInterval(id);
  }, [visible]);

  if (!visible && progress === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
      <div
        className="h-full bg-gradient-to-r from-brand-blue to-cyan-400 shadow-[0_0_8px_rgba(59,130,246,0.55)] transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}
