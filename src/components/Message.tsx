"use client";

import React, { useState } from "react";
import type { ChatMessage, PendingAction, ActionResult, Workspace } from "@/lib/types";
import { renderMarkdown } from "@/lib/markdown";
import { ThumbsUp, ThumbsDown, Check, AlertCircle, Document, ExternalLink, AIBrain, Copy, Bookmark } from "./icons";
import FilePreview from "./FilePreview";
import ReportCard from "./ReportCard";
import PinQuickAction from "./PinQuickAction";

interface MessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onConfirmAction?: (action: PendingAction) => void;
  onCancelAction?: (actionId: string) => void;
  onViewPage?: (url: string) => void;
  workspace?: Workspace;
  onQuickActionPinned?: () => void;
  conversationId?: string;
}

export default function Message({
  message,
  isStreaming,
  onConfirmAction,
  onCancelAction,
  onViewPage,
  workspace = "all",
  onQuickActionPinned,
  conversationId,
}: MessageProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [showFeedbackTooltip, setShowFeedbackTooltip] = useState(false);
  const [showPinPopover, setShowPinPopover] = useState(false);
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

  const handleFeedback = async (type: "up" | "down") => {
    const newValue = feedback === type ? null : type;
    setFeedback(newValue);
    setShowFeedbackTooltip(true);
    setTimeout(() => setShowFeedbackTooltip(false), 2000);
    if (newValue) {
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: message.id,
            rating: newValue,
            conversationId: conversationId || null,
          }),
        });
      } catch {
        // Feedback logging is best-effort
      }
    }
  };

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in group/msg`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} max-w-[90%] md:max-w-[85%]`}>
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
            {/* File attachments */}
            {message.files && message.files.length > 0 && (
              <FilePreview files={message.files} mode="message" />
            )}

            {isUser ? (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div
                className="markdown-body text-[15px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
              />
            )}

            {/* Report card */}
            {!isUser && message.reportData && (
              <div className="relative">
                <ReportCard data={message.reportData} />
                <div className="flex items-center justify-end mt-1.5 gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20">
                    <Check size={13} />
                    <span>Saved to library</span>
                  </span>
                </div>
              </div>
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

          {/* Executing indicator */}
          {message.actionExecuting && !message.actionResult && (
            <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 rounded-xl p-3 border-l-4 border-l-brand-blue animate-pulse">
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">Executing: {message.actionExecuting}</p>
                </div>
              </div>
            </div>
          )}

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

          {/* Hover controls -- visible on hover (desktop) or on tap (mobile via group/msg) */}
          <div
            className={`flex items-center gap-1 md:gap-2 transition-opacity duration-200 ${
              isHovered ? "opacity-100" : "opacity-0"
            } ${isUser ? "justify-end" : "justify-start"} relative`}
          >
            {/* Pin as quick action (user messages) */}
            {isUser && (
              <div className="relative">
                <button
                  onClick={() => setShowPinPopover((v) => !v)}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                  title="Save as Quick Action"
                >
                  <Bookmark size={14} />
                </button>
                {showPinPopover && (
                  <PinQuickAction
                    messageContent={message.content}
                    workspace={workspace}
                    onClose={() => {
                      setShowPinPopover(false);
                      onQuickActionPinned?.();
                    }}
                  />
                )}
              </div>
            )}
            {/* C2: Edit button removed from user messages */}
            {!isUser && (
              <div className="relative flex items-center gap-2">
                {/* C1: Copy button */}
                <button
                  onClick={handleCopy}
                  className={`p-2 rounded-md transition-colors touch-target ${
                    copied
                      ? "text-emerald-500"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 active:bg-gray-200 dark:active:bg-gray-600/50"
                  }`}
                  title={copied ? "Copied!" : "Copy message"}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
                {copied && (
                  <span className="absolute -top-7 left-0 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md whitespace-nowrap">
                    Copied!
                  </span>
                )}

                {/* C3: ThumbsUp/ThumbsDown with toggle state */}
                <button
                  onClick={() => handleFeedback("up")}
                  className={`p-2 rounded-md transition-colors touch-target ${
                    feedback === "up"
                      ? "text-brand-blue bg-brand-blue/10 dark:bg-blue-900/30"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 active:bg-gray-200 dark:active:bg-gray-600/50"
                  }`}
                  title="Helpful"
                >
                  <ThumbsUp size={16} />
                </button>
                <button
                  onClick={() => handleFeedback("down")}
                  className={`p-2 rounded-md transition-colors touch-target ${
                    feedback === "down"
                      ? "text-red-500 bg-red-500/10 dark:bg-red-900/30"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 active:bg-gray-200 dark:active:bg-gray-600/50"
                  }`}
                  title="Not helpful"
                >
                  <ThumbsDown size={16} />
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
    <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3 border-l-4 border-l-amber-400 dark:border-l-amber-600 animate-slide-up">
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
          className="px-4 py-2 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-blue-600 active:scale-[0.97] transition-all duration-200 touch-target min-h-[44px]"
        >
          Confirm
        </button>
        <button
          onClick={() => onCancel?.(action.id)}
          className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 active:scale-[0.97] transition-all duration-200 touch-target min-h-[44px]"
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
    const r = result.result as { link?: string; status?: string; id?: number; title?: string } | undefined;
    const pageUrl = r?.link;
    const pageStatus = r?.status;
    const pageId = r?.id;
    const pageTitle = r?.title;
    return (
      <div className="mt-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-xl p-3 border-l-4 border-l-emerald-400 animate-slide-up">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center">
            <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">Action completed</span>
          {pageStatus === "draft" && (
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">Draft</span>
          )}
        </div>
        {pageTitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{pageTitle}{pageId ? ` (ID: ${pageId})` : ""}</p>
        )}
        {pageUrl && pageStatus !== "draft" && (
          <button
            onClick={() => onViewPage?.(pageUrl)}
            className="mt-2 flex items-center gap-1.5 text-sm text-brand-blue hover:underline"
          >
            <ExternalLink size={14} />
            View page
          </button>
        )}
        {pageUrl && pageStatus === "draft" && (
          <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
            Draft pages can be previewed in WordPress admin.
          </p>
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
