"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import type { Conversation, Workspace } from "@/lib/types";
import { getWorkspace } from "@/lib/workspaces";
import {
  Plus,
  Search,
  X,
  MessageSquare,
  Workflow,
  ChevronRight,
  Activity,
  PanelLeft,
  Trash,
} from "./icons";
import WorkspaceSelector from "./WorkspaceSelector";
import UserProfile from "./UserProfile";

interface SidebarProps {
  workspace: Workspace;
  onWorkspaceChange: (ws: Workspace) => void;
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation?: (id: string, title: string) => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  activeJobCount: number;
  onOpenJobs: () => void;
  showSidebar: boolean;
  onCloseSidebar: () => void;
  onOpenWorkflows?: () => void;
  onRunWorkflow?: (workflowId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  theme?: "light" | "dark" | "auto";
  onThemeChange?: (theme: "light" | "dark" | "auto") => void;
}

function groupConversations(conversations: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const week = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 Days", items: [] },
    { label: "Older", items: [] },
  ];

  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  for (const conv of sorted) {
    const d = new Date(conv.updatedAt);
    if (d >= today) groups[0].items.push(conv);
    else if (d >= yesterday) groups[1].items.push(conv);
    else if (d >= week) groups[2].items.push(conv);
    else groups[3].items.push(conv);
  }

  return groups.filter((g) => g.items.length > 0);
}

export default function Sidebar({
  workspace,
  onWorkspaceChange,
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onOpenSettings,
  onOpenShortcuts,
  activeJobCount,
  onOpenJobs,
  showSidebar,
  onCloseSidebar,
  onOpenWorkflows,
  onRunWorkflow,
  collapsed,
  onToggleCollapse,
  theme,
  onThemeChange,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarWorkflows, setSidebarWorkflows] = useState<
    Array<{ id: string; name: string; icon: string }>
  >([]);

  useEffect(() => {
    fetch("/api/workflows")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Array<{ id: string; name: string; icon: string }>) =>
        setSidebarWorkflows(data.slice(0, 4))
      )
      .catch(() => {});
  }, []);

  // Filter conversations to current workspace
  const workspaceConversations = useMemo(() => {
    return conversations.filter((c) => {
      const convWorkspace = c.workspace || "all";
      if (workspace === "all") return true;
      return convWorkspace === workspace;
    });
  }, [conversations, workspace]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return workspaceConversations;
    const q = searchQuery.toLowerCase();
    return workspaceConversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [workspaceConversations, searchQuery]);

  const groups = useMemo(() => groupConversations(filtered), [filtered]);

  const workspaceConfig = getWorkspace(workspace);

  return (
    <>
      {/* Mobile overlay backdrop */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={onCloseSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:relative z-50 md:z-auto top-0 left-0 h-full bg-[#1a1b2e] flex flex-col transition-all duration-300 ease-out flex-shrink-0 ${
          collapsed ? "w-[60px]" : "w-[280px]"
        } ${
          showSidebar
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Header: Logo + collapse toggle */}
        <div className={`flex items-center ${collapsed ? "justify-center px-2" : "justify-between px-4"} pt-4 pb-3 flex-shrink-0`}>
          {collapsed ? (
            <button
              onClick={onToggleCollapse}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Expand sidebar"
            >
              <ChevronRight size={18} />
            </button>
          ) : (
          <>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://zhealtheducation.com/wp-content/uploads/2024/02/logo.svg"
              alt="Z-Health"
              className="h-5 w-auto invert"
            />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              AI
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleCollapse}
              className="w-8 h-8 rounded-lg items-center justify-center text-gray-400 hover:bg-white/10 transition-colors hidden md:flex"
              title="Collapse sidebar"
            >
              <PanelLeft size={16} />
            </button>
            <button
              onClick={onCloseSidebar}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-white/10 transition-colors md:hidden"
            >
              <X size={18} />
            </button>
          </div>
          </>
          )}
        </div>

        {/* Rest of sidebar hidden when collapsed */}
        {collapsed ? (
          <div className="flex-1 flex flex-col items-center gap-2 pt-4">
            <button
              onClick={onNewConversation}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="New chat"
            >
              <Plus size={18} />
            </button>
          </div>
        ) : (
        <>

        {/* Workspace selector */}
        <div className="px-3 pb-3 flex-shrink-0">
          <WorkspaceSelector
            workspace={workspace}
            onWorkspaceChange={onWorkspaceChange}
          />
        </div>

        {/* New Chat button */}
        <div className="px-3 pb-3 flex-shrink-0">
          <button
            onClick={onNewConversation}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: workspaceConfig.color }}
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 mx-3 flex-shrink-0" />

        {/* Conversation list section */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Workflows section */}
          {sidebarWorkflows.length > 0 && onOpenWorkflows && (
            <div className="px-3 pt-3 pb-2 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Workflow size={13} className="text-gray-500" />
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Workflows
                  </p>
                </div>
                <button
                  onClick={onOpenWorkflows}
                  className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View all
                </button>
              </div>
              <div className="space-y-0.5">
                {sidebarWorkflows.map((wf) => (
                  <button
                    key={wf.id}
                    onClick={() => {
                      onRunWorkflow?.(wf.id);
                      onCloseSidebar();
                    }}
                    className="flex items-center justify-between w-full px-2.5 py-1.5 text-[12px] font-medium text-gray-400 rounded-lg hover:bg-white/5 hover:text-gray-200 transition-colors group"
                  >
                    <span className="truncate">{wf.name}</span>
                    <ChevronRight
                      size={12}
                      className="text-gray-600 group-hover:text-gray-500 flex-shrink-0"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search conversations */}
          <div className="px-3 pt-2 pb-2 flex-shrink-0">
            <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
              <Search size={14} className="text-gray-500 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="flex-1 bg-transparent text-sm text-gray-200 placeholder:text-gray-500 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-gray-500 hover:text-gray-300"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto px-2">
            {groups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <MessageSquare
                  size={24}
                  className="text-gray-600 mb-2"
                />
                <p className="text-sm text-gray-500 text-center">
                  No conversations yet. Start by asking me to build something.
                </p>
              </div>
            )}

            {groups.map((group) => (
              <div key={group.label} className="mb-3">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {group.label}
                </div>
                {group.items.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === currentConversationId}
                    accentColor={workspaceConfig.color}
                    onSelect={() => {
                      onSelectConversation(conv.id);
                      onCloseSidebar();
                    }}
                    onDelete={() => onDeleteConversation(conv.id)}
                    onRename={(title: string) => onRenameConversation?.(conv.id, title)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center gap-2 px-3 py-3 border-t border-white/10 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <UserProfile
              onOpenSettings={onOpenSettings}
              onOpenShortcuts={onOpenShortcuts}
              theme={theme}
              onThemeChange={onThemeChange}
            />
          </div>
          <button
            onClick={onOpenJobs}
            className="relative w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors flex-shrink-0"
            title="Activity"
          >
            <Activity size={16} />
            {activeJobCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center animate-scale-in">
                {activeJobCount}
              </span>
            )}
          </button>
        </div>
        </>
        )}
      </aside>
    </>
  );
}

function ConversationItem({
  conversation,
  isActive,
  accentColor,
  onSelect,
  onDelete,
  onRename,
}: {
  conversation: Conversation;
  isActive: boolean;
  accentColor: string;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(conversation.title);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const confirmTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMsg = conversation.messages[conversation.messages.length - 1];
  const preview = lastMsg ? lastMsg.content.slice(0, 60) : "";
  const convWorkspace = getWorkspace(conversation.workspace || "all");

  // Auto-cancel delete confirmation after 5 seconds
  React.useEffect(() => {
    if (confirmingDelete) {
      confirmTimerRef.current = setTimeout(() => {
        setConfirmingDelete(false);
      }, 5000);
    }
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, [confirmingDelete]);

  // Focus input when editing starts
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditValue(conversation.title);
    setIsEditing(true);
  };

  const handleRenameSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEditing(false);
    }
  };

  // Delete confirmation view
  if (confirmingDelete) {
    return (
      <div className="w-full flex items-center gap-2 px-2.5 py-2.5 rounded-xl bg-red-900/20 border border-red-800/30">
        <p className="text-xs text-red-300 flex-1 truncate">Delete this conversation?</p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirmingDelete(false);
            onDelete();
          }}
          className="px-2 py-1 text-[11px] font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
        >
          Delete
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirmingDelete(false);
          }}
          className="px-2 py-1 text-[11px] font-medium text-gray-300 bg-white/10 rounded-md hover:bg-white/15 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={`w-full flex items-start gap-2 px-2.5 py-2.5 rounded-xl text-left transition-all duration-200 group relative ${
        isActive
          ? "border-l-2 bg-white/[0.08]"
          : "hover:bg-white/[0.04] border-l-2 border-transparent"
      }`}
      style={
        isActive
          ? { borderLeftColor: accentColor }
          : undefined
      }
    >
      {/* Workspace color dot */}
      <span
        className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
        style={{ backgroundColor: convWorkspace.color }}
      />
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-sm font-medium text-white bg-white/10 border border-white/20 rounded px-1.5 py-0.5 outline-none focus:border-blue-400 transition-colors"
          />
        ) : (
          <p
            className={`text-sm font-medium truncate ${
              isActive ? "text-white" : "text-gray-300"
            }`}
          >
            {conversation.title || "New conversation"}
          </p>
        )}
        {preview && !isEditing && (
          <p className="text-[12px] text-gray-500 truncate mt-0.5">
            {preview}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-[11px] text-gray-500">
          {formatRelativeTime(conversation.updatedAt)}
        </span>
        {showActions && !isEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirmingDelete(true);
            }}
            className="w-5 h-5 rounded flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
            title="Delete conversation"
          >
            <Trash size={12} />
          </button>
        )}
      </div>
    </button>
  );
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
