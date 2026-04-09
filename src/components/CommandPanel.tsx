"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import type { QuickAction, Workspace } from "@/lib/types";
import { getWorkspace, getQuickActions as getDefaultQuickActions } from "@/lib/workspaces";
import { useClickOutside } from "@/lib/hooks";
import { X, Search, Zap, Workflow, BarChart, Settings, ChevronRight } from "./icons";

interface CommandPanelProps {
  show: boolean;
  onClose: () => void;
  workspace: Workspace;
  quickActions: QuickAction[];
  onQuickAction: (prompt: string) => void;
  onOpenQuickActionsManager: () => void;
  onOpenWorkflows: () => void;
  onRunWorkflow?: (workflowId: string) => void;
}

interface WorkflowItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export default function CommandPanel({
  show,
  onClose,
  workspace,
  quickActions,
  onQuickAction,
  onOpenQuickActionsManager,
  onOpenWorkflows,
  onRunWorkflow,
}: CommandPanelProps) {
  const [activeTab, setActiveTab] = useState<"actions" | "workflows" | "reports">("actions");
  const [search, setSearch] = useState("");
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useClickOutside(panelRef, () => { if (show) onClose(); });

  // Fetch workflows
  useEffect(() => {
    if (!show) return;
    fetch("/api/workflows")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: WorkflowItem[]) => setWorkflows(data))
      .catch(() => {});
  }, [show]);

  const workspaceConfig = getWorkspace(workspace);

  // Merge quick actions with defaults as fallback
  const allActions = useMemo(() => {
    if (quickActions.length > 0) return quickActions;
    return getDefaultQuickActions(workspace).map((p, i) => ({
      id: `default-${i}`,
      label: p,
      prompt: p,
      isDefault: true,
      isHidden: false,
      sortOrder: i,
      workspace,
    }));
  }, [quickActions, workspace]);

  // Filter by search
  const filteredActions = useMemo(() => {
    if (!search.trim()) return allActions;
    const q = search.toLowerCase();
    return allActions.filter(
      (a) => a.label.toLowerCase().includes(q) || a.prompt.toLowerCase().includes(q)
    );
  }, [allActions, search]);

  const filteredWorkflows = useMemo(() => {
    if (!search.trim()) return workflows;
    const q = search.toLowerCase();
    return workflows.filter(
      (w) => w.name.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q)
    );
  }, [workflows, search]);

  // Quick report prompts for the current workspace
  const reportPrompts = useMemo(() => {
    switch (workspace) {
      case "website":
        return [
          { label: "Pages overview", prompt: "List all pages with their status" },
          { label: "Draft review", prompt: "Show all draft pages needing review" },
          { label: "Popups overview", prompt: "Show all popups and their status" },
        ];
      case "crm":
        return [
          { label: "Contact overview", prompt: "Show a contact overview report with names, emails, and tags" },
          { label: "Tag breakdown", prompt: "Show a tag breakdown report with all tags and categories" },
          { label: "Revenue report", prompt: "Show a revenue report for the last 30 days with orders and totals" },
          { label: "Pipeline status", prompt: "Show the current pipeline status with opportunities and projected revenue" },
          { label: "Email activity", prompt: "Show email send activity for the last 30 days" },
        ];
      case "lms":
        return [
          { label: "LMS overview", prompt: "Show LMS overview stats" },
          { label: "Course list", prompt: "Show all courses and enrollment counts" },
          { label: "Recent enrollments", prompt: "Show recent enrollments" },
        ];
      case "analytics":
        return [
          { label: "Traffic overview", prompt: "Show a traffic overview report" },
          { label: "Top pages", prompt: "Show the top pages by pageviews" },
          { label: "Traffic sources", prompt: "Show traffic sources report" },
          { label: "High bounce pages", prompt: "Show pages with high bounce rates" },
        ];
      case "all":
      default:
        return [
          { label: "Business overview", prompt: "Show a business overview report" },
          { label: "All pages", prompt: "List all pages and their status" },
          { label: "Newest contacts", prompt: "Show our newest contacts" },
        ];
    }
  }, [workspace]);

  const filteredReports = useMemo(() => {
    if (!search.trim()) return reportPrompts;
    const q = search.toLowerCase();
    return reportPrompts.filter((r) => r.label.toLowerCase().includes(q) || r.prompt.toLowerCase().includes(q));
  }, [reportPrompts, search]);

  if (!show) return null;

  const tabs = [
    { id: "actions" as const, label: "Quick Actions", icon: Zap, count: filteredActions.length },
    { id: "workflows" as const, label: "Workflows", icon: Workflow, count: filteredWorkflows.length },
    { id: "reports" as const, label: "Reports", icon: BarChart, count: filteredReports.length },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[380px] bg-white dark:bg-[#1c1c1e] shadow-2xl z-50 flex flex-col animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Commands
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {workspaceConfig.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#2c2c2e] rounded-xl px-3 py-2.5">
            <Search size={15} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actions, workflows, reports..."
              className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Icon size={13} />
                {tab.label}
                <span className={`text-[10px] ${isActive ? "text-gray-300 dark:text-gray-600" : "text-gray-400"}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Quick Actions tab */}
          {activeTab === "actions" && (
            <div className="flex flex-col gap-1">
              {filteredActions.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No actions found</p>
              )}
              {filteredActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    onQuickAction(action.prompt);
                    onClose();
                  }}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-800 transition-colors group"
                >
                  <Zap size={14} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                      {action.label}
                    </p>
                    {action.prompt !== action.label && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                        {action.prompt}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
              {/* Manage link */}
              <button
                onClick={() => {
                  onOpenQuickActionsManager();
                  onClose();
                }}
                className="flex items-center gap-2 px-3 py-2 mt-2 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <Settings size={12} />
                Manage quick actions
              </button>
            </div>
          )}

          {/* Workflows tab */}
          {activeTab === "workflows" && (
            <div className="flex flex-col gap-1">
              {filteredWorkflows.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No workflows found</p>
              )}
              {filteredWorkflows.map((wf) => (
                <button
                  key={wf.id}
                  onClick={() => {
                    onRunWorkflow?.(wf.id);
                    onClose();
                  }}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-800 transition-colors group"
                >
                  <Workflow size={14} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {wf.name}
                    </p>
                    {wf.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                        {wf.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
              {/* Manage link */}
              <button
                onClick={() => {
                  onOpenWorkflows();
                  onClose();
                }}
                className="flex items-center gap-2 px-3 py-2 mt-2 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <Settings size={12} />
                Manage workflows
              </button>
            </div>
          )}

          {/* Reports tab */}
          {activeTab === "reports" && (
            <div className="flex flex-col gap-1">
              {filteredReports.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No reports found</p>
              )}
              {filteredReports.map((report) => (
                <button
                  key={report.label}
                  onClick={() => {
                    onQuickAction(report.prompt);
                    onClose();
                  }}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-800 transition-colors group"
                >
                  <BarChart size={14} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {report.label}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                      {report.prompt}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
