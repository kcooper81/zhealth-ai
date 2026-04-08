"use client";

import React, { useRef, useState, useCallback } from "react";
import { useAutoResize } from "@/lib/hooks";
import { Send, Paperclip, X } from "./icons";

interface InputAreaProps {
  onSend: (text: string, file?: File | null) => void;
  isStreaming: boolean;
  onCancelStream?: () => void;
}

export default function InputArea({ onSend, isStreaming, onCancelStream }: InputAreaProps) {
  const [value, setValue] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useAutoResize(textareaRef, value);

  const canSend = value.trim().length > 0 && !isStreaming;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(value.trim(), attachedFile);
    setValue("");
    setAttachedFile(null);
    setFilePreview(null);
    // Reset textarea height
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

  return (
    <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1c1c1e] px-4 md:px-8 py-3">
      <div className="max-w-3xl mx-auto">
        {/* File preview */}
        {attachedFile && (
          <div className="mb-2 flex items-center gap-2 animate-slide-up">
            {filePreview ? (
              <div className="relative">
                <img
                  src={filePreview}
                  alt="Attachment"
                  className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                />
                <button
                  onClick={removeFile}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-600 text-white rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                <button onClick={removeFile} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2">
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-0.5"
          >
            <Paperclip size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
          />

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Z-Health AI..."
              rows={1}
              className="w-full resize-none bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-[15px] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue/50 transition-all duration-200 leading-relaxed"
              style={{ overflow: "hidden" }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 mb-0.5 ${
              canSend
                ? "bg-brand-blue text-white hover:bg-blue-600 active:scale-[0.92] shadow-sm"
                : "bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed"
            }`}
          >
            <Send size={16} />
          </button>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
            Sonnet 4.6
          </span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            Enter to send, Shift+Enter for new line
          </span>
        </div>
      </div>
    </div>
  );
}
