"use client";

import React, { useState, useMemo, useEffect } from "react";
import type { Conversation } from "@/lib/types";
import { Plus, Search, Settings, Keyboard, X, MessageSquare, Workflow, ChevronRight } from "./icons";
import PageSelector from "./PageSelector";

interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  selectedPageId: number | null;
  onSelectPage: (pageId: number | null) => void;
  pages: Array<{
    id: number;
    title: string;
    status: "publish" | "draft" | "pending" | "private" | "trash";
    type: "page" | "post";
    modified?: string;
  }>;
  onQuickAction: (action: string) => void;
  onOpenShortcuts: () => void;
  onOpenSettings: () => void;
  showSidebar: boolean;
  onCloseSidebar: () => void;
  onOpenWorkflows: () => void;
  onRunWorkflow: (workflowId: string) => void;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
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
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  selectedPageId,
  onSelectPage,
  pages,
  onQuickAction,
  onOpenShortcuts,
  onOpenSettings,
  showSidebar,
  onCloseSidebar,
  onOpenWorkflows,
  onRunWorkflow,
  user,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarWorkflows, setSidebarWorkflows] = useState<Array<{ id: string; name: string; icon: string }>>([]);

  useEffect(() => {
    fetch("/api/workflows")
      .then((res) => res.ok ? res.json() : [])
      .then((data: Array<{ id: string; name: string; icon: string }>) => setSidebarWorkflows(data.slice(0, 4)))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  const groups = useMemo(() => groupConversations(filtered), [filtered]);

  const quickActions = [
    "What can I do?",
    "List pages",
    "New page",
    "SEO check",
  ];

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
        className={`fixed md:relative z-50 md:z-auto top-0 left-0 h-full w-[300px] bg-white dark:bg-[#1c1c1e] border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform duration-300 ease-out ${
          showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://zhealtheducation.com/wp-content/uploads/2024/02/logo.svg"
              alt="Z-Health"
              className="h-5 w-auto dark:invert"
            />
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">AI</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onNewConversation}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="New chat"
            >
              <Plus size={18} />
            </button>
            <button
              onClick={onCloseSidebar}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors md:hidden"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Working on — prominent bar at top */}
        <div className="px-3 pb-3">
          <div className="bg-gray-50 dark:bg-[#2c2c2e] rounded-xl p-3">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Working on
            </p>
            <PageSelector
              pages={pages}
              selectedPageId={selectedPageId}
              onSelect={onSelectPage}
              compact
            />
          </div>
        </div>

        {/* Quick actions */}
        <div className="px-3 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((action) => (
              <button
                key={action}
                onClick={() => onQuickAction(action)}
                className="px-2.5 py-1 text-[12px] font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        {/* Workflows section */}
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Workflow size={13} className="text-gray-400 dark:text-gray-500" />
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Workflows
              </p>
            </div>
            <button
              onClick={onOpenWorkflows}
              className="text-[11px] font-medium text-brand-blue hover:text-brand-blue/80 transition-colors"
            >
              View all
            </button>
          </div>
          <div className="space-y-0.5">
            {sidebarWorkflows.map((wf) => (
              <button
                key={wf.id}
                onClick={() => {
                  onRunWorkflow(wf.id);
                  onCloseSidebar();
                }}
                className="flex items-center justify-between w-full px-2.5 py-1.5 text-[12px] font-medium text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200 transition-colors group"
              >
                <span className="truncate">{wf.name}</span>
                <ChevronRight size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 dark:border-gray-800 mx-3" />

        {/* Search conversations */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#2c2c2e] rounded-lg px-3 py-2">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2">
          {groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <MessageSquare size={24} className="text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
                No conversations yet. Start by asking me to build something.
              </p>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.label} className="mb-3">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {group.label}
              </div>
              {group.items.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === currentConversationId}
                  onSelect={() => {
                    onSelectConversation(conv.id);
                    onCloseSidebar();
                  }}
                  onDelete={() => onDeleteConversation(conv.id)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center gap-2 px-3 py-3 border-t border-gray-100 dark:border-gray-800">
          {user && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt=""
                  className="w-7 h-7 rounded-full flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs font-medium flex-shrink-0">
                  {user.name?.charAt(0) || "?"}
                </div>
              )}
              <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                {user.name || user.email || ""}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onOpenSettings}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Settings"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={onOpenShortcuts}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Keyboard shortcuts"
            >
              <Keyboard size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const lastMsg = conversation.messages[conversation.messages.length - 1];
  const preview = lastMsg ? lastMsg.content.slice(0, 60) : "";

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      className={`w-full flex items-start gap-2 px-2.5 py-2.5 rounded-xl text-left transition-all duration-200 group relative ${
        isActive
          ? "bg-brand-blue/[0.08] border-l-2 border-brand-blue"
          : "hover:bg-gray-50 dark:hover:bg-gray-800/50 border-l-2 border-transparent"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${
            isActive
              ? "text-brand-blue"
              : "text-gray-800 dark:text-gray-200"
          }`}
        >
          {conversation.title || "New conversation"}
        </p>
        {preview && (
          <p className="text-[12px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
            {preview}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {formatRelativeTime(conversation.updatedAt)}
        </span>
        {showDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <X size={12} />
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
