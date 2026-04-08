"use client";

import React, { useRef } from "react";
import type { ChatMessage, PendingAction } from "@/lib/types";
import { useScrollToBottom } from "@/lib/hooks";
import Message, { SystemMessage } from "./Message";
import { MessageSquare } from "./icons";

interface MessageListProps {
  messages: ChatMessage[];
  streamingMessageId: string | null;
  onConfirmAction?: (action: PendingAction) => void;
  onCancelAction?: (actionId: string) => void;
  onViewPage?: (url: string) => void;
}

export default function MessageList({
  messages,
  streamingMessageId,
  onConfirmAction,
  onCancelAction,
  onViewPage,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollToBottom(scrollRef, [messages, messages.length > 0 ? messages[messages.length - 1].content : ""]);

  if (messages.length === 0) {
    return (
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <EmptyState />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
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
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-6">
        <MessageSquare size={28} className="text-gray-300 dark:text-gray-600" />
      </div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
        No messages yet
      </h2>
      <p className="text-sm text-gray-400 dark:text-gray-500 text-center max-w-sm leading-relaxed">
        Start a conversation by asking me to build, edit, or manage your WordPress site.
      </p>
    </div>
  );
}
