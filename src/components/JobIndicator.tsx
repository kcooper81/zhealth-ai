"use client";

import React from "react";
import type { Job } from "@/lib/jobs";
import { isJobActive } from "@/lib/jobs";
import { Loader } from "./icons";

interface JobIndicatorProps {
  jobs: Job[];
  onClick: () => void;
}

export default function JobIndicator({ jobs, onClick }: JobIndicatorProps) {
  const active = jobs.filter(isJobActive);

  if (active.length === 0) return null;

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 text-[12px] font-medium animate-fade-in hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
      title="View active jobs"
    >
      <Loader size={12} className="animate-spin" />
      <span>
        {active.length} job{active.length !== 1 ? "s" : ""} running
      </span>
    </button>
  );
}

export function JobBadge({ jobs, onClick }: JobIndicatorProps) {
  const count = jobs.filter(isJobActive).length;
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="relative w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      title="Activity"
    >
      <ActivityIcon size={16} />
      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-brand-blue text-white text-[10px] font-bold flex items-center justify-center animate-scale-in">
        {count}
      </span>
    </button>
  );
}

function ActivityIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
