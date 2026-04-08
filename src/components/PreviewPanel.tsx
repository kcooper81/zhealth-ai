"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { X, Refresh, ExternalLink } from "./icons";

interface PreviewPanelProps {
  url: string;
  title?: string;
  show: boolean;
  onClose: () => void;
}

export default function PreviewPanel({ url, title, show, onClose }: PreviewPanelProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [panelWidth, setPanelWidth] = useState(40); // percentage
  const resizeRef = useRef<HTMLDivElement>(null);

  const handleRefresh = useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  const handleOpenExternal = useCallback(() => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, [url]);

  // Resize handling
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const vw = window.innerWidth;
      const newWidth = ((vw - e.clientX) / vw) * 100;
      setPanelWidth(Math.min(Math.max(newWidth, 20), 60));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // On mobile (below md breakpoint), open in new tab instead of showing panel
  useEffect(() => {
    if (show && url && typeof window !== "undefined") {
      const mq = window.matchMedia("(max-width: 767px)");
      if (mq.matches) {
        window.open(url, "_blank", "noopener,noreferrer");
        onClose();
      }
    }
  }, [show, url, onClose]);

  if (!show) return null;

  return (
    <div
      className="relative flex-shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1c1c1e] animate-slide-in-right hidden md:flex flex-col"
      style={{ width: `${panelWidth}%` }}
    >
      {/* Resize handle */}
      <div
        ref={resizeRef}
        onMouseDown={() => setIsResizing(true)}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-blue/20 active:bg-brand-blue/30 transition-colors z-10"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1">
          {title || "Preview"}
        </h3>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={handleRefresh}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Refresh"
          >
            <Refresh size={14} />
          </button>
          <button
            onClick={handleOpenExternal}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={14} />
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Close preview"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Iframe */}
      <div className="flex-1 overflow-hidden">
        {url ? (
          <iframe
            key={iframeKey}
            src={url}
            className="w-full h-full border-0"
            title="Page preview"
            sandbox="allow-same-origin allow-scripts allow-popups"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400 dark:text-gray-500">No page selected</p>
          </div>
        )}
      </div>
    </div>
  );
}
