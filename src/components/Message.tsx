"use client";

import React, { useState } from "react";
import type { ChatMessage, PendingAction, ActionResult } from "@/lib/types";
import { renderMarkdown } from "@/lib/markdown";
import { ThumbsUp, ThumbsDown, Check, X, AlertCircle, Document, ExternalLink, AIBrain, Copy } from "./icons";

interface MessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onConfirmAction?: (action: PendingAction) => void;
  onCancelAction?: (actionId: string) => void;
  onViewPage?: (url: string) => void;
}

export default function Message({
  message,
  isStreaming,
  onConfirmAction,
  onCancelAction,
  onViewPage,
}: MessageProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [showFeedbackTooltip, setShowFeedbackTooltip] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const handleFeedback = (type: "up" | "down") => {
    setFeedback((prev) => (prev === type ? null : type));
    setShowFeedbackTooltip(true);
    setTimeout(() => setShowFeedbackTooltip(false), 2000);
  };

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} max-w-[85%]`}>
        {/* Avatar */}
        {!isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-brand-blue to-blue-600 flex items-center justify-center mt-1 shadow-sm">
            <AIBrain size={18} className="text-white" />
          </div>
        )}

        <div className="flex flex-col gap-1">
          {/* Bubble */}
          <div
            className={
              isUser
                ? "bg-brand-blue text-white px-4 py-2.5 rounded-[20px] rounded-br-[4px] shadow-sm"
                : "bg-white dark:bg-[#2c2c2e] text-gray-800 dark:text-gray-100 px-4 py-2.5 rounded-[20px] rounded-bl-[4px] border border-gray-100 dark:border-gray-700/50 shadow-sm"
            }
          >
            {isUser ? (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div
                className="markdown-body text-[15px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
              />
            )}

            {/* Typing indicator — 3 dots while thinking, nothing once text is streaming */}
            {isStreaming && !isUser && !message.content && (
              <div className="flex items-center gap-1 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>

          {/* Pending action card */}
          {message.pendingAction && !message.actionResult && (
            <ActionCard
              action={message.pendingAction}
              onConfirm={onConfirmAction}
              onCancel={onCancelAction}
            />
          )}

          {/* Action result */}
          {message.actionResult && (
            <ResultCard result={message.actionResult} onViewPage={onViewPage} />
          )}

          {/* Hover controls */}
          <div
            className={`flex items-center gap-2 transition-opacity duration-200 ${
              isHovered ? "opacity-100" : "opacity-0"
            } ${isUser ? "justify-end" : "justify-start"}`}
          >
            {/* C2: Edit button removed from user messages */}
            {!isUser && (
              <div className="relative flex items-center gap-2">
                {/* C1: Copy button */}
                <button
                  onClick={handleCopy}
                  className={`p-1 rounded-md transition-colors ${
                    copied
                      ? "text-emerald-500"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  }`}
                  title={copied ? "Copied!" : "Copy message"}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                {copied && (
                  <span className="absolute -top-7 left-0 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md whitespace-nowrap">
                    Copied!
                  </span>
                )}

                {/* C3: ThumbsUp/ThumbsDown with toggle state */}
                <button
                  onClick={() => handleFeedback("up")}
                  className={`p-1 rounded-md transition-colors ${
                    feedback === "up"
                      ? "text-brand-blue bg-brand-blue/10"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  }`}
                  title="Helpful"
                >
                  <ThumbsUp size={14} />
                </button>
                <button
                  onClick={() => handleFeedback("down")}
                  className={`p-1 rounded-md transition-colors ${
                    feedback === "down"
                      ? "text-red-500 bg-red-500/10"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  }`}
                  title="Not helpful"
                >
                  <ThumbsDown size={14} />
                </button>

                {/* Feedback tooltip */}
                {showFeedbackTooltip && feedback && (
                  <span className="absolute -top-7 left-8 text-[11px] text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md whitespace-nowrap">
                    Thanks for your feedback
                  </span>
                )}
              </div>
            )}
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  action,
  onConfirm,
  onCancel,
}: {
  action: PendingAction;
  onConfirm?: (action: PendingAction) => void;
  onCancel?: (actionId: string) => void;
}) {
  return (
    <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3 border-l-4 border-l-amber-400 animate-slide-up">
      <div className="flex items-start gap-2.5">
        <Document size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">{action.summary}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">{action.type.replace(/_/g, " ")}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onConfirm?.(action)}
          className="px-3.5 py-1.5 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-blue-600 active:scale-[0.97] transition-all duration-200"
        >
          Confirm
        </button>
        <button
          onClick={() => onCancel?.(action.id)}
          className="px-3.5 py-1.5 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 active:scale-[0.97] transition-all duration-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ResultCard({
  result,
  onViewPage,
}: {
  result: ActionResult;
  onViewPage?: (url: string) => void;
}) {
  if (result.success) {
    const pageUrl = (result.result as { link?: string })?.link;
    return (
      <div className="mt-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-xl p-3 border-l-4 border-l-emerald-400 animate-slide-up">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center">
            <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">Action completed</span>
        </div>
        {pageUrl && (
          <button
            onClick={() => onViewPage?.(pageUrl)}
            className="mt-2 flex items-center gap-1.5 text-sm text-brand-blue hover:underline"
          >
            <ExternalLink size={14} />
            View page
          </button>
        )}
      </div>
    );
  }

  // C4: Error card without Retry button, replaced with text suggestion
  return (
    <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-xl p-3 border-l-4 border-l-red-400 animate-slide-up">
      <div className="flex items-center gap-2">
        <AlertCircle size={16} className="text-red-500 dark:text-red-400" />
        <span className="text-sm text-red-700 dark:text-red-300">{result.error || "Something went wrong"}</span>
      </div>
      <p className="mt-2 text-xs text-red-600/70 dark:text-red-400/70">
        Try sending your request again.
      </p>
    </div>
  );
}

export function SystemMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-center py-2 animate-fade-in">
      <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 px-3 py-1 rounded-full">
        {content}
      </span>
    </div>
  );
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}
