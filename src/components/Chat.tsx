"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import type { ChatMessage, Conversation, PendingAction, Workspace, FileAttachment, QuickAction } from "@/lib/types";
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
// ActionConfirmation floating bar removed -- inline ActionCard in Message.tsx handles this
import Onboarding from "./Onboarding";
import KeyboardShortcuts from "./KeyboardShortcuts";
import WorkflowPanel from "./WorkflowPanel";
import SettingsPanel from "./SettingsPanel";
import { ActiveJobsBar, JobsPanel } from "./JobsPanel";
import JobIndicator from "./JobIndicator";
import QuickActionsManager from "./QuickActionsManager";
import FilesLibrary from "./FilesLibrary";
import CommandPanel from "./CommandPanel";
import DebugPanel from "./DebugPanel";
import NotificationToast from "./NotificationToast";
import { notify } from "@/lib/notifications";
import { Menu, Loader, Document, X } from "./icons";
import type { ReportData } from "@/lib/types";

type SidebarPage = {
  id: number;
  title: string;
  status: "publish" | "draft" | "pending" | "private" | "trash";
  type: "page" | "post" | "popup";
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
  const [showFilesLibrary, setShowFilesLibrary] = useState(false);
  const [showCommandPanel, setShowCommandPanel] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [hasLogErrors, setHasLogErrors] = useState(false);
  const [initialWorkflowId, setInitialWorkflowId] = useState<string | null>(null);
  const [, setShowOnboarding] = useState(true);
  const [pages, setPages] = useState<SidebarPage[]>([]);
  const [selectedModel, setSelectedModel] = useLocalStorage<string>("zhealth-ai-model", "claude-sonnet-4-6");
  const [workspace, setWorkspace] = useLocalStorage<Workspace>("zhealth-workspace", "all");
  const [hydrated, setHydrated] = useState(false);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [theme, setTheme] = useLocalStorage<"light" | "dark" | "auto">("zhealth-theme", "light");

  // --- Quick actions state ---
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [showQuickActionsManager, setShowQuickActionsManager] = useState(false);

  // --- Workspace panel state ---
  const [showWorkspacePanel, setShowWorkspacePanel] = useState(() => workspace !== "all");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [selectedContactName, setSelectedContactName] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedCourseName, setSelectedCourseName] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("7d");

  // Ref that always has the latest conversations (avoids stale closures in handleSend)
  const conversationsRef = useRef(conversations);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  // When workspace changes, show/hide workspace panel
  useEffect(() => {
    if (workspace === "all") {
      setShowWorkspacePanel(false);
    } else {
      setShowWorkspacePanel(true);
    }
  }, [workspace]);

  // --- Quick actions: fetch from API on mount and workspace change ---
  const fetchQuickActions = useCallback(() => {
    fetch(`/api/quick-actions?workspace=${workspace}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: QuickAction[]) => {
        if (Array.isArray(data)) setQuickActions(data);
      })
      .catch(() => {});
  }, [workspace]);

  useEffect(() => {
    fetchQuickActions();
  }, [fetchQuickActions]);

  // Track whether DB sync has completed
  const dbSyncedRef = useRef(false);

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

  // --- Poll for error log entries (for sidebar badge) ---
  useEffect(() => {
    let mounted = true;
    async function checkErrors() {
      try {
        const res = await fetch("/api/logs");
        if (res.ok && mounted) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setHasLogErrors(data.some((l: { level: string }) => l.level === "error"));
          }
        }
      } catch { /* ignore */ }
    }
    checkErrors();
    const interval = setInterval(checkErrors, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // --- Client-side error logging helper ---
  const logClientError = useCallback((source: string, message: string, details?: unknown) => {
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "error", source, message, details }),
    }).catch(() => {});
  }, []);

  // --- Database sync: load conversations from Supabase on mount ---
  useEffect(() => {
    if (dbSyncedRef.current) return;
    dbSyncedRef.current = true;

    async function syncConversations() {
      try {
        const res = await fetch("/api/conversations");
        if (!res.ok) return;
        const dbConversations = await res.json();
        if (!Array.isArray(dbConversations) || dbConversations.length === 0) return;

        // Replace localStorage conversations with database truth
        setConversations(dbConversations);
      } catch {
        // Database not reachable — keep localStorage data
      }
    }
    syncConversations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Database sync: load preferences from Supabase on mount ---
  useEffect(() => {
    async function syncPreferences() {
      try {
        const res = await fetch("/api/preferences");
        if (!res.ok) return;
        const prefs = await res.json();
        if (prefs.source !== "database") return;

        // Apply database preferences over localStorage cache
        if (prefs.selectedModel) setSelectedModel(prefs.selectedModel);
        if (prefs.workspace) setWorkspace(prefs.workspace as Workspace);
        if (prefs.theme) setTheme(prefs.theme as "light" | "dark" | "auto");
        if (prefs.sidebarCollapsed !== undefined) setSidebarCollapsed(prefs.sidebarCollapsed);
      } catch {
        // Database not reachable — keep localStorage values
      }
    }
    syncPreferences();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Helper: persist a preference change to the database (fire-and-forget) ---
  const persistPreference = useCallback(
    (data: Record<string, any>) => {
      fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).catch(() => {});
    },
    []
  );

  // --- Persist preference changes to database (debounced via useEffect) ---
  const prefsInitRef = useRef(false);
  useEffect(() => {
    // Skip the initial render (values come from localStorage/DB sync, not user action)
    if (!prefsInitRef.current) { prefsInitRef.current = true; return; }
    persistPreference({ selectedModel });
  }, [selectedModel]); // eslint-disable-line react-hooks/exhaustive-deps

  const wsInitRef = useRef(false);
  useEffect(() => {
    if (!wsInitRef.current) { wsInitRef.current = true; return; }
    persistPreference({ workspace });
  }, [workspace]); // eslint-disable-line react-hooks/exhaustive-deps

  const themeInitRef = useRef(false);
  useEffect(() => {
    if (!themeInitRef.current) { themeInitRef.current = true; return; }
    persistPreference({ theme });
  }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const sidebarInitRef = useRef(false);
  useEffect(() => {
    if (!sidebarInitRef.current) { sidebarInitRef.current = true; return; }
    persistPreference({ sidebarCollapsed });
  }, [sidebarCollapsed]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- ID mapping for local-to-DB conversation IDs ---
  const idMapRef = useRef<Record<string, string>>({});

  // --- Helper: persist conversation to database (fire-and-forget) ---
  const persistConversationToDb = useCallback(
    (convId: string, data: { title?: string; messages?: ChatMessage[] }) => {
      // Resolve the actual DB ID (may differ from local ID if DB assigned a UUID)
      const dbId = idMapRef.current[convId] || convId;
      // Only persist if we have a DB-mapped ID (conversation was created server-side)
      // Local-only IDs (timestamp-based) haven't been created in DB yet
      if (!idMapRef.current[convId] && convId.match(/^\d+-/)) return;
      fetch(`/api/conversations/${dbId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).catch(() => {});
    },
    []
  );

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

  // Fetch pages from WordPress — extracted so we can call after actions
  const refreshPages = useCallback(async () => {
    try {
      const [pagesRes, postsRes, popupsRes] = await Promise.all([
        fetch("/api/pages?per_page=100&status=publish,draft,pending,private").then((r) => r.ok ? r.json() : []),
        fetch("/api/posts?per_page=100&status=publish,draft,pending,private").then((r) => r.ok ? r.json() : []),
        fetch("/api/popups?per_page=100&status=publish,draft,pending,private").then((r) => r.ok ? r.json() : []),
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
        ...(Array.isArray(popupsRes) ? popupsRes : []).map((p: any) => ({
          id: p.id,
          title: p.title?.rendered || p.title || "Untitled",
          status: p.status || "publish",
          type: "popup" as const,
          modified: p.modified,
        })),
      ];
      setPages(allPages);
    } catch {
      // WordPress not reachable
    } finally {
      setPagesLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    refreshPages();
  }, [refreshPages]);

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
      const title = firstMessage ? autoTitle(firstMessage) : "New conversation";
      const conv: Conversation = {
        id,
        title,
        messages: [],
        pageContextId: selectedPageId ?? undefined,
        workspace,
        createdAt: now,
        updatedAt: now,
      };
      setConversations((prev) => [conv, ...prev]);
      setCurrentConversationId(id);

      // Persist to database — replace local ID with DB-generated UUID
      fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          pageContextId: selectedPageId ?? undefined,
          workspace,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((dbConv) => {
          if (dbConv && dbConv.id && dbConv.id !== id) {
            // Store the mapping so in-flight requests can resolve the real DB ID
            idMapRef.current[id] = dbConv.id;
            // Replace the local conversation with the DB version so IDs match
            setConversations((prev) =>
              prev.map((c) =>
                c.id === id
                  ? { ...c, id: dbConv.id, createdAt: dbConv.createdAt || now, updatedAt: dbConv.updatedAt || now }
                  : c
              )
            );
            setCurrentConversationId((prevId) =>
              prevId === id ? dbConv.id : prevId
            );
          }
        })
        .catch(() => {});

      return id;
    },
    [selectedPageId, workspace, setConversations, setCurrentConversationId]
  );

  const addMessage = useCallback(
    (convId: string, message: ChatMessage) => {
      let newTitle: string | undefined;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          const isFirst = c.messages.length === 0 && message.role === "user";
          if (isFirst) {
            const s = message.content.split(/[.!?\n]/)[0].trim();
            newTitle = s.length <= 40 ? s : s.slice(0, 40).trimEnd() + "...";
          }
          return {
            ...c,
            messages: [...c.messages, message],
            title: newTitle || c.title,
            updatedAt: new Date().toISOString(),
          };
        })
      );

      // Persist to database
      const msgPayload: Record<string, any> = {
        messages: [
          {
            id: message.id,
            role: message.role,
            content: message.content,
            timestamp: message.timestamp,
            files: message.files || null,
            pendingAction: message.pendingAction || null,
            actionResult: message.actionResult || null,
            reportData: message.reportData || null,
          },
        ],
      };
      if (newTitle) msgPayload.title = newTitle;
      persistConversationToDb(convId, msgPayload);
    },
    [setConversations, persistConversationToDb]
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
      // Persist to database
      persistConversationToDb(id, { title: newTitle });
    },
    [setConversations, persistConversationToDb]
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
      // Persist to database
      const dbId = idMapRef.current[id] || id;
      fetch(`/api/conversations/${dbId}`, { method: "DELETE" }).catch(() => {});
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
        // Read from ref to avoid stale closure when user sends messages quickly.
        const conv = conversationsRef.current.find((c) => c.id === convId);
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
            contactId: selectedContactId || undefined,
            courseId: selectedCourseId || undefined,
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
                // Strip <action> and <report> blocks from display — only show the plain language part
                const displayText = accumulated
                  .replace(/<action>[\s\S]*?<\/action>/g, "")
                  .replace(/<action>[\s\S]*/g, "")
                  .replace(/<report>[\s\S]*?<\/report>/g, "")
                  .replace(/<report>[\s\S]*/g, "")
                  .trim();
                updateLastAssistantMessage(convId, displayText || "Working on it...");
              } else if (data.type === "done") {
                if (data.message) {
                  updateLastAssistantMessage(convId, data.message);
                }
                if (data.pendingAction) {
                  setPendingAction(data.pendingAction);
                  // Also store pendingAction on the assistant message so inline ActionCard renders
                  setConversations((prev) =>
                    prev.map((c) => {
                      if (c.id !== convId) return c;
                      const msgs = [...c.messages];
                      for (let i = msgs.length - 1; i >= 0; i--) {
                        if (msgs[i].role === "assistant") {
                          msgs[i] = { ...msgs[i], pendingAction: data.pendingAction };
                          break;
                        }
                      }
                      return { ...c, messages: msgs };
                    })
                  );
                }
                if (data.reportData) {
                  // Store reportData on the assistant message
                  setConversations((prev) =>
                    prev.map((c) => {
                      if (c.id !== convId) return c;
                      const msgs = [...c.messages];
                      for (let i = msgs.length - 1; i >= 0; i--) {
                        if (msgs[i].role === "assistant") {
                          msgs[i] = { ...msgs[i], reportData: data.reportData as ReportData };
                          break;
                        }
                      }
                      return { ...c, messages: msgs };
                    })
                  );

                  // Auto-save report to library
                  const rd = data.reportData as ReportData;
                  fetch("/api/reports/saved", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      title: rd.title,
                      reportType: rd.title?.toLowerCase().includes("traffic") ? "traffic"
                        : rd.title?.toLowerCase().includes("contact") ? "contacts"
                        : rd.title?.toLowerCase().includes("revenue") ? "revenue"
                        : rd.title?.toLowerCase().includes("pipeline") ? "pipeline"
                        : rd.title?.toLowerCase().includes("enroll") ? "enrollments"
                        : rd.title?.toLowerCase().includes("course") ? "courses"
                        : rd.title?.toLowerCase().includes("business") ? "cross-service"
                        : "general",
                      reportData: rd,
                      workspace,
                    }),
                  })
                    .then((res) => {
                      if (res && res.ok) notify("info", "Report saved to library");
                    })
                    .catch(() => {});
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
          notify("error", "Connection lost. Try again.", errorMsg);
          logClientError("chat/stream", errorMsg, { model: selectedModel, workspace });
        }
      } finally {
        setIsStreaming(false);
        setStreamingMessageId(null);
        abortControllerRef.current = null;
        currentJobRef.current = null;

        // Persist the full conversation (with completed assistant message) to the database.
        // We read the latest state via a trick: setConversations with identity returns current.
        setConversations((prev) => {
          const conv = prev.find((c) => c.id === convId);
          if (conv && conv.messages.length > 0) {
            persistConversationToDb(convId, { messages: conv.messages });
          }
          return prev; // no mutation
        });
      }
    },
    [currentConversationId, createConversation, addMessage, updateLastAssistantMessage, selectedPageId, selectedModel, workspace, selectedContactId, selectedCourseId, setJobs, updateJob, persistConversationToDb, setConversations, logClientError]
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

  // --- Load full conversation from DB when selecting one ---
  const handleSelectConversation = useCallback(
    (id: string) => {
      setCurrentConversationId(id);

      // Check if we already have messages locally
      const local = conversations.find((c) => c.id === id);
      if (local && local.messages.length > 0) return;

      // Fetch from DB to get messages (skip for local-only IDs)
      const dbId = idMapRef.current[id] || id;
      if (!idMapRef.current[id] && id.match(/^\d+-/)) return;
      fetch(`/api/conversations/${dbId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((conv) => {
          if (!conv || !conv.messages || conv.messages.length === 0) return;
          setConversations((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, messages: conv.messages } : c
            )
          );
        })
        .catch(() => {});
    },
    [conversations, setCurrentConversationId, setConversations]
  );

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
    // Persist: send empty messages array to DB
    persistConversationToDb(currentConversationId, { messages: [] });
  }, [currentConversationId, setConversations, persistConversationToDb]);

  // Clear conversation by ID (used from sidebar context menu)
  const clearConversationById = useCallback(
    (id: string) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, messages: [], updatedAt: new Date().toISOString() }
            : c
        )
      );
      persistConversationToDb(id, { messages: [] });
    },
    [setConversations, persistConversationToDb]
  );

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

      // Find the original assistant message that has this pendingAction and mark it as executing
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== currentConversationId) return c;
          const msgs = c.messages.map((m) =>
            m.pendingAction?.id === action.id
              ? { ...m, pendingAction: null, actionExecuting: action.summary }
              : m
          );
          return { ...c, messages: msgs };
        })
      );

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

        // Update the original assistant message that proposed this action with the result
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== currentConversationId) return c;
            // Find the last assistant message (the one that had the action)
            const msgs = [...c.messages];
            for (let i = msgs.length - 1; i >= 0; i--) {
              if (msgs[i].role === "assistant" && !msgs[i].actionResult) {
                msgs[i] = {
                  ...msgs[i],
                  pendingAction: null,
                  actionExecuting: undefined,
                  actionResult: result,
                };
                break;
              }
            }
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
          notify("success", action.summary || "Action completed successfully");
          // Refresh page list if this was a WordPress action
          if (["create_page", "update_page", "delete_page", "create_post", "update_post", "create_popup", "update_popup", "delete_popup"].includes(action.type)) {
            refreshPages();
          }
        } else {
          updateJob(jobId, (j) =>
            failJob(j, result.error || "Action failed")
          );
          notify("error", "Action failed", result.error || "Unknown error");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Network error";

        // Update the original assistant message with the error result
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== currentConversationId) return c;
            const msgs = [...c.messages];
            for (let i = msgs.length - 1; i >= 0; i--) {
              if (msgs[i].role === "assistant" && !msgs[i].actionResult) {
                msgs[i] = {
                  ...msgs[i],
                  pendingAction: null,
                  actionResult: { success: false, error: errorMessage },
                };
                break;
              }
            }
            return { ...c, messages: msgs, updatedAt: new Date().toISOString() };
          })
        );
        notify("error", "Action failed", errorMessage);
        logClientError("chat/action", errorMessage, { actionType: action.type });

        updateJob(jobId, (j) => failJob(j, errorMessage));
      }

      // Persist updated messages to database
      if (currentConversationId) {
        setConversations((prev) => {
          const conv = prev.find((c) => c.id === currentConversationId);
          if (conv) {
            persistConversationToDb(currentConversationId, { messages: conv.messages });
          }
          return prev;
        });
      }
    },
    [currentConversationId, setConversations, setJobs, updateJob, persistConversationToDb, logClientError]
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
      // Close workspace panel on mobile after quick action
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setShowWorkspacePanel(false);
      }
    },
    [handleSend]
  );

  // --- Contact selection ---
  const handleSelectContact = useCallback(
    (contact: { id: number; name: string; email: string }) => {
      if (contact.id === 0) {
        setSelectedContactId(null);
        setSelectedContactName(null);
      } else {
        setSelectedContactId(contact.id);
        setSelectedContactName(contact.name);
      }
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
      "mod+shift+f": () => setShowFilesLibrary((v) => !v),
      "mod+d": () => setShowDebugPanel((v) => !v),
      "mod+e": () => {
        if (workspace !== "all") setShowWorkspacePanel((v) => !v);
      },
      "shift+?": () => {
        const active = document.activeElement;
        const isInput = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement;
        if (!isInput) setShowShortcuts(true);
      },
      escape: () => {
        if (showDebugPanel) setShowDebugPanel(false);
        else if (showQuickActionsManager) setShowQuickActionsManager(false);
        else if (showFilesLibrary) setShowFilesLibrary(false);
        else if (showJobsPanel) setShowJobsPanel(false);
        else if (showSettings) setShowSettings(false);
        else if (showWorkflows) setShowWorkflows(false);
        else if (showShortcuts) setShowShortcuts(false);
        else if (showPreview) setShowPreview(false);
        else if (isStreaming) handleCancelStream();
      },
    }),
    [createConversation, workspace, showDebugPanel, showQuickActionsManager, showFilesLibrary, showJobsPanel, showSettings, showWorkflows, showShortcuts, showPreview, isStreaming, handleCancelStream]
  );

  useKeyboardShortcuts(shortcutHandlers);

  if (!hydrated) {
    return (
      <div className="h-screen h-screen-safe flex items-center justify-center bg-white dark:bg-[#1c1c1e]">
        <div className="flex flex-col items-center gap-3">
          <Loader size={24} className="text-gray-400 animate-spin" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen h-screen-safe flex bg-white dark:bg-[#1c1c1e]">
      {/* Left Sidebar - 280px */}
      <Sidebar
        workspace={workspace}
        onWorkspaceChange={(ws) => {
          setWorkspace(ws);
          setCurrentConversationId(null);
          setSelectedPageId(null);
          setSelectedContactId(null);
          setSelectedContactName(null);
          setSelectedCourseId(null);
          setSelectedCourseName(null);
        }}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={() => createConversation()}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
        onClearConversation={clearConversationById}
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
        onOpenFiles={() => setShowFilesLibrary(true)}
        onOpenCommands={() => setShowCommandPanel(true)}
        onOpenQuickActionsManager={() => setShowQuickActionsManager(true)}
        quickActions={quickActions}
        onQuickAction={handleQuickAction}
        onOpenDebug={() => setShowDebugPanel(true)}
        hasErrors={hasLogErrors}
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
        onSelectCourse={(course) => { setSelectedCourseId(course.id); setSelectedCourseName(course.name); }}
        onQuickAction={handleQuickAction}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 md:hidden flex-shrink-0">
          <button
            onClick={() => setShowSidebar(true)}
            className="w-11 h-11 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors touch-target"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate flex-1">
            {currentConversation?.title || "Z-Health AI"}
          </h1>
          {workspace !== "all" && (
            <button
              onClick={() => setShowWorkspacePanel((v) => !v)}
              className="w-11 h-11 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors touch-target"
              title="Workspace panel"
            >
              <Document size={18} />
            </button>
          )}
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

        {/* Contact context bar */}
        {selectedContactId && selectedContactName && (
          <div className="flex items-center gap-2 px-4 h-9 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/40 flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 dark:text-amber-400 flex-shrink-0"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span className="text-xs text-amber-700 dark:text-amber-300 truncate flex-1">
              Working on: {selectedContactName}
            </span>
            <button
              onClick={() => { setSelectedContactId(null); setSelectedContactName(null); }}
              className="p-0.5 rounded text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-800/40 transition-colors flex-shrink-0"
              title="Clear contact context"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Course context bar */}
        {selectedCourseId && selectedCourseName && (
          <div className="flex items-center gap-2 px-4 h-9 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/40 flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 dark:text-emerald-400 flex-shrink-0"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
            <span className="text-xs text-emerald-700 dark:text-emerald-300 truncate flex-1">
              Working on: {selectedCourseName}
            </span>
            <button
              onClick={() => { setSelectedCourseId(null); setSelectedCourseName(null); }}
              className="p-0.5 rounded text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors flex-shrink-0"
              title="Clear course context"
            >
              <X size={14} />
            </button>
          </div>
        )}

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
          quickActions={quickActions}
          onQuickActionPinned={fetchQuickActions}
        />

        {/* Thinking indicator removed — Message.tsx already shows dots inside the message bubble */}

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

      {/* Files & Reports library (slide-over) */}
      <FilesLibrary
        show={showFilesLibrary}
        onClose={() => setShowFilesLibrary(false)}
      />

      {/* Debug / Error Log panel (slide-over) */}
      <DebugPanel
        show={showDebugPanel}
        onClose={() => setShowDebugPanel(false)}
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
      <QuickActionsManager
        show={showQuickActionsManager}
        onClose={() => setShowQuickActionsManager(false)}
        workspace={workspace}
        quickActions={quickActions}
        onRefresh={fetchQuickActions}
      />

      {/* Command panel */}
      <CommandPanel
        show={showCommandPanel}
        onClose={() => setShowCommandPanel(false)}
        workspace={workspace}
        quickActions={quickActions}
        onQuickAction={handleQuickAction}
        onOpenQuickActionsManager={() => { setShowCommandPanel(false); setShowQuickActionsManager(true); }}
        onOpenWorkflows={() => { setShowCommandPanel(false); setShowWorkflows(true); }}
        onRunWorkflow={(id) => { setShowCommandPanel(false); setInitialWorkflowId(id); setShowWorkflows(true); }}
      />

      {/* Notification toasts */}
      <NotificationToast />
    </div>
  );
}
