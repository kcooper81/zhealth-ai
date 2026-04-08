"use client";

import React, { useState, useCallback, useMemo } from "react";
import type { ChatMessage, Conversation, PendingAction } from "@/lib/types";
import { useLocalStorage, useKeyboardShortcuts } from "@/lib/hooks";
import Sidebar from "./Sidebar";
import MessageList from "./MessageList";
import InputArea from "./InputArea";
import PreviewPanel from "./PreviewPanel";
import ActionConfirmation from "./ActionConfirmation";
import Onboarding from "./Onboarding";
import KeyboardShortcuts from "./KeyboardShortcuts";
import { Menu } from "./icons";

// Demo data for initial state
const DEMO_PAGES = [
  { id: 1, title: "Home", status: "publish" as const, type: "page" as const, modified: "2026-04-05T10:00:00Z" },
  { id: 2, title: "About Z-Health", status: "publish" as const, type: "page" as const, modified: "2026-04-04T09:00:00Z" },
  { id: 3, title: "Courses", status: "publish" as const, type: "page" as const, modified: "2026-04-03T14:30:00Z" },
  { id: 4, title: "Contact", status: "draft" as const, type: "page" as const, modified: "2026-04-01T08:00:00Z" },
  { id: 5, title: "Pain & Performance", status: "publish" as const, type: "post" as const, modified: "2026-03-28T16:00:00Z" },
  { id: 6, title: "Vision Training Guide", status: "draft" as const, type: "post" as const, modified: "2026-03-25T11:00:00Z" },
];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function Chat() {
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
  const [, setShowOnboarding] = useState(true);

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
        createdAt: now,
        updatedAt: now,
      };
      setConversations((prev) => [conv, ...prev]);
      setCurrentConversationId(id);
      return id;
    },
    [selectedPageId, setConversations, setCurrentConversationId]
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

  // --- Message sending ---
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

      // Simulate streaming response (replace with real API call in production)
      try {
        const response = await simulateStream(text);
        let accumulated = "";
        for (const chunk of response) {
          accumulated += chunk;
          updateLastAssistantMessage(convId, accumulated);
          await new Promise((r) => setTimeout(r, 12 + Math.random() * 20));
        }
      } catch {
        updateLastAssistantMessage(
          convId,
          "I encountered an error processing your request. Please try again."
        );
      } finally {
        setIsStreaming(false);
        setStreamingMessageId(null);
      }
    },
    [currentConversationId, createConversation, addMessage, updateLastAssistantMessage]
  );

  const handleCancelStream = useCallback(() => {
    setIsStreaming(false);
    setStreamingMessageId(null);
  }, []);

  // --- Actions ---
  const handleConfirmAction = useCallback(
    (action: PendingAction) => {
      setPendingAction(null);
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
    },
    [currentConversationId, addMessage, previewUrl]
  );

  const handleCancelAction = useCallback((_actionId: string) => {
    setPendingAction(null);
  }, []);

  // --- Quick actions ---
  const handleQuickAction = useCallback(
    (action: string) => {
      handleSend(action);
    },
    [handleSend]
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
      escape: () => {
        if (showShortcuts) setShowShortcuts(false);
        else if (showPreview) setShowPreview(false);
        else if (isStreaming) handleCancelStream();
      },
    }),
    [createConversation, showShortcuts, showPreview, isStreaming, handleCancelStream]
  );

  useKeyboardShortcuts(shortcutHandlers);

  return (
    <div className="h-screen flex bg-white dark:bg-[#1c1c1e]">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={setCurrentConversationId}
        onNewConversation={() => createConversation()}
        onDeleteConversation={deleteConversation}
        selectedPageId={selectedPageId}
        onSelectPage={setSelectedPageId}
        pages={DEMO_PAGES}
        onQuickAction={handleQuickAction}
        onOpenShortcuts={() => setShowShortcuts(true)}
        onOpenSettings={() => {
          /* Settings modal placeholder */
        }}
        showSidebar={showSidebar}
        onCloseSidebar={() => setShowSidebar(false)}
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
        </div>

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
        />
      </div>

      {/* Preview panel */}
      <PreviewPanel
        url={previewUrl}
        title={DEMO_PAGES.find((p) => p.id === selectedPageId)?.title}
        show={showPreview}
        onClose={() => setShowPreview(false)}
      />

      {/* Modals */}
      <KeyboardShortcuts show={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <Onboarding onComplete={() => setShowOnboarding(false)} />
    </div>
  );
}

// --- Simulated streaming for demo purposes ---
function simulateStream(input: string): Promise<string[]> {
  const responses: Record<string, string> = {
    "What can I do?": `I can help you manage your Z-Health Education WordPress site. Here's what I can do:

**Pages & Posts**
- Create, edit, and delete pages and posts
- Update content, titles, and metadata
- Manage page templates and layouts

**Media**
- Upload and organize images
- Set featured images on posts

**SEO**
- Analyze and optimize meta titles and descriptions
- Suggest keyword improvements
- Check for SEO issues

**WooCommerce**
- View and update products
- Check order status and analytics

**Bulk Operations**
- Update multiple pages at once
- Find and replace across content

Just describe what you'd like to do in plain language, and I'll take care of the rest.`,
    "List pages": `Here are your current pages:

| Page | Status | Last Modified |
|------|--------|---------------|
| Home | Published | Apr 5, 2026 |
| About Z-Health | Published | Apr 4, 2026 |
| Courses | Published | Apr 3, 2026 |
| Contact | Draft | Apr 1, 2026 |

Would you like to edit any of these pages, or create a new one?`,
    "New page": `I'd be happy to help you create a new page. To get started, I need a few details:

1. **Page title** -- What should the page be called?
2. **Content brief** -- What should the page cover?
3. **Template** -- Should I use a specific page template?
4. **Status** -- Publish immediately or save as draft?

You can also just describe what you want and I'll figure out the details.`,
    "SEO check": `I'll run a quick SEO analysis on your site. Here's what I found:

**Home Page**
- Meta title: Good length (58 chars)
- Meta description: \`Missing -- needs attention\`
- H1 tag: Present

**About Z-Health**
- Meta title: Good length (45 chars)
- Meta description: Good length (142 chars)
- H1 tag: Present

**Courses**
- Meta title: Too short (12 chars) -- recommend 50-60
- Meta description: \`Missing -- needs attention\`
- H1 tag: Missing

> **Recommendation**: Focus on adding meta descriptions to Home and Courses pages, and expanding the Courses page title.

Would you like me to fix any of these issues?`,
  };

  const response =
    responses[input] ||
    `I understand you'd like to: **${input}**

Let me look into that for you. I'll analyze your WordPress site and determine the best approach.

Is there anything specific you'd like me to focus on?`;

  return Promise.resolve(response.split(""));
}
