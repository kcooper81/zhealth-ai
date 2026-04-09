"use client";

import React, { useState, useEffect } from "react";
import { Calendar, BarChart, Globe, Activity, Search, ChevronRight, Users, AlertCircle } from "./icons";

const DATE_RANGE_PRESETS = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];

const QUICK_REPORTS = [
  {
    id: "traffic",
    label: "Traffic Overview",
    icon: Globe,
    prompt: "Generate a traffic overview report for the last 7 days",
  },
  {
    id: "top-pages",
    label: "Top Pages",
    icon: BarChart,
    prompt: "Show me the top 20 pages by pageviews for the last 7 days as a report",
  },
  {
    id: "bounce-rate",
    label: "Bounce Rate Analysis",
    icon: Activity,
    prompt: "Generate a bounce rate analysis report highlighting pages that need improvement",
  },
  {
    id: "sources",
    label: "Traffic Sources",
    icon: Search,
    prompt: "Generate a traffic sources report showing where our visitors come from for the last 7 days",
  },
];

interface AnalyticsPanelProps {
  onQuickAction: (action: string) => void;
  accentColor: string;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

interface OverviewStats {
  users: number | string;
  sessions: number | string;
  pageviews: number | string;
  bounceRate: number | string;
}

function StatCard({ label, value, icon: Icon, accentColor }: { label: string; value: string | number; icon: React.FC<{ size?: number; className?: string }>; accentColor: string }) {
  return (
    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${accentColor}15` }}
        >
          <Icon size={13} className="text-purple-500" />
        </span>
        <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-[18px] font-semibold text-gray-900 dark:text-gray-100 leading-tight tabular-nums">
        {typeof value === "number" ? value.toLocaleString("en-US") : value}
      </p>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 animate-pulse">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="h-5 w-16 rounded bg-gray-200 dark:bg-gray-700 mt-1" />
    </div>
  );
}

export default function AnalyticsPanel({
  onQuickAction,
  accentColor,
  dateRange,
  onDateRangeChange,
}: AnalyticsPanelProps) {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    setStatsError(null);

    fetch(`/api/analytics?action=overview&range=${encodeURIComponent(dateRange || "7d")}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load analytics");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setStats({
          users: data.users ?? data.totalUsers ?? "--",
          sessions: data.sessions ?? data.totalSessions ?? "--",
          pageviews: data.pageviews ?? data.totalPageviews ?? "--",
          bounceRate: data.bounceRate != null ? `${Number(data.bounceRate).toFixed(1)}%` : "--",
        });
        setStatsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatsError(err.message || "Failed to load analytics");
        setStatsLoading(false);
      });

    return () => { cancelled = true; };
  }, [dateRange]);

  return (
    <div className="flex flex-col h-full">
      {/* Live stats preview */}
      <div className="px-3 pb-3">
        {statsLoading ? (
          <div className="grid grid-cols-2 gap-2">
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </div>
        ) : statsError ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-[12px] text-amber-700 dark:text-amber-300">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>Sign in with Google to see analytics</span>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Users" value={stats.users} icon={Users} accentColor={accentColor} />
            <StatCard label="Sessions" value={stats.sessions} icon={Activity} accentColor={accentColor} />
            <StatCard label="Pageviews" value={stats.pageviews} icon={Globe} accentColor={accentColor} />
            <StatCard label="Bounce Rate" value={stats.bounceRate} icon={BarChart} accentColor={accentColor} />
          </div>
        ) : null}
      </div>

      {/* Date range selector */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Calendar size={13} className="text-gray-400 dark:text-gray-500" />
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Date Range
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {DATE_RANGE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => onDateRangeChange(preset.value)}
              className={`px-2.5 py-1 text-[12px] font-medium rounded-full transition-colors ${
                dateRange === preset.value
                  ? "text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
              style={
                dateRange === preset.value
                  ? { backgroundColor: accentColor }
                  : undefined
              }
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick reports moved to right bar CommandPanel */}
    </div>
  );
}
