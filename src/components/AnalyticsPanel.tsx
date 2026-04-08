"use client";

import React from "react";
import { Calendar, BarChart, Globe, Activity, Search, ChevronRight } from "./icons";

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
    prompt: "Show me a traffic overview for the selected date range",
  },
  {
    id: "top-pages",
    label: "Top Pages",
    icon: BarChart,
    prompt: "What are the top performing pages by traffic for the selected date range?",
  },
  {
    id: "bounce-rate",
    label: "Bounce Rate Issues",
    icon: Activity,
    prompt: "Which pages have the highest bounce rates and need attention?",
  },
  {
    id: "search-console",
    label: "Search Console",
    icon: Search,
    prompt: "Show me Search Console data: top queries, impressions, and click-through rates",
  },
];

interface AnalyticsPanelProps {
  onQuickAction: (action: string) => void;
  accentColor: string;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

export default function AnalyticsPanel({
  onQuickAction,
  accentColor,
  dateRange,
  onDateRangeChange,
}: AnalyticsPanelProps) {
  return (
    <div className="flex flex-col h-full">
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

      {/* Quick reports */}
      <div className="px-3 pb-2">
        <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
          Quick Reports
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <div className="space-y-1">
          {QUICK_REPORTS.map((report) => {
            const Icon = report.icon;
            return (
              <button
                key={report.id}
                onClick={() => onQuickAction(report.prompt)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
              >
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ backgroundColor: `${accentColor}12` }}
                >
                  <Icon
                    size={15}
                    className="text-purple-500 transition-colors"
                  />
                </span>
                <span className="flex-1 text-[13px] font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                  {report.label}
                </span>
                <ChevronRight
                  size={13}
                  className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 flex-shrink-0 transition-colors"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
