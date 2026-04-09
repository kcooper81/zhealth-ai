"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { Workspace } from "@/lib/types";
import { Search, X, Clock, Zap, Globe, Users, BarChart, Activity } from "./icons";
import PanelShell from "./PanelShell";

interface ActivityEntry {
  id: string;
  action_type: string;
  workspace: string | null;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  user_email?: string;
}

type FilterType = "all" | "website" | "crm" | "lms" | "analytics";

const WORKSPACE_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  website: Globe,
  crm: Users,
  lms: Activity,
  analytics: BarChart,
};

const WORKSPACE_COLORS: Record<string, string> = {
  website: "text-blue-500",
  crm: "text-amber-500",
  lms: "text-purple-500",
  analytics: "text-emerald-500",
};

function formatActionType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimeAgo(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

interface ActivityPanelProps {
  show: boolean;
  onClose: () => void;
  workspace: Workspace;
}

export default function ActivityPanel({ show, onClose, workspace }: ActivityPanelProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>(workspace === "all" ? "all" : workspace as FilterType);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const wsParam = filter !== "all" ? `&workspace=${filter}` : "";
      const res = await fetch(`/api/activity?limit=100${wsParam}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(Array.isArray(data) ? data : []);
      }
    } catch {
      // Activity not available
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (show) fetchActivity();
  }, [show, fetchActivity]);

  // Update filter when workspace changes
  useEffect(() => {
    if (workspace !== "all") {
      setFilter(workspace as FilterType);
    }
  }, [workspace]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.action_type.toLowerCase().includes(q) ||
        e.target_type?.toLowerCase().includes(q) ||
        e.target_id?.toLowerCase().includes(q) ||
        e.workspace?.toLowerCase().includes(q) ||
        JSON.stringify(e.details || {}).toLowerCase().includes(q)
    );
  }, [entries, search]);

  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Website", value: "website" },
    { label: "CRM", value: "crm" },
    { label: "LMS", value: "lms" },
    { label: "Analytics", value: "analytics" },
  ];

  return (
    <PanelShell title="Activity" show={show} onClose={onClose} width="w-[380px]">
      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activity..."
            className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="px-4 pb-2">
        <div className="flex gap-1 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                filter === f.value
                  ? "bg-brand-blue text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity list */}
      <div className="px-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-gray-200 dark:border-gray-700 border-t-gray-400 dark:border-t-gray-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Clock size={24} className="text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
              {entries.length === 0 ? "No activity recorded yet." : "No matching activity found."}
            </p>
          </div>
        )}

        {!loading && filtered.map((entry) => {
          const ws = entry.workspace || "all";
          const Icon = WORKSPACE_ICONS[ws] || Zap;
          const iconColor = WORKSPACE_COLORS[ws] || "text-gray-400";

          return (
            <div
              key={entry.id}
              className="flex items-start gap-2.5 px-2 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors mb-0.5"
            >
              <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-gray-50 dark:bg-gray-800 ${iconColor}`}>
                <Icon size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 leading-tight">
                  {formatActionType(entry.action_type)}
                </p>
                {entry.target_type && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                    {entry.target_type}{entry.target_id ? `: ${entry.target_id}` : ""}
                  </p>
                )}
                {entry.details && typeof entry.details === "object" && Object.keys(entry.details).length > 0 && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                    {Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(", ").slice(0, 80)}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5">
                {formatTimeAgo(entry.created_at)}
              </span>
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}
