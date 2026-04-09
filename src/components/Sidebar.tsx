"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import type { Conversation, Workspace, QuickAction } from "@/lib/types";
import { getWorkspace } from "@/lib/workspaces";
import { notify } from "@/lib/notifications";
import {
  Plus,
  Search,
  X,
  MessageSquare,
  Workflow,
  ChevronRight,
  Activity,
  PanelLeft,
  FolderOpen,
  Settings,
  Zap,
  MoreHorizontal,
  Pin,
  Bug,
} from "./icons";
import ConversationMenu from "./ConversationMenu";
import WorkspaceSelector from "./WorkspaceSelector";
import UserProfile from "./UserProfile";

// ---------------------------------------------------------------------------
// Pinned conversations (localStorage)
// ---------------------------------------------------------------------------
const PINNED_KEY = "zhealth-pinned-conversations";

function getPinnedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function savePinnedIds(ids: Set<string>) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(Array.from(ids)));
}

// ---------------------------------------------------------------------------
// Export conversation as .txt
// ---------------------------------------------------------------------------
function exportConversation(conv: Conversation) {
  const lines: string[] = [];
  lines.push(conv.title || "Untitled Conversation");
  lines.push("=".repeat(50));
  lines.push("");
  for (const msg of conv.messages) {
    const role = msg.role === "user" ? "You" : "Assistant";
    const ts = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : "";
    lines.push(`[${role}] ${ts}`);
    lines.push(msg.content);
    lines.push("");
  }
  const text = lines.join("\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(conv.title || "conversation")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .slice(0, 60)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  notify("success", "Conversation exported");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SidebarProps {
  workspace: Workspace;
  onWorkspaceChange: (ws: Workspace) => void;
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation?: (id: string, title: string) => void;
  onClearConversation?: (id: string) => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  activeJobCount: number;
  onOpenJobs: () => void;
  showSidebar: boolean;
  onCloseSidebar: () => void;
  onOpenWorkflows?: () => void;
  onRunWorkflow?: (workflowId: string) => void;
  onOpenCommands?: () => void;
  onOpenFiles?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  theme?: "light" | "dark" | "auto";
  onThemeChange?: (theme: "light" | "dark" | "auto") => void;
  onOpenQuickActionsManager?: () => void;
  quickActions?: QuickAction[];
  onQuickAction?: (prompt: string) => void;
  onOpenDebug?: () => void;
  hasErrors?: boolean;
}

// ---------------------------------------------------------------------------
// Group conversations by time, with pinned on top
// ---------------------------------------------------------------------------
function groupConversations(
  conversations: Conversation[],
  pinnedIds: Set<string>
) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const week = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Pinned", items: [] },
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 Days", items: [] },
    { label: "Older", items: [] },
  ];

  const sorted = [...conversations].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  for (const conv of sorted) {
    if (pinnedIds.has(conv.id)) {
      groups[0].items.push(conv);
      continue;
    }
    const d = new Date(conv.updatedAt);
    if (d >= today) groups[1].items.push(conv);
    else if (d >= yesterday) groups[2].items.push(conv);
    else if (d >= week) groups[3].items.push(conv);
    else groups[4].items.push(conv);
  }

  return groups.filter((g) => g.items.length > 0);
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
export default function Sidebar({
  workspace,
  onWorkspaceChange,
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onClearConversation,
  onOpenSettings,
  onOpenShortcuts,
  activeJobCount,
  onOpenJobs,
  showSidebar,
  onCloseSidebar,
  onOpenWorkflows,
  onRunWorkflow,
  onOpenCommands,
  onOpenFiles,
  collapsed,
  onToggleCollapse,
  theme,
  onThemeChange,
  onOpenQuickActionsManager,
  quickActions,
  onQuickAction,
  onOpenDebug,
  hasErrors,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [sidebarWorkflows, setSidebarWorkflows] = useState<
    Array<{ id: string; name: string; icon: string }>
  >([]);

  // Context menu state
  const [menuState, setMenuState] = useState<{
    convId: string;
    x: number;
    y: number;
  } | null>(null);

  // Load pinned IDs from localStorage
  useEffect(() => {
    setPinnedIds(getPinnedIds());
  }, []);

  useEffect(() => {
    fetch("/api/workflows")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Array<{ id: string; name: string; icon: string }>) =>
        setSidebarWorkflows(data.slice(0, 4))
      )
      .catch(() => {});
  }, []);

  const togglePin = useCallback((convId: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(convId)) {
        next.delete(convId);
        notify("info", "Conversation unpinned");
      } else {
        next.add(convId);
        notify("success", "Conversation pinned");
      }
      savePinnedIds(next);
      return next;
    });
  }, []);

  const handleOpenMenu = useCallback(
    (convId: string, x: number, y: number) => {
      setMenuState({ convId, x, y });
    },
    []
  );

  const handleCloseMenu = useCallback(() => {
    setMenuState(null);
  }, []);

  // Listen for rename events bubbled up from ConversationItem
  useEffect(() => {
    function handleRenameEvent(e: Event) {
      const ce = e as CustomEvent<{ id: string; title: string }>;
      if (ce.detail && onRenameConversation) {
        onRenameConversation(ce.detail.id, ce.detail.title);
      }
    }
    document.addEventListener("renameConversation", handleRenameEvent);
    return () =>
      document.removeEventListener("renameConversation", handleRenameEvent);
  }, [onRenameConversation]);

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

  const groups = useMemo(
    () => groupConversations(filtered, pinnedIds),
    [filtered, pinnedIds]
  );

  const workspaceConfig = getWorkspace(workspace);

  // Get the conversation for the currently open menu
  const menuConv = menuState
    ? conversations.find((c) => c.id === menuState.convId) || null
    : null;

  return (
    <>
      {/* Mobile overlay backdrop */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={onCloseSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:relative z-50 md:z-auto top-0 left-0 h-full bg-[#1a1b2e] flex flex-col transition-all duration-300 ease-out flex-shrink-0 ${
          collapsed ? "md:w-[60px]" : "md:w-[280px]"
        } ${
          showSidebar
            ? "translate-x-0 w-full sm:w-[320px] md:w-auto"
            : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Header: Logo + collapse toggle */}
        <div
          className={`flex items-center ${
            collapsed ? "justify-center px-2" : "justify-between px-4"
          } pt-4 pb-3 flex-shrink-0`}
        >
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
                  className="w-11 h-11 rounded-lg flex items-center justify-center text-gray-400 hover:bg-white/10 active:bg-white/20 transition-colors md:hidden touch-target"
                >
                  <X size={20} />
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
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] touch-target"
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
                      No conversations yet. Start by asking me to build
                      something.
                    </p>
                  </div>
                )}

                {groups.map((group) => (
                  <div key={group.label} className="mb-3">
                    <div className="px-2 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      {group.label === "Pinned" && (
                        <Pin size={11} className="text-gray-500" />
                      )}
                      {group.label}
                    </div>
                    {group.items.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={conv.id === currentConversationId}
                        isPinned={pinnedIds.has(conv.id)}
                        accentColor={workspaceConfig.color}
                        onSelect={() => {
                          onSelectConversation(conv.id);
                          onCloseSidebar();
                        }}
                        onOpenMenu={handleOpenMenu}
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
                  onOpenSettings={() => {
                    onOpenSettings();
                    onCloseSidebar();
                  }}
                  onOpenShortcuts={() => {
                    onOpenShortcuts();
                    onCloseSidebar();
                  }}
                  theme={theme}
                  onThemeChange={onThemeChange}
                />
              </div>
              <button
                onClick={() => {
                  onOpenCommands?.();
                  onCloseSidebar();
                }}
                className="relative w-11 h-11 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white/10 active:bg-white/20 hover:text-gray-300 transition-colors flex-shrink-0 touch-target"
                title="Commands"
              >
                <Zap size={18} />
              </button>
              <button
                onClick={() => {
                  onOpenFiles?.();
                  onCloseSidebar();
                }}
                className="relative w-11 h-11 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white/10 active:bg-white/20 hover:text-gray-300 transition-colors flex-shrink-0 touch-target"
                title="Files & Reports"
              >
                <FolderOpen size={18} />
              </button>
              <button
                onClick={() => {
                  onOpenDebug?.();
                  onCloseSidebar();
                }}
                className="relative w-11 h-11 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white/10 active:bg-white/20 hover:text-gray-300 transition-colors flex-shrink-0 touch-target"
                title="Error Log (Cmd+D)"
              >
                <Bug size={18} />
                {hasErrors && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-500" />
                )}
              </button>
              <button
                onClick={() => {
                  onOpenJobs();
                  onCloseSidebar();
                }}
                className="relative w-11 h-11 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white/10 active:bg-white/20 hover:text-gray-300 transition-colors flex-shrink-0 touch-target"
                title="Activity"
              >
                <Activity size={18} />
                {activeJobCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center animate-scale-in">
                    {activeJobCount}
                  </span>
                )}
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Context menu (rendered as portal-like fixed position) */}
      {menuState && menuConv && (
        <ConversationMenu
          x={menuState.x}
          y={menuState.y}
          isPinned={pinnedIds.has(menuState.convId)}
          onRename={() => {
            const convId = menuState.convId;
            handleCloseMenu();
            // Trigger inline rename via a custom event on the conversation item
            requestAnimationFrame(() => {
              const el = document.querySelector(
                `[data-conv-id="${convId}"]`
              );
              if (el) {
                el.dispatchEvent(
                  new CustomEvent("startRename", { bubbles: false })
                );
              }
            });
          }}
          onPin={() => {
            togglePin(menuState.convId);
            handleCloseMenu();
          }}
          onExport={() => {
            exportConversation(menuConv);
            handleCloseMenu();
          }}
          onClear={() => {
            const convId = menuState.convId;
            onClearConversation?.(convId);
            handleCloseMenu();
            notify("info", "Messages cleared");
          }}
          onDelete={() => {
            onDeleteConversation(menuState.convId);
            handleCloseMenu();
          }}
          onClose={handleCloseMenu}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ConversationItem
// ---------------------------------------------------------------------------
function ConversationItem({
  conversation,
  isActive,
  isPinned,
  accentColor,
  onSelect,
  onOpenMenu,
}: {
  conversation: Conversation;
  isActive: boolean;
  isPinned: boolean;
  accentColor: string;
  onSelect: () => void;
  onOpenMenu: (convId: string, x: number, y: number) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(conversation.title);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const itemRef = React.useRef<HTMLButtonElement>(null);
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lastMsg = conversation.messages[conversation.messages.length - 1];
  const preview = lastMsg ? lastMsg.content.slice(0, 60) : "";
  const convWorkspace = getWorkspace(conversation.workspace || "all");

  // Focus input when editing starts
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Listen for custom startRename event from the context menu
  React.useEffect(() => {
    const el = itemRef.current;
    if (!el) return;
    function handleStartRename() {
      setEditValue(conversation.title);
      setIsEditing(true);
    }
    el.addEventListener("startRename", handleStartRename);
    return () => el.removeEventListener("startRename", handleStartRename);
  }, [conversation.title]);

  // Long-press handler for mobile context menu
  const handleTouchStart = (e: React.TouchEvent) => {
    longPressTimerRef.current = setTimeout(() => {
      const touch = e.touches[0];
      if (touch) {
        onOpenMenu(conversation.id, touch.clientX, touch.clientY);
      }
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenMenu(conversation.id, e.clientX, e.clientY);
  };

  const handleRenameSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== conversation.title) {
      // Dispatch a rename event that the parent will catch
      const el = itemRef.current;
      if (el) {
        el.dispatchEvent(
          new CustomEvent("renameConversation", {
            detail: { id: conversation.id, title: trimmed },
            bubbles: true,
          })
        );
      }
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

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onOpenMenu(conversation.id, rect.left, rect.bottom + 4);
  };

  return (
    <button
      ref={itemRef}
      data-conv-id={conversation.id}
      onClick={onSelect}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      className={`w-full flex items-start gap-2 px-2.5 py-3 rounded-xl text-left transition-all duration-200 group relative ${
        isActive
          ? "border-l-2 bg-white/[0.08]"
          : "hover:bg-white/[0.04] active:bg-white/[0.06] border-l-2 border-transparent"
      }`}
      style={isActive ? { borderLeftColor: accentColor } : undefined}
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
            {isPinned && (
              <Pin
                size={11}
                className="inline-block mr-1 text-gray-500 -mt-0.5"
              />
            )}
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
        {/* Three-dot menu button */}
        {!isEditing && (
          <button
            onClick={handleMenuClick}
            className={`w-7 h-7 rounded flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/10 active:bg-white/20 transition-colors touch-target ${
              showActions
                ? "opacity-100"
                : "opacity-0 md:opacity-0 max-md:opacity-60"
            }`}
            title="More options"
          >
            <MoreHorizontal size={14} />
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
