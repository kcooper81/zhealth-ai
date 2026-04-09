"use client";

import React, { useRef, useCallback } from "react";
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
  type: "page" | "post" | "popup";
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

  // Swipe-down to close on mobile
  const touchStartY = useRef<number>(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 60) onClose(); // Swipe down > 60px to dismiss
  }, [onClose]);

  // Don't render for "all" workspace
  if (workspace === "all") return null;

  return (
    <>
      {/* Mobile overlay backdrop */}
      {show && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel: bottom sheet on mobile, side panel on desktop */}
      <div
        className={`
          md:relative md:z-auto md:top-0 md:left-0 md:h-full
          md:bg-white md:dark:bg-[#242538] md:border-r md:border-gray-200 md:dark:border-gray-700/60
          md:flex md:flex-col
          md:transition-all md:duration-250 md:ease-out
          ${show
            ? "md:w-[300px] md:opacity-100 md:translate-x-0"
            : "md:w-0 md:opacity-0 md:-translate-x-4 md:overflow-hidden hidden md:flex"
          }
          fixed z-40 md:z-auto
          max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:top-auto
          max-md:bg-white max-md:dark:bg-[#242538]
          max-md:rounded-t-2xl max-md:shadow-2xl
          max-md:border-t max-md:border-gray-200 max-md:dark:border-gray-700/60
          max-md:max-h-[70vh]
          ${show ? "max-md:animate-slide-up-sheet" : "max-md:hidden"}
          flex flex-col
        `}
        style={{ transitionDuration: "250ms" }}
      >
        <div className="md:w-[300px] h-full flex flex-col">
          {/* Drag handle (mobile only) — swipe down to dismiss */}
          <div
            className="flex justify-center pt-2 pb-1 md:hidden cursor-grab"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>

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
              className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 hover:text-gray-600 dark:hover:text-gray-300 transition-colors touch-target"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden pt-2">
            {workspace === "website" && (
              pagesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader size={20} className="text-gray-400 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Website stats */}
                  <div className="grid grid-cols-3 gap-2 px-3 pb-2">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-2.5 py-2 text-center">
                      <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Pages</p>
                      <p className="text-[17px] font-semibold text-gray-900 dark:text-gray-100 leading-tight mt-0.5">{pages.filter((p) => p.type === "page").length}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-2.5 py-2 text-center">
                      <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Posts</p>
                      <p className="text-[17px] font-semibold text-gray-900 dark:text-gray-100 leading-tight mt-0.5">{pages.filter((p) => p.type === "post").length}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-2.5 py-2 text-center">
                      <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Drafts</p>
                      <p className="text-[17px] font-semibold text-amber-500 dark:text-amber-400 leading-tight mt-0.5">{pages.filter((p) => p.status === "draft").length}</p>
                    </div>
                  </div>
                  <PageSelector
                    pages={pages}
                    selectedPageId={selectedPageId}
                    onSelect={onSelectPage}
                    mode="list"
                  />
                </>
              )
            )}

            {workspace === "crm" && (
              <CRMPanel
                onSelectContact={onSelectContact}
                selectedContactId={selectedContactId}
                accentColor={workspaceConfig.color}
                onQuickAction={onQuickAction}
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
