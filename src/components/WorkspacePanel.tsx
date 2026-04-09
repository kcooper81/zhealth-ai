"use client";

import React from "react";
import type { Workspace } from "@/lib/types";
import { getWorkspace } from "@/lib/workspaces";
import { X, Loader } from "./icons";
import PageSelector from "./PageSelector";
import CRMPanel from "./CRMPanel";
import AnalyticsPanel from "./AnalyticsPanel";
import LMSPanel from "./LMSPanel";

type SidebarPage = {
  id: number;
  title: string;
  status: "publish" | "draft" | "pending" | "private" | "trash";
  type: "page" | "post";
  modified?: string;
};

interface WorkspacePanelProps {
  workspace: Workspace;
  show: boolean;
  onClose: () => void;
  sidebarCollapsed?: boolean;
  pagesLoading?: boolean;
  // Website
  pages: SidebarPage[];
  selectedPageId: number | null;
  onSelectPage: (id: number | null) => void;
  // CRM
  selectedContactId: number | null;
  onSelectContact: (contact: { id: number; name: string; email: string }) => void;
  // LMS
  selectedCourseId?: number | null;
  onSelectCourse?: (course: { id: number; name: string }) => void;
  // Analytics
  onQuickAction: (action: string) => void;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

export default function WorkspacePanel({
  workspace,
  show,
  onClose,
  sidebarCollapsed,
  pagesLoading,
  pages,
  selectedPageId,
  onSelectPage,
  selectedContactId,
  onSelectContact,
  selectedCourseId,
  onSelectCourse,
  onQuickAction,
  dateRange,
  onDateRangeChange,
}: WorkspacePanelProps) {
  const workspaceConfig = getWorkspace(workspace);

  // Don't render for "all" workspace
  if (workspace === "all") return null;

  return (
    <>
      {/* Mobile overlay backdrop */}
      {show && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`
          fixed md:relative z-40 md:z-auto top-0 ${sidebarCollapsed ? "left-[60px]" : "left-[280px]"} md:left-0 h-full
          bg-white dark:bg-[#242538] border-r border-gray-200 dark:border-gray-700/60
          flex flex-col
          transition-all duration-250 ease-out
          ${show ? "w-[300px] opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-4 overflow-hidden"}
        `}
        style={{ transitionDuration: "250ms" }}
      >
        <div className="w-[300px] h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700/60 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: workspaceConfig.color }}
              />
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {workspaceConfig.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden pt-2">
            {workspace === "website" && (
              pagesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader size={20} className="text-gray-400 animate-spin" />
                </div>
              ) : (
                <PageSelector
                  pages={pages}
                  selectedPageId={selectedPageId}
                  onSelect={onSelectPage}
                  mode="list"
                />
              )
            )}

            {workspace === "crm" && (
              <CRMPanel
                onSelectContact={onSelectContact}
                selectedContactId={selectedContactId}
                accentColor={workspaceConfig.color}
              />
            )}

            {workspace === "lms" && onSelectCourse && (
              <LMSPanel
                onSelectCourse={onSelectCourse}
                selectedCourseId={selectedCourseId || null}
                accentColor={workspaceConfig.color}
                onQuickAction={onQuickAction}
              />
            )}

            {workspace === "analytics" && (
              <AnalyticsPanel
                onQuickAction={onQuickAction}
                accentColor={workspaceConfig.color}
                dateRange={dateRange}
                onDateRangeChange={onDateRangeChange}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
