"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { X } from "./icons";

interface SettingsPanelProps {
  show: boolean;
  onClose: () => void;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  theme?: "light" | "dark" | "auto";
  onThemeChange?: (theme: "light" | "dark" | "auto") => void;
}

type ThemeMode = "light" | "dark" | "auto";

interface BrandGuide {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
}

interface AIModelOption {
  value: string;
  label: string;
  description: string;
  provider: "claude" | "gemini";
  envKey: string;
}

const AI_MODELS: AIModelOption[] = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", description: "Best balance of speed and intelligence", provider: "claude", envKey: "ANTHROPIC_API_KEY" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6", description: "Most capable, best for complex tasks", provider: "claude", envKey: "ANTHROPIC_API_KEY" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5", description: "Fastest responses, great for simple tasks", provider: "claude", envKey: "ANTHROPIC_API_KEY" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", description: "Free tier, fast responses", provider: "gemini", envKey: "GEMINI_API_KEY" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Capable reasoning model", provider: "gemini", envKey: "GEMINI_API_KEY" },
];

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
      {title}
    </h3>
  );
}

function Divider() {
  return <div className="border-t border-gray-100 dark:border-gray-800 my-5" />;
}

export default function SettingsPanel({ show, onClose, selectedModel: externalModel, onModelChange, theme: externalTheme, onThemeChange }: SettingsPanelProps) {
  const { data: session } = useSession();

  // AI Model -- use external state if provided, otherwise local
  const [localModel, setLocalModel] = useState<string>("claude-sonnet-4-6");
  const aiModel = externalModel || localModel;

  // Theme - use external state if provided, otherwise local
  const [localTheme, setLocalTheme] = useState<ThemeMode>("light");
  const theme = externalTheme || localTheme;

  // WordPress connection
  const [wpStatus, setWpStatus] = useState<"idle" | "loading" | "connected" | "disconnected">("idle");
  const [wpSiteName, setWpSiteName] = useState<string>("");
  const [wpSiteUrl, setWpSiteUrl] = useState<string>("");

  // No longer probe for API keys at runtime

  // Brand Guide
  const [brandGuide, setBrandGuide] = useState<BrandGuide>({
    primaryColor: "#1a1a2e",
    secondaryColor: "#0f3460",
    accentColor: "#e94560",
    headingFont: "",
    bodyFont: "",
  });

  // Confirmation dialogs
  const [confirmClearConversations, setConfirmClearConversations] = useState(false);
  const [confirmClearStorage, setConfirmClearStorage] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedModel = localStorage.getItem("zhealth-ai-model");
      if (savedModel) setLocalModel(savedModel);

      const savedBrand = localStorage.getItem("zhealth-brand-guide");
      if (savedBrand) setBrandGuide(JSON.parse(savedBrand));
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // No API probing -- models are listed statically

  // Theme application -- delegate to parent if available, otherwise local
  const applyTheme = useCallback((mode: ThemeMode) => {
    if (onThemeChange) {
      onThemeChange(mode);
    } else {
      setLocalTheme(mode);
      localStorage.setItem("zhealth-theme", mode);
      if (mode === "dark") {
        document.documentElement.classList.add("dark");
      } else if (mode === "light") {
        document.documentElement.classList.remove("dark");
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (prefersDark) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    }
  }, [onThemeChange]);

  // AI Model save
  const handleModelChange = useCallback((model: string) => {
    setLocalModel(model);
    localStorage.setItem("zhealth-ai-model", model);
    if (onModelChange) {
      onModelChange(model);
    }
  }, [onModelChange]);

  // Brand guide save
  const handleBrandChange = useCallback(
    (key: keyof BrandGuide, value: string) => {
      setBrandGuide((prev) => {
        const updated = { ...prev, [key]: value };
        localStorage.setItem("zhealth-brand-guide", JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  // Test WordPress connection
  const testConnection = useCallback(async () => {
    setWpStatus("loading");
    try {
      const res = await fetch("/api/site-info");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setWpSiteName(data.site?.name || "Unknown");
      setWpSiteUrl(data.site?.url || "");
      setWpStatus("connected");
    } catch {
      setWpStatus("disconnected");
      setWpSiteName("");
    }
  }, []);

  // Clear conversations
  const handleClearConversations = useCallback(() => {
    localStorage.removeItem("zhealth-conversations");
    localStorage.removeItem("zhealth-current-conv");
    setConfirmClearConversations(false);
    window.location.reload();
  }, []);

  // Clear all local storage
  const handleClearStorage = useCallback(() => {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("zhealth-")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    setConfirmClearStorage(false);
    window.location.reload();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && show) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [show, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          show ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-[#1c1c1e] border-l border-gray-200 dark:border-gray-800 z-[70] transform transition-transform duration-300 ease-out ${
          show ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ maxHeight: "calc(100vh - 65px)" }}>
          {/* Account */}
          <SectionHeader title="Account" />
          <div className="flex items-center gap-3 mb-3">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt=""
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm font-medium">
                {session?.user?.name?.charAt(0) || "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {session?.user?.name || "Unknown"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {session?.user?.email || ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            Sign out
          </button>

          <Divider />

          {/* AI Model */}
          <SectionHeader title="AI Model" />
          <div className="space-y-2">
            {AI_MODELS.map((model) => (
              <label
                key={model.value}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                  aiModel === model.value
                    ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                    : "bg-gray-50 dark:bg-[#2c2c2e] border border-transparent hover:bg-gray-100 dark:hover:bg-[#3a3a3c]"
                }`}
              >
                <input
                  type="radio"
                  name="ai-model"
                  value={model.value}
                  checked={aiModel === model.value}
                  onChange={() => handleModelChange(model.value)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    aiModel === model.value
                      ? "border-blue-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {aiModel === model.value && (
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{model.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {model.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Configure API keys in Vercel environment variables.
          </p>

          <Divider />

          {/* WordPress Connection */}
          <SectionHeader title="WordPress Connection" />
          <div className="bg-gray-50 dark:bg-[#2c2c2e] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  wpStatus === "connected"
                    ? "bg-green-500"
                    : wpStatus === "disconnected"
                    ? "bg-red-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {wpStatus === "connected"
                  ? "Connected"
                  : wpStatus === "disconnected"
                  ? "Disconnected"
                  : wpStatus === "loading"
                  ? "Testing..."
                  : "Not tested"}
              </span>
            </div>
            {wpSiteUrl && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{wpSiteUrl}</p>
            )}
            {wpSiteName && (
              <p className="text-sm font-medium text-gray-900 dark:text-white">{wpSiteName}</p>
            )}
            <button
              onClick={testConnection}
              disabled={wpStatus === "loading"}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-[#3a3a3c] border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-[#444446] transition-colors disabled:opacity-50"
            >
              {wpStatus === "loading" ? "Testing..." : "Test Connection"}
            </button>
          </div>

          <Divider />

          {/* Appearance */}
          <SectionHeader title="Appearance" />
          <div className="flex gap-2">
            {(["light", "dark", "auto"] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => applyTheme(mode)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
                  theme === mode
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                    : "bg-gray-100 dark:bg-[#2c2c2e] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#3a3a3c]"
                }`}
              >
                {mode === "auto" ? "System" : mode}
              </button>
            ))}
          </div>

          <Divider />

          {/* Brand Guide */}
          <SectionHeader title="Brand Guide" />
          <div className="space-y-3">
            {[
              { key: "primaryColor" as const, label: "Primary color" },
              { key: "secondaryColor" as const, label: "Secondary color" },
              { key: "accentColor" as const, label: "Accent color" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandGuide[key]}
                  onChange={(e) => handleBrandChange(key, e.target.value)}
                  className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer bg-transparent"
                />
                <div className="flex-1">
                  <label className="text-sm text-gray-700 dark:text-gray-300">{label}</label>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                  {brandGuide[key]}
                </span>
              </div>
            ))}
            <div className="space-y-2 pt-1">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Heading font</label>
                <input
                  type="text"
                  value={brandGuide.headingFont}
                  onChange={(e) => handleBrandChange("headingFont", e.target.value)}
                  placeholder="e.g. Inter, Helvetica"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Body font</label>
                <input
                  type="text"
                  value={brandGuide.bodyFont}
                  onChange={(e) => handleBrandChange("bodyFont", e.target.value)}
                  placeholder="e.g. Inter, Helvetica"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <Divider />

          {/* Data */}
          <SectionHeader title="Data" />
          <div className="space-y-2">
            {!confirmClearConversations ? (
              <button
                onClick={() => setConfirmClearConversations(true)}
                className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#2c2c2e] rounded-xl hover:bg-gray-100 dark:hover:bg-[#3a3a3c] transition-colors text-left"
              >
                Clear all conversations
              </button>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400 flex-1">Are you sure?</p>
                <button
                  onClick={handleClearConversations}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmClearConversations(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-[#3a3a3c] rounded-lg hover:bg-gray-100 dark:hover:bg-[#444446] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {!confirmClearStorage ? (
              <button
                onClick={() => setConfirmClearStorage(true)}
                className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#2c2c2e] rounded-xl hover:bg-gray-100 dark:hover:bg-[#3a3a3c] transition-colors text-left"
              >
                Clear local storage
              </button>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400 flex-1">Are you sure?</p>
                <button
                  onClick={handleClearStorage}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => setConfirmClearStorage(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-[#3a3a3c] rounded-lg hover:bg-gray-100 dark:hover:bg-[#444446] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <Divider />

          {/* About */}
          <SectionHeader title="About" />
          <div className="space-y-1">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Z-Health AI <span className="text-gray-400 dark:text-gray-500">v1.0.0</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Built with Claude AI + Gemini
            </p>
          </div>

          {/* Bottom padding */}
          <div className="h-8" />
        </div>
      </div>
    </>
  );
}
