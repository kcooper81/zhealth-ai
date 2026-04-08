"use client";

import React, { useRef, useState, useCallback } from "react";
import { useAutoResize } from "@/lib/hooks";
import { Send, Paperclip, X, StopCircle } from "./icons";

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-opus-4-6": "Opus 4.6",
  "claude-haiku-4-5": "Haiku 4.5",
  "gemini-2.0-flash": "Gemini Flash",
  "gemini-2.5-pro": "Gemini Pro",
};

interface InputAreaProps {
  onSend: (text: string, file?: File | null) => void;
  isStreaming: boolean;
  onCancelStream?: () => void;
  modelName?: string;
  disabled?: boolean;
  placeholder?: string;
}

export default function InputArea({
  onSend,
  isStreaming,
  onCancelStream,
  modelName,
  disabled,
  placeholder,
}: InputAreaProps) {
  const [value, setValue] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useAutoResize(textareaRef, value);

  const canSend = value.trim().length > 0 && !isStreaming && !disabled;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(value.trim(), attachedFile);
    setValue("");
    setAttachedFile(null);
    setFilePreview(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [canSend, value, attachedFile, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape" && isStreaming) {
        onCancelStream?.();
      }
    },
    [handleSend, isStreaming, onCancelStream]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const removeFile = () => {
    setAttachedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const displayModel =
    MODEL_DISPLAY_NAMES[modelName || ""] || modelName || "AI";

  return (
    <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1c1c1e]">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-3">
        {/* File preview */}
        {attachedFile && (
          <div className="mb-2 animate-slide-up">
            {filePreview ? (
              <div className="inline-flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl p-2 pr-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={filePreview}
                  alt="Attachment"
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[160px]">
                    {attachedFile.name}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {(attachedFile.size / 1024).toFixed(0)} KB
                  </span>
                </div>
                <button
                  onClick={removeFile}
                  className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors ml-1"
                >
                  <X size={10} className="text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                <Paperclip size={14} className="text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-[200px]">
                  {attachedFile.name}
                </span>
                <button
                  onClick={removeFile}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main input container */}
        <div className="relative bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-2xl focus-within:ring-2 focus-within:ring-brand-blue/30 focus-within:border-brand-blue/50 transition-all duration-200">
          {/* Textarea row */}
          <div className="flex items-end">
            {/* Attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ml-1 mb-0.5 rounded-full hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
              title="Attach file"
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt,.csv"
              onChange={handleFileSelect}
            />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={placeholder || "Message Z-Health AI..."}
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none leading-relaxed min-h-[40px]"
              style={{ overflow: "hidden" }}
            />

            {/* Send or Stop button */}
            {isStreaming ? (
              <button
                onClick={onCancelStream}
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all mr-1 mb-0.5"
                title="Stop generating"
              >
                <StopCircle size={20} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 mr-1 mb-0.5 ${
                  canSend
                    ? "bg-brand-blue text-white hover:bg-blue-600 active:scale-[0.92] shadow-sm"
                    : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                }`}
                title="Send message"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Footer bar */}
        <div className="flex items-center justify-between mt-1.5 px-2">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
              {displayModel}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500">
            {isStreaming && (
              <span className="text-brand-blue font-medium animate-pulse">
                Generating...
              </span>
            )}
            <span>
              Enter to send
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
