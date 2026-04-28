"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  chart: string;
  caption?: string;
  className?: string;
};

export default function MermaidDiagram({ chart, caption, className = "" }: Props) {
  const reactId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState<boolean>(false);

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
          theme: isDark ? "dark" : "default",
          securityLevel: "loose",
          fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
          flowchart: { curve: "basis", padding: 16 },
          themeVariables: isDark
            ? { primaryColor: "#1f2937", primaryTextColor: "#f3f4f6", lineColor: "#9ca3af" }
            : { primaryColor: "#ffffff", primaryTextColor: "#111827", lineColor: "#6b7280" },
        });
        const { svg } = await mermaid.render(`m-${reactId}`, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to render diagram";
          setError(msg);
        }
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [chart, reactId, isDark]);

  return (
    <figure className={`my-6 ${className}`}>
      <div
        className="overflow-x-auto rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#202022]"
        aria-label={caption || "Diagram"}
      >
        {error ? (
          <pre className="text-xs text-red-600 dark:text-red-400">{error}</pre>
        ) : (
          <div ref={containerRef} className="flex justify-center [&>svg]:max-w-full [&>svg]:h-auto" />
        )}
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
