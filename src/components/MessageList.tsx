"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import type { ChatMessage, PendingAction, Workspace } from "@/lib/types";
import { useScrollToBottom } from "@/lib/hooks";
import { getQuickActions } from "@/lib/workspaces";
import Message, { SystemMessage } from "./Message";
import { MessageSquare, ChevronDown } from "./icons";

interface MessageListProps {
  messages: ChatMessage[];
  streamingMessageId: string | null;
  onConfirmAction?: (action: PendingAction) => void;
  onCancelAction?: (actionId: string) => void;
  onViewPage?: (url: string) => void;
  workspace?: Workspace;
  onQuickAction?: (action: string) => void;
  isStreaming?: boolean;
  onRegenerate?: () => void;
}

export default function MessageList({
  messages,
  streamingMessageId,
  onConfirmAction,
  onCancelAction,
  onViewPage,
  workspace = "all",
  onQuickAction,
  isStreaming,
  onRegenerate,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  useScrollToBottom(scrollRef, [messages, messages.length > 0 ? messages[messages.length - 1].content : ""]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 80;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  if (messages.length === 0) {
    return (
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <EmptyState workspace={workspace} onQuickAction={onQuickAction} />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 relative">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        {messages.map((msg) => {
          if (msg.role === "user" || msg.role === "assistant") {
            return (
              <Message
                key={msg.id}
                message={msg}
                isStreaming={msg.id === streamingMessageId}
                onConfirmAction={onConfirmAction}
                onCancelAction={onCancelAction}
                onViewPage={onViewPage}
              />
            );
          }
          return <SystemMessage key={msg.id} content={msg.content} />;
        })}
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="sticky bottom-4 left-1/2 -translate-x-1/2 mx-auto block w-9 h-9 rounded-full bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 shadow-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:shadow-xl transition-all duration-200 animate-fade-in z-10"
          aria-label="Scroll to bottom"
        >
          <ChevronDown size={18} />
        </button>
      )}
    </div>
  );
}

const WORKSPACE_EMPTY: Record<Workspace, { heading: string; description: string }> = {
  all: {
    heading: "Z-Health AI Assistant",
    description:
      "I can help manage your WordPress site, CRM, and analytics. What would you like to do?",
  },
  website: {
    heading: "Website Workspace",
    description:
      "I can create pages, edit content, manage SEO, and more. Select a page or ask me to create one.",
  },
  crm: {
    heading: "CRM Workspace",
    description:
      "I can search contacts, manage tags, view your pipeline, and run reports. What do you need?",
  },
  analytics: {
    heading: "Analytics Workspace",
    description:
      "I can pull traffic reports, analyze top pages, and identify performance issues.",
  },
};

function EmptyState({
  workspace,
  onQuickAction,
}: {
  workspace: Workspace;
  onQuickAction?: (action: string) => void;
}) {
  const info = WORKSPACE_EMPTY[workspace] || WORKSPACE_EMPTY.all;
  const quickActions = getQuickActions(workspace);

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-6">
        <MessageSquare size={28} className="text-gray-300 dark:text-gray-600" />
      </div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
        {info.heading}
      </h2>
      <p className="text-sm text-gray-400 dark:text-gray-500 text-center max-w-sm leading-relaxed mb-6">
        {info.description}
      </p>

      {/* Suggestion chips */}
      {quickActions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 max-w-md">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => onQuickAction?.(action)}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200"
            >
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
