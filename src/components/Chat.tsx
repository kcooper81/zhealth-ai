"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import type { ChatMessage, Conversation, PendingAction, Workspace } from "@/lib/types";
import type { Job } from "@/lib/jobs";
import {
  createJob,
  advanceJobStep,
  completeJob,
  failJob,
  cancelJob as cancelJobFn,
  updateJobStatus,
  addJobStep,
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
import { Menu } from "./icons";

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
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showWorkflows, setShowWorkflows] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [initialWorkflowId, setInitialWorkflowId] = useState<string | null>(null);
  const [, setShowOnboarding] = useState(true);
  const [pages, setPages] = useState<SidebarPage[]>([]);
  const [selectedModel, setSelectedModel] = useLocalStorage<string>("zhealth-ai-model", "claude-sonnet-4-6");
  const [workspace, setWorkspace] = useLocalStorage<Workspace>("zhealth-workspace", "all");

  // --- Workspace panel state ---
  const [showWorkspacePanel, setShowWorkspacePanel] = useState(() => workspace !== "all");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState("7d");

  // When workspace changes, show/hide workspace panel
  useEffect(() => {
    if (workspace === "all") {
      setShowWorkspacePanel(false);
    } else {
      setShowWorkspacePanel(true);
    }
  }, [workspace]);

  // --- Jobs state ---
  const [jobs, setJobs] = useLocalStorage<Job[]>("zhealth-jobs", []);
  const [showJobsPanel, setShowJobsPanel] = useState(false);
  const currentJobRef = useRef<string | null>(null);

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
      const conv: Conversation = {
        id,
        title: firstMessage ? firstMessage.slice(0, 50) : "New conversation",
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
                    ? message.content.slice(0, 50)
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
    async (text: string) => {
      let convId = currentConversationId;
      if (!convId) {
        convId = createConversation(text);
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
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

      // Create a job to track this request
      const job = createJob("chat", "Processing request...", [
        { label: "Thinking", status: "running" },
        { label: "Generating response", status: "pending" },
      ]);
      job.description = text.slice(0, 80) + (text.length > 80 ? "..." : "");
      currentJobRef.current = job.id;
      setJobs((prev) => [job, ...prev]);

      // Stream from the real Claude API
      let streamStarted = false;
      try {
        // Build messages array for the API (all messages in this conversation)
        const conv = conversations.find((c) => c.id === convId);
        const apiMessages = (conv?.messages || [])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .filter((m) => m.content.trim() !== "")
          .map((m) => ({ role: m.role, content: m.content }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            pageContextId: selectedPageId || undefined,
            conversationId: convId,
            model: selectedModel,
            workspace,
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
                // Advance to "Generating response" step on first token
                if (!streamStarted) {
                  streamStarted = true;
                  updateJob(job.id, (j) => {
                    let updated = advanceJobStep(j, "Analyzed request");
                    updated = updateJobStatus(updated, "streaming");
                    return updated;
                  });
                }
                accumulated += data.text;
                updateLastAssistantMessage(convId, accumulated);
              } else if (data.type === "done") {
                if (data.message) {
                  updateLastAssistantMessage(convId, data.message);
                }
                if (data.pendingAction) {
                  setPendingAction(data.pendingAction);
                  // Add confirming step to job
                  updateJob(job.id, (j) => {
                    let updated = advanceJobStep(j);
                    updated = addJobStep(updated, "Waiting for confirmation", "running");
                    updated = updateJobStatus(updated, "confirming");
                    return updated;
                  });
                } else {
                  // Simple chat response — complete the job
                  updateJob(job.id, (j) =>
                    completeJob(j, { message: "Response generated" })
                  );
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

        // If stream ended without a "done" event, complete the job
        updateJob(job.id, (j) =>
          isJobActive(j) ? completeJob(j, { message: "Response generated" }) : j
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Something went wrong";
        updateLastAssistantMessage(
          convId,
          `I encountered an error: ${errorMsg}\n\nPlease check that your API keys are configured in the environment variables and try again.`
        );
        // Fail the job
        updateJob(job.id, (j) => failJob(j, errorMsg));
      } finally {
        setIsStreaming(false);
        setStreamingMessageId(null);
        currentJobRef.current = null;
      }
    },
    [currentConversationId, createConversation, addMessage, updateLastAssistantMessage, conversations, selectedPageId, selectedModel, workspace, setJobs, updateJob]
  );

  const handleCancelStream = useCallback(() => {
    setIsStreaming(false);
    setStreamingMessageId(null);
    // Cancel the current job
    if (currentJobRef.current) {
      updateJob(currentJobRef.current, (j) => cancelJobFn(j));
      currentJobRef.current = null;
    }
  }, [updateJob]);

  // --- Actions ---
  const handleConfirmAction = useCallback(
    (action: PendingAction) => {
      setPendingAction(null);

      // Update the job to executing
      const activeJobs = jobs.filter((j) => j.status === "confirming");
      if (activeJobs.length > 0) {
        const jobId = activeJobs[0].id;
        updateJob(jobId, (j) => {
          let updated = advanceJobStep(j, "User confirmed");
          updated = addJobStep(updated, `Executing: ${action.summary}`, "running");
          updated = updateJobStatus(updated, "executing");
          return updated;
        });

        // Simulate action completion
        if (currentConversationId) {
          const resultMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: "Action completed successfully.",
            timestamp: new Date().toISOString(),
            actionResult: { success: true, result: { link: previewUrl || "#" } },
          };
          addMessage(currentConversationId, resultMsg);
        }

        // Complete the job
        updateJob(jobId, (j) =>
          completeJob(j, {
            message: "Action executed successfully",
            pageUrl: previewUrl || undefined,
          })
        );
      } else {
        if (currentConversationId) {
          const resultMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: "Action completed successfully.",
            timestamp: new Date().toISOString(),
            actionResult: { success: true, result: { link: previewUrl || "#" } },
          };
          addMessage(currentConversationId, resultMsg);
        }
      }
    },
    [currentConversationId, addMessage, previewUrl, jobs, updateJob]
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

  return (
    <div className="h-screen flex bg-white dark:bg-[#1c1c1e]">
      {/* Left Sidebar - 280px */}
      <Sidebar
        workspace={workspace}
        onWorkspaceChange={setWorkspace}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={setCurrentConversationId}
        onNewConversation={() => createConversation()}
        onDeleteConversation={deleteConversation}
        onOpenSettings={() => setShowSettings(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
        activeJobCount={jobs.filter(isJobActive).length}
        onOpenJobs={() => setShowJobsPanel(true)}
        showSidebar={showSidebar}
        onCloseSidebar={() => setShowSidebar(false)}
        onOpenWorkflows={() => { setInitialWorkflowId(null); setShowWorkflows(true); }}
        onRunWorkflow={(workflowId: string) => { setInitialWorkflowId(workflowId); setShowWorkflows(true); }}
      />

      {/* Right Panel - 300px (workspace content) */}
      <WorkspacePanel
        workspace={workspace}
        show={showWorkspacePanel}
        onClose={() => setShowWorkspacePanel(false)}
        pages={pages}
        selectedPageId={selectedPageId}
        onSelectPage={setSelectedPageId}
        selectedContactId={selectedContactId}
        onSelectContact={handleSelectContact}
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

        {/* Messages */}
        <MessageList
          messages={messages}
          streamingMessageId={streamingMessageId}
          onConfirmAction={handleConfirmAction}
          onCancelAction={handleCancelAction}
          onViewPage={handleViewPage}
        />

        {/* Floating action confirmation bar */}
        <ActionConfirmation
          action={pendingAction}
          onConfirm={handleConfirmAction}
          onCancel={handleCancelAction}
        />

        {/* Input */}
        <InputArea
          onSend={handleSend}
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
