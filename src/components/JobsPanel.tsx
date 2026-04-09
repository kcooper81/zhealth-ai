"use client";

import React, { useState, useRef, useEffect } from "react";
import type { Job } from "@/lib/jobs";
import {
  isJobActive,
  formatRelativeTime,
  getJobDuration,
  getJobIcon,
} from "@/lib/jobs";
import {
  X,
  Check,
  AlertCircle,
  Document,
  Edit,
  BarChart,
  MessageSquare,
  Workflow,
  Zap,
  Loader,
  ExternalLink,
} from "./icons";
import { useClickOutside } from "@/lib/hooks";

// ---------- Icon resolver ----------
const iconMap: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Document,
  Edit,
  BarChart,
  MessageSquare,
  Workflow,
  Zap,
};

function JobIcon({ type, size = 16, className = "" }: { type: string; size?: number; className?: string }) {
  const name = getJobIcon(type);
  const Comp = iconMap[name] || Zap;
  return <Comp size={size} className={className} />;
}

// ---------- Status badge ----------
function StatusBadge({ status }: { status: Job["status"] }) {
  const config: Record<Job["status"], { label: string; cls: string }> = {
    queued: { label: "Queued", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
    running: { label: "Running", cls: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
    streaming: { label: "Streaming", cls: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
    confirming: { label: "Confirming", cls: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
    executing: { label: "Executing", cls: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
    completed: { label: "Completed", cls: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400" },
    failed: { label: "Failed", cls: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
    cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
  };
  const c = config[status];
  const isPulsing = status === "running" || status === "streaming";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${c.cls}`}>
      {isPulsing && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {c.label}
    </span>
  );
}

// ---------- Step circle icon ----------
function StepIcon({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
        <Check size={12} className="text-white" />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 animate-pulse">
        <Loader size={12} className="text-white animate-spin" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
        <X size={12} className="text-white" />
      </span>
    );
  }
  // pending / skipped
  return (
    <span className="w-5 h-5 rounded-full border-2 border-gray-200 dark:border-gray-700 flex-shrink-0" />
  );
}

// ---------- Step list ----------
function StepList({ steps }: { steps: Job["steps"] }) {
  return (
    <div className="ml-1 mt-2 space-y-0">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-start gap-2.5 relative">
          {/* Connector line */}
          {i < steps.length - 1 && (
            <span className="absolute left-[9px] top-5 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
          )}
          <StepIcon status={step.status} />
          <div className="pb-3 min-w-0">
            <p className={`text-sm leading-5 ${
              step.status === "running"
                ? "text-gray-900 dark:text-gray-100 font-medium"
                : step.status === "completed"
                ? "text-gray-600 dark:text-gray-400"
                : step.status === "failed"
                ? "text-red-600 dark:text-red-400"
                : "text-gray-400 dark:text-gray-500"
            }`}>
              {step.label}
            </p>
            {step.detail && (
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">{step.detail}</p>
            )}
            {step.duration != null && step.status === "completed" && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                {step.duration < 1000 ? '<1s' : `${Math.round(step.duration / 1000)}s`}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Job Card (used in Active tab) ----------
function JobCard({ job, onCancel }: { job: Job; onCancel: (id: string) => void }) {
  return (
    <div className="bg-white dark:bg-[#2c2c2e] rounded-xl border border-gray-100 dark:border-gray-800 p-4 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
            <JobIcon type={job.type} size={16} className="text-gray-500 dark:text-gray-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{job.title}</p>
            {job.description && (
              <p className="text-[12px] text-gray-400 dark:text-gray-500 truncate">{job.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={job.status} />
          {isJobActive(job) && (
            <button
              onClick={() => onCancel(job.id)}
              className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Cancel"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      {job.steps.length > 0 && <StepList steps={job.steps} />}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {getJobDuration(job)}
        </span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {job.steps.filter((s) => s.status === "completed").length}/{job.steps.length} steps
        </span>
      </div>
    </div>
  );
}

// ---------- History Item ----------
function HistoryItem({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
          <JobIcon type={job.type} size={14} className="text-gray-400 dark:text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{job.title}</p>
        </div>
        <StatusBadge status={job.status} />
        <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
          {job.completedAt ? formatRelativeTime(job.completedAt) : ""}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 animate-fade-in">
          {job.steps.length > 0 && <StepList steps={job.steps} />}
          {job.result && (
            <div className="mt-2 p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
              {job.result.message && (
                <p className="text-[12px] text-green-700 dark:text-green-400">{job.result.message}</p>
              )}
              {job.result.pageUrl && (
                <a
                  href={job.result.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] text-green-600 dark:text-green-400 hover:underline mt-1"
                >
                  View page <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}
          {job.error && (
            <div className="mt-2 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-start gap-2">
              <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-[12px] text-red-600 dark:text-red-400">{job.error}</p>
            </div>
          )}
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
            Duration: {getJobDuration(job)}
          </p>
        </div>
      )}
    </div>
  );
}

// ========== Active Jobs Bar ==========
export function ActiveJobsBar({
  jobs,
  onOpenPanel,
}: {
  jobs: Job[];
  onOpenPanel: () => void;
}) {
  const active = jobs.filter(isJobActive);
  const [recentlyCompleted, setRecentlyCompleted] = useState<Job[]>([]);

  // Flash completed jobs briefly
  useEffect(() => {
    const completed = jobs.filter(
      (j) => j.status === "completed" && j.completedAt
    );
    const recent = completed.filter((j) => {
      const ago = Date.now() - new Date(j.completedAt!).getTime();
      return ago < 3000;
    });
    setRecentlyCompleted(recent);

    if (recent.length > 0) {
      const timer = setTimeout(() => setRecentlyCompleted([]), 3000);
      return () => clearTimeout(timer);
    }
  }, [jobs]);

  const visible = [...active, ...recentlyCompleted.filter(
    (rc) => !active.find((a) => a.id === rc.id)
  )];

  if (visible.length === 0) return null;

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1c1c1e]/80 animate-slide-up">
      {visible.map((job) => (
        <button
          key={job.id}
          onClick={onOpenPanel}
          className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-gray-100/50 dark:hover:bg-gray-800/30 transition-colors"
        >
          {job.status === "completed" ? (
            <Check size={14} className="text-green-500 flex-shrink-0" />
          ) : (
            <Loader size={14} className="text-brand-blue flex-shrink-0 animate-spin" />
          )}
          <span className="text-[13px] text-gray-600 dark:text-gray-300 truncate flex-1">
            {job.title}
            {job.description ? `: ${job.description}` : ""}
          </span>
          {job.steps.length > 0 && isJobActive(job) && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 tabular-nums">
              {job.steps.filter((s) => s.status === "completed").length}/{job.steps.length}
            </span>
          )}
          {job.status === "completed" && (
            <span className="text-[11px] text-green-500 flex-shrink-0">Done</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ========== Jobs Panel (slide-over) ==========
export function JobsPanel({
  jobs,
  show,
  onClose,
  onCancelJob,
  onClearHistory,
}: {
  jobs: Job[];
  show: boolean;
  onClose: () => void;
  onCancelJob: (id: string) => void;
  onClearHistory: () => void;
}) {
  const [tab, setTab] = useState<"active" | "history">("active");
  const panelRef = useRef<HTMLDivElement>(null);
  useClickOutside(panelRef, onClose);

  const active = jobs.filter(isJobActive);
  const history = jobs.filter((j) => !isJobActive(j));

  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/10 backdrop-blur-[2px] z-50" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-full sm:max-w-md bg-white dark:bg-[#1c1c1e] border-l border-gray-200 dark:border-gray-800 z-50 flex flex-col animate-slide-in-right shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Activity</h2>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors touch-target"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-5">
          <button
            onClick={() => setTab("active")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors touch-target ${
              tab === "active"
                ? "border-brand-blue text-brand-blue"
                : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
          >
            Active
            {active.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                {active.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("history")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors touch-target ${
              tab === "history"
                ? "border-brand-blue text-brand-blue"
                : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
          >
            History
            {history.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {history.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "active" && (
            <div className="p-4 space-y-3">
              {active.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                    <Zap size={20} className="text-gray-300 dark:text-gray-600" />
                  </div>
                  <p className="text-sm text-gray-400 dark:text-gray-500">No active jobs</p>
                  <p className="text-[12px] text-gray-300 dark:text-gray-600 mt-1">
                    Jobs will appear here when the AI is working on something.
                  </p>
                </div>
              )}
              {active.map((job) => (
                <JobCard key={job.id} job={job} onCancel={onCancelJob} />
              ))}
            </div>
          )}

          {tab === "history" && (
            <div>
              {history.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                    <Check size={20} className="text-gray-300 dark:text-gray-600" />
                  </div>
                  <p className="text-sm text-gray-400 dark:text-gray-500">No history yet</p>
                  <p className="text-[12px] text-gray-300 dark:text-gray-600 mt-1">
                    Completed and failed jobs will appear here.
                  </p>
                </div>
              )}
              {history.map((job) => (
                <HistoryItem key={job.id} job={job} />
              ))}
              {history.length > 0 && (
                <div className="px-4 py-3">
                  <button
                    onClick={onClearHistory}
                    className="w-full text-[12px] text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors py-2"
                  >
                    Clear history
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default JobsPanel;
