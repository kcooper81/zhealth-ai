"use client";

import { useEffect, useId, useRef, useState, useCallback } from "react";

type Props = {
  chart: string;
  caption?: string;
  className?: string;
};

const APPLE_LIGHT = {
  background: "transparent",
  primaryColor: "#ffffff",
  primaryTextColor: "#0f172a",
  primaryBorderColor: "#e2e8f0",
  lineColor: "#94a3b8",
  secondaryColor: "#f8fafc",
  tertiaryColor: "#f1f5f9",
  edgeLabelBackground: "#ffffff",
  fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
  fontSize: "14px",
};

const APPLE_DARK = {
  background: "transparent",
  primaryColor: "#1f2937",
  primaryTextColor: "#f3f4f6",
  primaryBorderColor: "#374151",
  lineColor: "#6b7280",
  secondaryColor: "#111827",
  tertiaryColor: "#0f172a",
  edgeLabelBackground: "#1c1c1e",
  fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
  fontSize: "14px",
};

const THEME_CSS = `
  .node rect, .node polygon, .node circle, .node ellipse {
    rx: 14;
    ry: 14;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.06)) drop-shadow(0 1px 1px rgba(0,0,0,0.04));
  }
  .node.activeNode rect, .node.activeNode polygon { stroke-width: 1.5px; }
  .edgePath path { stroke-width: 1.5px; }
  .edgeLabel { font-size: 12px; padding: 2px 6px; border-radius: 6px; }
  .label { font-weight: 500; letter-spacing: -0.01em; }

  /* Apple-leaning semantic classes available to flowcharts via classDef */
  .node.appleBlue rect, .node.appleBlue polygon { fill: #eff6ff !important; stroke: #3b82f6 !important; }
  .node.appleBlue .label { color: #1e40af !important; fill: #1e40af !important; }
  .node.appleGreen rect, .node.appleGreen polygon { fill: #ecfdf5 !important; stroke: #10b981 !important; }
  .node.appleGreen .label { color: #065f46 !important; fill: #065f46 !important; }
  .node.appleAmber rect, .node.appleAmber polygon { fill: #fffbeb !important; stroke: #f59e0b !important; }
  .node.appleAmber .label { color: #92400e !important; fill: #92400e !important; }
  .node.appleRose rect, .node.appleRose polygon { fill: #fff1f2 !important; stroke: #f43f5e !important; }
  .node.appleRose .label { color: #9f1239 !important; fill: #9f1239 !important; }
  .node.appleSlate rect, .node.appleSlate polygon { fill: #f8fafc !important; stroke: #94a3b8 !important; stroke-dasharray: 4 3; }
  .node.appleSlate .label { color: #475569 !important; fill: #475569 !important; }
  .node.applePurple rect, .node.applePurple polygon { fill: #f5f3ff !important; stroke: #8b5cf6 !important; }
  .node.applePurple .label { color: #5b21b6 !important; fill: #5b21b6 !important; }
`;

const THEME_CSS_DARK = `
  .node rect, .node polygon, .node circle, .node ellipse {
    rx: 14;
    ry: 14;
    filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4));
  }
  .edgePath path { stroke-width: 1.5px; }
  .edgeLabel { font-size: 12px; padding: 2px 6px; border-radius: 6px; }
  .label { font-weight: 500; letter-spacing: -0.01em; }

  .node.appleBlue rect, .node.appleBlue polygon { fill: rgba(59, 130, 246, 0.15) !important; stroke: #60a5fa !important; }
  .node.appleBlue .label { color: #93c5fd !important; fill: #93c5fd !important; }
  .node.appleGreen rect, .node.appleGreen polygon { fill: rgba(16, 185, 129, 0.15) !important; stroke: #34d399 !important; }
  .node.appleGreen .label { color: #6ee7b7 !important; fill: #6ee7b7 !important; }
  .node.appleAmber rect, .node.appleAmber polygon { fill: rgba(245, 158, 11, 0.15) !important; stroke: #fbbf24 !important; }
  .node.appleAmber .label { color: #fcd34d !important; fill: #fcd34d !important; }
  .node.appleRose rect, .node.appleRose polygon { fill: rgba(244, 63, 94, 0.15) !important; stroke: #fb7185 !important; }
  .node.appleRose .label { color: #fda4af !important; fill: #fda4af !important; }
  .node.appleSlate rect, .node.appleSlate polygon { fill: rgba(148, 163, 184, 0.1) !important; stroke: #64748b !important; stroke-dasharray: 4 3; }
  .node.appleSlate .label { color: #cbd5e1 !important; fill: #cbd5e1 !important; }
  .node.applePurple rect, .node.applePurple polygon { fill: rgba(139, 92, 246, 0.15) !important; stroke: #a78bfa !important; }
  .node.applePurple .label { color: #c4b5fd !important; fill: #c4b5fd !important; }
`;

export default function MermaidDiagram({ chart, caption, className = "" }: Props) {
  const reactId = useId().replace(/:/g, "");
  const inlineRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [svgMarkup, setSvgMarkup] = useState<string>("");

  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "loose",
          fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
          flowchart: { curve: "basis", padding: 20, useMaxWidth: true, htmlLabels: true },
          themeVariables: isDark ? APPLE_DARK : APPLE_LIGHT,
          themeCSS: isDark ? THEME_CSS_DARK : THEME_CSS,
        });
        const { svg } = await mermaid.render(`m-${reactId}`, chart);
        if (!cancelled) {
          setSvgMarkup(svg);
          if (inlineRef.current) inlineRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to render diagram");
        }
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [chart, reactId, isDark]);

  // Sync the fullscreen container's content when it opens
  useEffect(() => {
    if (isFullscreen && fullscreenRef.current && svgMarkup) {
      fullscreenRef.current.innerHTML = svgMarkup;
    }
  }, [isFullscreen, svgMarkup]);

  const closeFullscreen = useCallback(() => setIsFullscreen(false), []);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFullscreen();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isFullscreen, closeFullscreen]);

  return (
    <>
      <figure className={`my-6 ${className}`}>
        <div className="group relative overflow-hidden rounded-2xl border border-gray-200/70 bg-gradient-to-br from-white to-gray-50/50 p-6 shadow-sm ring-1 ring-black/[0.03] dark:border-white/5 dark:from-[#1f1f22] dark:to-[#19191c] dark:ring-white/[0.04]">
          {error ? (
            <pre className="text-xs text-red-600 dark:text-red-400">{error}</pre>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="absolute right-3 top-3 z-10 rounded-lg border border-gray-200/80 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-gray-700 opacity-0 backdrop-blur transition-opacity hover:bg-white group-hover:opacity-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                aria-label="Open diagram fullscreen"
              >
                Expand
              </button>
              <div
                ref={inlineRef}
                className="flex justify-center overflow-x-auto [&>svg]:h-auto [&>svg]:max-w-full"
              />
            </>
          )}
        </div>
        {caption && (
          <figcaption className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
            {caption}
          </figcaption>
        )}
      </figure>

      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-white/95 backdrop-blur-xl dark:bg-[#0f0f10]/95 animate-fade-in"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeFullscreen();
          }}
        >
          <div className="flex items-center justify-between border-b border-gray-200/70 px-6 py-3 dark:border-white/5">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {caption || "Diagram"}
            </span>
            <button
              type="button"
              onClick={closeFullscreen}
              className="rounded-lg border border-gray-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
            >
              Close (Esc)
            </button>
          </div>
          <div
            ref={fullscreenRef}
            className="flex flex-1 items-center justify-center overflow-auto p-8 [&>svg]:h-auto [&>svg]:max-h-full [&>svg]:max-w-full"
          />
        </div>
      )}
    </>
  );
}
