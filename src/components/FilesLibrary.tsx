"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { X, Search, Trash, FileIcon, ImageIcon, FolderOpen, ChevronDown } from "./icons";
import { useClickOutside } from "@/lib/hooks";
import ReportCard from "./ReportCard";
import type { ReportData } from "@/lib/types";

// ---------- Types ----------

interface SavedReport {
  id: string;
  title: string;
  report_type: string;
  report_data: ReportData;
  workspace: string | null;
  created_at: string;
}

interface LibraryFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  preview?: string;
  date: string;
  conversationId: string;
  conversationTitle: string;
  messageId: string;
}

type Tab = "reports" | "files";
type ReportFilter = "all" | "analytics" | "crm" | "lms" | "cross-service";
type FileFilter = "all" | "images" | "documents";
type SortOrder = "newest" | "oldest";

// ---------- Helpers ----------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function getReportTypeBadge(type: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    traffic: { label: "Analytics", color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
    overview: { label: "Analytics", color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
    "top-pages": { label: "Analytics", color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
    sources: { label: "Analytics", color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
    bounce: { label: "Analytics", color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
    contacts: { label: "CRM", color: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
    tags: { label: "CRM", color: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
    revenue: { label: "CRM", color: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
    pipeline: { label: "CRM", color: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
    enrollments: { label: "LMS", color: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
    courses: { label: "LMS", color: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
    "cross-service": { label: "Cross-Service", color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
    "business-overview": { label: "Cross-Service", color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  };
  return map[type] || { label: "General", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" };
}

function getWorkspaceBadge(ws: string | null): { label: string; color: string } | null {
  if (!ws) return null;
  const map: Record<string, { label: string; color: string }> = {
    analytics: { label: "Analytics", color: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" },
    crm: { label: "CRM", color: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" },
    lms: { label: "LMS", color: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" },
    website: { label: "Website", color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400" },
  };
  return map[ws] || null;
}

function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

function reportMatchesFilter(report: SavedReport, filter: ReportFilter): boolean {
  if (filter === "all") return true;
  const badge = getReportTypeBadge(report.report_type);
  return badge.label.toLowerCase().replace("-", "") === filter.replace("-", "");
}

// ---------- Component ----------

interface FilesLibraryProps {
  show: boolean;
  onClose: () => void;
}

export default function FilesLibrary({ show, onClose }: FilesLibraryProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useClickOutside(panelRef, onClose);

  const [tab, setTab] = useState<Tab>("reports");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportFilter, setReportFilter] = useState<ReportFilter>("all");
  const [fileFilter, setFileFilter] = useState<FileFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  // Data
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Fetch data when panel opens
  useEffect(() => {
    if (!show) return;
    fetchReports();
    fetchFiles();
  }, [show]);

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const res = await fetch("/api/reports/saved");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setReports(data);
      }
    } catch {
      // Silently fail
    } finally {
      setReportsLoading(false);
    }
  }, []);

  const fetchFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const res = await fetch("/api/files");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setFiles(data);
      }
    } catch {
      // Silently fail
    } finally {
      setFilesLoading(false);
    }
  }, []);

  const handleDeleteReport = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/reports/saved?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id));
        if (expandedReportId === id) setExpandedReportId(null);
      }
    } catch {
      // Silently fail
    } finally {
      setDeletingId(null);
    }
  }, [expandedReportId]);

  // Filtered + sorted reports
  const filteredReports = useMemo(() => {
    let result = reports.filter((r) => reportMatchesFilter(r, reportFilter));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.report_type.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });
    return result;
  }, [reports, reportFilter, searchQuery, sortOrder]);

  // Filtered files
  const filteredFiles = useMemo(() => {
    let result = [...files];
    if (fileFilter === "images") {
      result = result.filter((f) => isImageType(f.type));
    } else if (fileFilter === "documents") {
      result = result.filter((f) => !isImageType(f.type));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.conversationTitle.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });
    return result;
  }, [files, fileFilter, searchQuery, sortOrder]);

  if (!show) return null;

  const reportFilterOptions: { key: ReportFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "analytics", label: "Analytics" },
    { key: "crm", label: "CRM" },
    { key: "lms", label: "LMS" },
    { key: "cross-service", label: "Cross-Service" },
  ];

  const fileFilterOptions: { key: FileFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "images", label: "Images" },
    { key: "documents", label: "Documents" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/10 backdrop-blur-[2px] z-50" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-full sm:max-w-[400px] bg-white dark:bg-[#1c1c1e] border-l border-gray-200 dark:border-gray-800 z-50 flex flex-col animate-slide-in-right shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <FolderOpen size={18} className="text-gray-500 dark:text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Files & Reports</h2>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors touch-target"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700/50">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tab === "reports" ? "Search reports..." : "Search files..."}
              className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs (segmented control) */}
        <div className="px-5 pb-3 flex-shrink-0">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setTab("reports")}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all duration-200 ${
                tab === "reports"
                  ? "bg-white dark:bg-[#2c2c2e] text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Reports
              {reports.length > 0 && (
                <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {reports.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("files")}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all duration-200 ${
                tab === "files"
                  ? "bg-white dark:bg-[#2c2c2e] text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Files
              {files.length > 0 && (
                <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {files.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter pills + sort */}
        <div className="px-5 pb-3 flex items-center justify-between flex-shrink-0">
          <div className="flex gap-1.5 overflow-x-auto flex-1 min-w-0">
            {(tab === "reports" ? reportFilterOptions : fileFilterOptions).map((opt) => {
              const isActive = tab === "reports" ? reportFilter === opt.key : fileFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => {
                    if (tab === "reports") setReportFilter(opt.key as ReportFilter);
                    else setFileFilter(opt.key as FileFilter);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setSortOrder((p) => (p === "newest" ? "oldest" : "newest"))}
            className="ml-2 flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
            title={sortOrder === "newest" ? "Sorted: Newest first" : "Sorted: Oldest first"}
          >
            <ChevronDown size={12} className={`transition-transform ${sortOrder === "oldest" ? "rotate-180" : ""}`} />
            {sortOrder === "newest" ? "Newest" : "Oldest"}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {tab === "reports" && (
            <>
              {reportsLoading && (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-300 rounded-full animate-spin" />
                </div>
              )}
              {!reportsLoading && filteredReports.length === 0 && (
                <EmptyState
                  icon={<FolderOpen size={24} className="text-gray-300 dark:text-gray-600" />}
                  message={
                    searchQuery
                      ? "No reports match your search."
                      : "No saved reports yet. Generate a report in chat and it will appear here."
                  }
                />
              )}
              <div className="space-y-2">
                {filteredReports.map((report) => (
                  <ReportLibraryCard
                    key={report.id}
                    report={report}
                    expanded={expandedReportId === report.id}
                    onToggle={() => setExpandedReportId((p) => (p === report.id ? null : report.id))}
                    onDelete={() => handleDeleteReport(report.id)}
                    isDeleting={deletingId === report.id}
                  />
                ))}
              </div>
            </>
          )}

          {tab === "files" && (
            <>
              {filesLoading && (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-300 rounded-full animate-spin" />
                </div>
              )}
              {!filesLoading && filteredFiles.length === 0 && (
                <EmptyState
                  icon={<FileIcon size={24} className="text-gray-300 dark:text-gray-600" />}
                  message={
                    searchQuery
                      ? "No files match your search."
                      : "No files uploaded yet. Attach files in chat and they'll appear here."
                  }
                />
              )}
              <div className="space-y-2">
                {filteredFiles.map((file) => (
                  <FileLibraryCard
                    key={`${file.messageId}-${file.id}`}
                    file={file}
                    onViewImage={(url) => setLightboxUrl(url)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Full size preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

// ---------- Report Card ----------

function ReportLibraryCard({
  report,
  expanded,
  onToggle,
  onDelete,
  isDeleting,
}: {
  report: SavedReport;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const badge = getReportTypeBadge(report.report_type);
  const wsBadge = getWorkspaceBadge(report.workspace);

  // Build preview snippet from summary
  const previewSnippet = report.report_data?.summary
    ?.slice(0, 2)
    .map((s) => `${s.label}: ${s.value}`)
    .join("  |  ") || "";

  return (
    <div
      className="bg-white dark:bg-[#2c2c2e] rounded-xl border border-gray-100 dark:border-gray-700/50 overflow-hidden transition-shadow hover:shadow-md"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onToggle}
        className="w-full text-left px-3.5 py-3 flex items-start gap-3"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
            {report.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.color}`}>
              {badge.label}
            </span>
            {wsBadge && (
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${wsBadge.color}`}>
                {wsBadge.label}
              </span>
            )}
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {formatDate(report.created_at)}
            </span>
          </div>
          {!expanded && previewSnippet && (
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1.5 truncate">
              {previewSnippet}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          {(hovered || true) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={isDeleting}
              className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 dark:active:bg-red-900/30 transition-colors disabled:opacity-50 touch-target"
              title="Delete report"
            >
              {isDeleting ? (
                <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              ) : (
                <Trash size={13} />
              )}
            </button>
          )}
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Expanded report view */}
      {expanded && report.report_data && (
        <div className="px-3.5 pb-3 border-t border-gray-100 dark:border-gray-700/50">
          <ReportCard data={report.report_data} />
        </div>
      )}
    </div>
  );
}

// ---------- File Card ----------

function FileLibraryCard({
  file,
  onViewImage,
}: {
  file: LibraryFile;
  onViewImage: (url: string) => void;
}) {
  const isImage = isImageType(file.type);
  const previewSrc = file.preview || file.url;
  const canPreview = isImage && previewSrc;

  return (
    <div className="bg-white dark:bg-[#2c2c2e] rounded-xl border border-gray-100 dark:border-gray-700/50 overflow-hidden transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3 px-3.5 py-3">
        {/* Thumbnail or icon */}
        {canPreview ? (
          <button
            onClick={() => onViewImage(file.url || file.preview || "")}
            className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt={file.name}
              className="w-full h-full object-cover"
            />
          </button>
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
            {isImage ? (
              <ImageIcon size={18} className="text-gray-400 dark:text-gray-500" />
            ) : (
              <FileIcon size={18} className="text-gray-400 dark:text-gray-500" />
            )}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">
            {file.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {formatFileSize(file.size)}
            </span>
            <span className="text-[11px] text-gray-300 dark:text-gray-600">|</span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {formatDate(file.date)}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
            From: {file.conversationTitle}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- Empty State ----------

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-sm text-gray-400 dark:text-gray-500 leading-relaxed max-w-[260px]">
        {message}
      </p>
    </div>
  );
}
