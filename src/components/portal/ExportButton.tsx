"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, AlertCircle } from "@/components/icons";

type Format = "pdf" | "png" | "jpg";

type Props = {
  /** DOM id of the element to capture (the report root). */
  targetId: string;
  /** Base filename, no extension. Date is appended automatically. */
  filename: string;
};

const FORMATS: Array<{ id: Format; label: string; ext: string }> = [
  { id: "pdf", label: "PDF", ext: "pdf" },
  { id: "png", label: "PNG image", ext: "png" },
  { id: "jpg", label: "JPG image", ext: "jpg" },
];

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function ExportButton({ targetId, filename }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Format | null>(null);
  const [done, setDone] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const exportAs = async (format: Format) => {
    setBusy(format);
    setError(null);
    setDone(null);
    setOpen(false);
    try {
      const target = document.getElementById(targetId);
      if (!target) throw new Error(`No element with id "${targetId}" to capture`);

      // Dynamic import — keeps these libs out of the base bundle until export is clicked
      const html2canvasModule = await import("html2canvas");
      const html2canvas = html2canvasModule.default;

      const isDark = document.documentElement.classList.contains("dark");
      const canvas = await html2canvas(target, {
        backgroundColor: isDark ? "#1c1c1e" : "#ffffff",
        scale: 2, // 2× pixel density for crisp output
        useCORS: true,
        logging: false,
        windowWidth: target.scrollWidth,
        windowHeight: target.scrollHeight,
      });

      const stamp = todayStamp();
      const fullName = `${filename}-${stamp}`;

      if (format === "png") {
        downloadDataUrl(canvas.toDataURL("image/png"), `${fullName}.png`);
      } else if (format === "jpg") {
        downloadDataUrl(canvas.toDataURL("image/jpeg", 0.92), `${fullName}.jpg`);
      } else if (format === "pdf") {
        const jspdfModule = await import("jspdf");
        const { jsPDF } = jspdfModule;
        const imgData = canvas.toDataURL("image/jpeg", 0.92);

        // Fit to letter portrait, but use canvas aspect to size pages
        const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 24;
        const contentW = pageW - margin * 2;

        // Scale: fit canvas to contentW
        const ratio = canvas.width / contentW;
        const scaledH = canvas.height / ratio;

        // If single page is enough, embed once
        if (scaledH <= pageH - margin * 2) {
          pdf.addImage(imgData, "JPEG", margin, margin, contentW, scaledH);
        } else {
          // Multi-page: slice the canvas in pageH chunks
          const pageContentH = pageH - margin * 2;
          const sourceSliceH = pageContentH * ratio;
          let yOffset = 0;
          let pageIdx = 0;
          while (yOffset < canvas.height) {
            const slice = document.createElement("canvas");
            slice.width = canvas.width;
            slice.height = Math.min(sourceSliceH, canvas.height - yOffset);
            const ctx = slice.getContext("2d");
            if (!ctx) break;
            ctx.drawImage(canvas, 0, yOffset, slice.width, slice.height, 0, 0, slice.width, slice.height);
            const sliceData = slice.toDataURL("image/jpeg", 0.92);
            const sliceScaledH = slice.height / ratio;
            if (pageIdx > 0) pdf.addPage();
            pdf.addImage(sliceData, "JPEG", margin, margin, contentW, sliceScaledH);
            yOffset += sourceSliceH;
            pageIdx += 1;
          }
        }
        pdf.save(`${fullName}.pdf`);
      }

      setDone(format);
      setTimeout(() => setDone(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy !== null}
        className={[
          "inline-flex items-center gap-2 rounded-xl border border-gray-200/80 bg-white/80 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm backdrop-blur transition-colors",
          "hover:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10",
          busy ? "cursor-wait opacity-70" : "",
        ].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy ? (
          <>
            <span className="h-3 w-3 animate-pulse rounded-full bg-brand-blue" />
            <span>Exporting {busy.toUpperCase()}…</span>
          </>
        ) : done ? (
          <>
            <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>Saved {done.toUpperCase()}</span>
          </>
        ) : error ? (
          <>
            <AlertCircle size={14} className="text-rose-600 dark:text-rose-400" />
            <span title={error}>Failed</span>
          </>
        ) : (
          <>
            <span>Export</span>
            <ChevronDown size={14} className="text-gray-500" />
          </>
        )}
      </button>

      {open && !busy && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-44 origin-top-right overflow-hidden rounded-xl border border-gray-200/80 bg-white/95 shadow-xl ring-1 ring-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-[#1f1f22]/95 dark:ring-white/10 animate-fade-in"
        >
          <ul className="py-1">
            {FORMATS.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => exportAs(f.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
                >
                  <span>Save as {f.label}</span>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">.{f.ext}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
