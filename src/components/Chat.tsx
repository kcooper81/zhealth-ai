"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import type { ChatMessage, Conversation, PendingAction, Workspace, FileAttachment } from "@/lib/types";
import type { Job } from "@/lib/jobs";
import {
  createJob,
  completeJob,
  failJob,
  cancelJob as cancelJobFn,
  updateJobStatus,
  isJobActive,
  trimJobHistory,
} from "@/lib/jobs";
import { useLocalStorage, useKeyboardShortcuts } from "@/lib/hooks";
import Sidebar from "./Sidebar";
import WorkspacePanel from "./WorkspacePanel";
import MessageList from "./MessageList";
import InputArea from "./InputArea";
import PreviewPanel from "./PreviewPanel";
import ActionConfirmation from "./ActionConfirmation";
import Onboarding from "./Onboarding";
import KeyboardShortcuts from "./KeyboardShortcuts";
import WorkflowPanel from "./WorkflowPanel";
import SettingsPanel from "./SettingsPanel";
import { ActiveJobsBar, JobsPanel } from "./JobsPanel";
import JobIndicator from "./JobIndicator";
import { Menu, Loader, Document, X } from "./icons";

type SidebarPage = {
  id: number;
  title: string;
  status: "publish" | "draft" | "pending" | "private" | "trash";
  type: "page" | "post";
  modified?: string;
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function Chat() {
  const { data: session } = useSession();

  // --- State ---
  const [conversations, setConversations] = useLocalStorage<Conversation[]>("zhealth-conversations", []);
  const [currentConversationId, setCurrentConversationId] = useLocalStorage<string | null>("zhealth-current-conv", null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [selectedPageId, setSelectedPageId] = useLocalStorage<number | null>("zhealth-selected-page", null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage("zhealth-sidebar-collapsed", false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showWorkflows, setShowWorkflows] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [initialWorkflowId, setInitialWorkflowId] = useState<string | null>(null);
  const [, setShowOnboarding] = useState(true);
  const [pages, setPages] = useState<SidebarPage[]>([]);
  const [selectedModel, setSelectedModel] = useLocalStorage<string>("zhealth-ai-model", "claude-sonnet-4-6");
  const [workspace, setWorkspace] = useLocalStorage<Workspace>("zhealth-workspace", "all");
  const [hydrated, setHydrated] = useState(false);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [theme, setTheme] = useLocalStorage<"light" | "dark" | "auto">("zhealth-theme", "light");

  // --- Workspace panel state ---
  const [showWorkspacePanel, setShowWorkspacePanel] = useState(() => workspace !== "all");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState("7d");

  // When workspace changes, show/hide workspace panel
  useEffect(() => {
    if (workspace === "all") {
      setShowWorkspacePanel(false);
    } else {
      setShowWorkspacePanel(true);
    }
  }, [workspace]);

  // Hydration flag
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, [theme]);

  // --- Jobs state ---
  const [jobs, setJobs] = useLocalStorage<Job[]>("zhealth-jobs", []);
  const [showJobsPanel, setShowJobsPanel] = useState(false);
  const currentJobRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Trim job history to 50 items on change
  useEffect(() => {
    const trimmed = trimJobHistory(jobs);
    if (trimmed.length !== jobs.length) {
      setJobs(trimmed);
    }
  }, [jobs, setJobs]);

  // Helper to update a specific job
  const updateJob = useCallback(
    (jobId: string, updater: (job: Job) => Job) => {
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? updater(j) : j))
      );
    },
    [setJobs]
  );

  const handleCancelJob = useCallback(
    (jobId: string) => {
      updateJob(jobId, (j) => cancelJobFn(j));
    },
    [updateJob]
  );

  const handleClearJobHistory = useCallback(() => {
    setJobs((prev) => prev.filter(isJobActive));
  }, [setJobs]);

  // Fetch real pages from WordPress on mount
  useEffect(() => {
    async function fetchPages() {
      try {
        const [pagesRes, postsRes] = await Promise.all([
          fetch("/api/pages?per_page=100").then((r) => r.ok ? r.json() : []),
          fetch("/api/posts?per_page=100").then((r) => r.ok ? r.json() : []),
        ]);
        const allPages: SidebarPage[] = [
          ...(Array.isArray(pagesRes) ? pagesRes : []).map((p: any) => ({
            id: p.id,
            title: p.title?.rendered || p.title || "Untitled",
            status: p.status || "publish",
            type: "page" as const,
            modified: p.modified,
          })),
          ...(Array.isArray(postsRes) ? postsRes : []).map((p: any) => ({
            id: p.id,
            title: p.title?.rendered || p.title || "Untitled",
            status: p.status || "publish",
            type: "post" as const,
            modified: p.modified,
          })),
        ];
        setPages(allPages);
      } catch {
        // WordPress not reachable — leave empty
      } finally {
        setPagesLoading(false);
      }
    }
    fetchPages();
  }, []);

  // --- Derived ---
  const currentConversation = useMemo(
    () => conversations.find((c) => c.id === currentConversationId) || null,
    [conversations, currentConversationId]
  );

  const messages = currentConversation?.messages || [];

  // --- Conversation CRUD ---
  const createConversation = useCallback(
    (firstMessage?: string) => {
      const id = generateId();
      const now = new Date().toISOString();
      const autoTitle = (text: string) => {
        const firstSentence = text.split(/[.!?\n]/)[0].trim();
        return firstSentence.length <= 40 ? firstSentence : firstSentence.slice(0, 40).trimEnd() + "...";
      };
      const conv: Conversation = {
        id,
        title: firstMessage ? autoTitle(firstMessage) : "New conversation",
        messages: [],
        pageContextId: selectedPageId ?? undefined,
        workspace,
        createdAt: now,
        updatedAt: now,
      };
      setConversations((prev) => [conv, ...prev]);
      setCurrentConversationId(id);
      return id;
    },
    [selectedPageId, workspace, setConversations, setCurrentConversationId]
  );

  const addMessage = useCallback(
    (convId: string, message: ChatMessage) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [...c.messages, message],
                title:
                  c.messages.length === 0 && message.role === "user"
                    ? (() => { const s = message.content.split(/[.!?\n]/)[0].trim(); return s.length <= 40 ? s : s.slice(0, 40).trimEnd() + "..."; })()
                    : c.title,
                updatedAt: new Date().toISOString(),
              }
            : c
        )
      );
    },
    [setConversations]
  );

  const updateLastAssistantMessage = useCallback(
    (convId: string, content: string) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          const msgs = [...c.messages];
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === "assistant") {
              msgs[i] = { ...msgs[i], content };
              break;
            }
          }
          return { ...c, messages: msgs, updatedAt: new Date().toISOString() };
        })
      );
    },
    [setConversations]
  );

  const renameConversation = useCallback(
    (id: string, newTitle: string) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, title: newTitle, updatedAt: new Date().toISOString() } : c
        )
      );
    },
    [setConversations]
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
    },
    [currentConversationId, setConversations, setCurrentConversationId]
  );

  // --- Message sending (with jobs integration) ---
  const handleSend = useCallback(
    async (text: string, files?: FileAttachment[]) => {
      let convId = currentConversationId;
      if (!convId) {
        convId = createConversation(text);
      }

      // Add user message (store file metadata without base64 data for display)
      const displayFiles = files?.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        size: f.size,
        preview: f.preview,
      }));

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
        files: displayFiles,
      };
      addMessage(convId, userMsg);

      // Create placeholder assistant message
      const assistantId = generateId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };
      addMessage(convId, assistantMsg);
      setIsStreaming(true);
      setStreamingMessageId(assistantId);

      // Stream from the real Claude API (no job for regular chat — only for actions)
      let streamStarted = false;
      try {
        // Build messages array for the API.
        // Read from current state + append the new user message (since setState is async
        // and conversations may not have updated yet).
        const conv = conversations.find((c) => c.id === convId);
        const existingMessages = (conv?.messages || [])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .filter((m) => m.content.trim() !== "")
          .map((m) => ({ role: m.role, content: m.content }));
        const apiMessages = [...existingMessages, { role: "user", content: text }];

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: apiMessages,
            pageContextId: selectedPageId || undefined,
            conversationId: convId,
            model: selectedModel,
            workspace,
            files: files,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "Request failed" }));
          throw new Error(err.error || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            const jsonStr = trimmed.slice(6);
            if (jsonStr === "[DONE]") continue;

            try {
              const data = JSON.parse(jsonStr);

              if (data.type === "token") {
                streamStarted = true;
                accumulated += data.text;
                // Strip <action> blocks from display — only show the plain language part
                const displayText = accumulated.replace(/<action>[\s\S]*?<\/action>/g, "").replace(/<action>[\s\S]*/g, "").trim();
                updateLastAssistantMessage(convId, displayText || "Working on it...");
              } else if (data.type === "done") {
                if (data.message) {
                  updateLastAssistantMessage(convId, data.message);
                }
                if (data.pendingAction) {
                  setPendingAction(data.pendingAction);
                }
              } else if (data.type === "error") {
                throw new Error(data.error || "Stream error");
              }
            } catch (parseErr) {
              // Skip malformed SSE lines
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }

      } catch (err) {
        // Don't show error if user cancelled
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled — just leave the partial response
        } else {
          const errorMsg = err instanceof Error ? err.message : "Something went wrong";
          updateLastAssistantMessage(
            convId,
            `I encountered an error: ${errorMsg}\n\nPlease check that your API keys are configured in the environment variables and try again.`
          );
        }
      } finally {
        setIsStreaming(false);
        setStreamingMessageId(null);
        abortControllerRef.current = null;
        currentJobRef.current = null;
      }
    },
    [currentConversationId, createConversation, addMessage, updateLastAssistantMessage, conversations, selectedPageId, selectedModel, workspace, setJobs, updateJob]
  );

  const handleCancelStream = useCallback(() => {
    // Abort the fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStreamingMessageId(null);
  }, []);

  // --- M1: Regenerate last response ---
  const handleRegenerate = useCallback(() => {
    if (isStreaming || !currentConversationId) return;
    const conv = conversations.find((c) => c.id === currentConversationId);
    if (!conv || conv.messages.length === 0) return;

    // Find the last user message
    let lastUserMessage: string | null = null;
    for (let i = conv.messages.length - 1; i >= 0; i--) {
      if (conv.messages[i].role === "user") {
        lastUserMessage = conv.messages[i].content;
        break;
      }
    }
    if (!lastUserMessage) return;

    // Remove the last assistant message
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConversationId) return c;
        const msgs = [...c.messages];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "assistant") {
            msgs.splice(i, 1);
            break;
          }
        }
        return { ...c, messages: msgs, updatedAt: new Date().toISOString() };
      })
    );

    // Re-send the last user message
    // We need a slight delay so state updates propagate
    setTimeout(() => handleSend(lastUserMessage!), 50);
  }, [isStreaming, currentConversationId, conversations, setConversations, handleSend]);

  // --- L2: Clear conversation ---
  const clearConversation = useCallback(() => {
    if (!currentConversationId) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === currentConversationId
          ? { ...c, messages: [], updatedAt: new Date().toISOString() }
          : c
      )
    );
  }, [currentConversationId, setConversations]);

  // --- L10: Input focus ref and focus management ---
  const inputAreaRef = useRef<HTMLTextAreaElement>(null);

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>("textarea");
      textarea?.focus();
    });
  }, []);

  // Focus input after action confirmation/cancellation
  useEffect(() => {
    if (!pendingAction) {
      focusInput();
    }
  }, [pendingAction, focusInput]);

  // Focus input after settings/workflows close
  useEffect(() => {
    if (!showSettings && !showWorkflows && !showShortcuts) {
      focusInput();
    }
  }, [showSettings, showWorkflows, showShortcuts, focusInput]);

  // --- Actions ---
  const handleConfirmAction = useCallback(
    async (action: PendingAction) => {
      setPendingAction(null);

      if (!currentConversationId) return;

      // Create a job for this action execution
      const job = createJob("action", `Action: ${action.summary}`, [
        { label: "User confirmed", status: "completed" },
        { label: `Executing: ${action.summary}`, status: "running" },
      ]);
      const jobWithStatus = updateJobStatus(job, "executing");
      setJobs((prev) => [jobWithStatus, ...prev]);
      const jobId = jobWithStatus.id;

      // Add a placeholder message showing the action is in progress
      const pendingMsgId = generateId();
      const pendingMsg: ChatMessage = {
        id: pendingMsgId,
        role: "assistant",
        content: `Executing: ${action.summary}...`,
        timestamp: new Date().toISOString(),
      };
      addMessage(currentConversationId, pendingMsg);

      try {
        // POST to the real actions API
        const response = await fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actionId: action.id,
            action,
          }),
        });

        const result = await response.json();

        // Update the placeholder message with the real result
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== currentConversationId) return c;
            const msgs = c.messages.map((m) =>
              m.id === pendingMsgId
                ? {
                    ...m,
                    content: result.success
                      ? "Action completed successfully."
                      : `Action failed: ${result.error || "Unknown error"}`,
                    actionResult: result,
                  }
                : m
            );
            return { ...c, messages: msgs, updatedAt: new Date().toISOString() };
          })
        );

        // Update the job
        if (result.success) {
          const pageUrl = (result.result as { link?: string })?.link;
          updateJob(jobId, (j) =>
            completeJob(j, {
              message: "Action executed successfully",
              pageUrl: pageUrl || undefined,
            })
          );
        } else {
          updateJob(jobId, (j) =>
            failJob(j, result.error || "Action failed")
          );
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Network error";

        // Update the placeholder message with the error
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== currentConversationId) return c;
            const msgs = c.messages.map((m) =>
              m.id === pendingMsgId
                ? {
                    ...m,
                    content: `Action failed: ${errorMessage}`,
                    actionResult: { success: false, error: errorMessage },
                  }
                : m
            );
            return { ...c, messages: msgs, updatedAt: new Date().toISOString() };
          })
        );

        updateJob(jobId, (j) => failJob(j, errorMessage));
      }
    },
    [currentConversationId, addMessage, setConversations, setJobs, updateJob]
  );

  const handleCancelAction = useCallback(
    (_actionId: string) => {
      setPendingAction(null);
      // Cancel any confirming jobs
      const confirmingJobs = jobs.filter((j) => j.status === "confirming");
      if (confirmingJobs.length > 0) {
        updateJob(confirmingJobs[0].id, (j) => cancelJobFn(j));
      }
    },
    [jobs, updateJob]
  );

  // --- Quick actions ---
  const handleQuickAction = useCallback(
    (action: string) => {
      handleSend(action);
    },
    [handleSend]
  );

  // --- Contact selection ---
  const handleSelectContact = useCallback(
    (contact: { id: number; name: string; email: string }) => {
      setSelectedContactId(contact.id === 0 ? null : contact.id);
    },
    []
  );

  // --- Preview ---
  const handleViewPage = useCallback((url: string) => {
    setPreviewUrl(url);
    setShowPreview(true);
  }, []);

  // --- Keyboard shortcuts ---
  const shortcutHandlers = useMemo(
    () => ({
      "mod+n": () => createConversation(),
      "mod+p": () => setShowPreview((v) => !v),
      "mod+b": () => setShowSidebar((v) => !v),
      "mod+j": () => setShowJobsPanel((v) => !v),
      "mod+e": () => {
        if (workspace !== "all") setShowWorkspacePanel((v) => !v);
      },
      "shift+?": () => {
        const active = document.activeElement;
        const isInput = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement;
        if (!isInput) setShowShortcuts(true);
      },
      escape: () => {
        if (showJobsPanel) setShowJobsPanel(false);
        else if (showSettings) setShowSettings(false);
        else if (showWorkflows) setShowWorkflows(false);
        else if (showShortcuts) setShowShortcuts(false);
        else if (showPreview) setShowPreview(false);
        else if (isStreaming) handleCancelStream();
      },
    }),
    [createConversation, workspace, showJobsPanel, showSettings, showWorkflows, showShortcuts, showPreview, isStreaming, handleCancelStream]
  );

  useKeyboardShortcuts(shortcutHandlers);

  if (!hydrated) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-[#1c1c1e]">
        <div className="flex flex-col items-center gap-3">
          <Loader size={24} className="text-gray-400 animate-spin" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-white dark:bg-[#1c1c1e]">
      {/* Left Sidebar - 280px */}
      <Sidebar
        workspace={workspace}
        onWorkspaceChange={(ws) => {
          setWorkspace(ws);
          setCurrentConversationId(null);
          setSelectedPageId(null);
          setSelectedContactId(null);
          setSelectedCourseId(null);
        }}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={setCurrentConversationId}
        onNewConversation={() => createConversation()}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
        onOpenSettings={() => setShowSettings(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
        theme={theme}
        onThemeChange={setTheme}
        activeJobCount={jobs.filter(isJobActive).length}
        onOpenJobs={() => setShowJobsPanel(true)}
        showSidebar={showSidebar}
        onCloseSidebar={() => setShowSidebar(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onOpenWorkflows={() => { setInitialWorkflowId(null); setShowWorkflows(true); }}
        onRunWorkflow={(workflowId: string) => { setInitialWorkflowId(workflowId); setShowWorkflows(true); }}
      />

      {/* Right Panel - 300px (workspace content) */}
      <WorkspacePanel
        workspace={workspace}
        show={showWorkspacePanel}
        onClose={() => setShowWorkspacePanel(false)}
        sidebarCollapsed={sidebarCollapsed}
        pagesLoading={pagesLoading}
        pages={pages}
        selectedPageId={selectedPageId}
        onSelectPage={setSelectedPageId}
        selectedContactId={selectedContactId}
        onSelectContact={handleSelectContact}
        selectedCourseId={selectedCourseId}
        onSelectCourse={(course) => setSelectedCourseId(course.id)}
        onQuickAction={handleQuickAction}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 md:hidden">
          <button
            onClick={() => setShowSidebar(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Menu size={18} />
          </button>
          <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate flex-1">
            {currentConversation?.title || "Z-Health AI"}
          </h1>
          <JobIndicator jobs={jobs} onClick={() => setShowJobsPanel(true)} />
        </div>

        {/* Desktop job indicator (top-right) */}
        <div className="hidden md:flex items-center justify-end px-4 py-2">
          <JobIndicator jobs={jobs} onClick={() => setShowJobsPanel(true)} />
        </div>

        {/* Active jobs bar */}
        <ActiveJobsBar jobs={jobs} onOpenPanel={() => setShowJobsPanel(true)} />

        {/* Page context bar (C7) */}
        {selectedPageId && (() => {
          const selectedPage = pages.find((p) => p.id === selectedPageId);
          if (!selectedPage) return null;
          return (
            <div className="flex items-center gap-2 px-4 h-9 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/40 flex-shrink-0">
              <Document size={14} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />
              <span className="text-xs text-blue-700 dark:text-blue-300 truncate flex-1">
                Working on: {selectedPage.title}
              </span>
              <button
                onClick={() => setSelectedPageId(null)}
                className="p-0.5 rounded text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors flex-shrink-0"
                title="Clear page context"
              >
                <X size={14} />
              </button>
            </div>
          );
        })()}

        {/* Messages */}
        <MessageList
          messages={messages}
          streamingMessageId={streamingMessageId}
          onConfirmAction={handleConfirmAction}
          onCancelAction={handleCancelAction}
          onViewPage={handleViewPage}
          workspace={workspace}
          onQuickAction={handleQuickAction}
          isStreaming={isStreaming}
          onRegenerate={handleRegenerate}
        />

        {/* Thinking indicator (M11) */}
        {isStreaming && streamingMessageId && (() => {
          const streamingMsg = messages.find((m) => m.id === streamingMessageId);
          const noTokensYet = !streamingMsg || streamingMsg.content === "";
          if (!noTokensYet) return null;
          return (
            <div className="px-4 md:px-8 pb-1">
              <div className="max-w-3xl mx-auto flex items-center gap-2 py-1.5">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-bounce [animation-delay:300ms]" />
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">Z-Health AI is thinking...</span>
              </div>
            </div>
          );
        })()}

        {/* Floating action confirmation bar */}
        <ActionConfirmation
          action={pendingAction}
          onConfirm={handleConfirmAction}
          onCancel={handleCancelAction}
        />

        {/* Input */}
        <InputArea
          onSend={(text: string, files?: FileAttachment[]) => handleSend(text, files)}
          isStreaming={isStreaming}
          onCancelStream={handleCancelStream}
          modelName={selectedModel}
        />
      </div>

      {/* Preview panel */}
      <PreviewPanel
        url={previewUrl}
        title={pages.find((p) => p.id === selectedPageId)?.title}
        show={showPreview}
        onClose={() => setShowPreview(false)}
      />

      {/* Jobs panel (slide-over) */}
      <JobsPanel
        jobs={jobs}
        show={showJobsPanel}
        onClose={() => setShowJobsPanel(false)}
        onCancelJob={handleCancelJob}
        onClearHistory={handleClearJobHistory}
      />

      {/* Modals */}
      <SettingsPanel
        show={showSettings}
        onClose={() => setShowSettings(false)}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        theme={theme}
        onThemeChange={setTheme}
      />
      <KeyboardShortcuts show={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <Onboarding onComplete={() => setShowOnboarding(false)} />
      <WorkflowPanel
        show={showWorkflows}
        onClose={() => { setShowWorkflows(false); setInitialWorkflowId(null); }}
        selectedPageId={selectedPageId}
        initialWorkflowId={initialWorkflowId}
      />
    </div>
  );
}
