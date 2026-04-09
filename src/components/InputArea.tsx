"use client";

import React, { useRef, useState, useCallback } from "react";
import { useAutoResize } from "@/lib/hooks";
import type { FileAttachment } from "@/lib/types";
import FilePreview from "./FilePreview";
import { Send, StopCircle, Paperclip, Upload } from "./icons";

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-opus-4-6": "Opus 4.6",
  "claude-haiku-4-5": "Haiku 4.5",
  "gemini-2.0-flash": "Gemini Flash",
  "gemini-2.5-pro": "Gemini Pro",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const ACCEPT_STRING = "image/*,.pdf,.csv,.doc,.docx,.txt";

function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

interface InputAreaProps {
  onSend: (text: string, files?: FileAttachment[]) => void;
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
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

  useAutoResize(textareaRef, value);

  const canSend = (value.trim().length > 0 || files.length > 0) && !isStreaming && !disabled;

  const processFile = useCallback(async (file: File): Promise<FileAttachment | null> => {
    // Validate type
    const isAccepted =
      ACCEPTED_TYPES.includes(file.type) ||
      file.type.startsWith("image/") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".doc") ||
      file.name.endsWith(".docx");

    if (!isAccepted) {
      setFileError(`Unsupported file type: ${file.name}`);
      return null;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File too large (max 10MB): ${file.name}`);
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Full = reader.result as string;
        // Extract just the base64 data without the data URI prefix
        const base64Data = base64Full.split(",")[1] || "";

        const attachment: FileAttachment = {
          id: generateFileId(),
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          data: base64Data,
        };

        // For images, also store the full data URI as preview
        if (isImageType(file.type)) {
          attachment.preview = base64Full;
        }

        resolve(attachment);
      };
      reader.onerror = () => {
        setFileError(`Failed to read file: ${file.name}`);
        resolve(null);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setFileError(null);
      const newFiles: FileAttachment[] = [];
      const filesToProcess = Array.from(fileList);

      for (const file of filesToProcess) {
        if (files.length + newFiles.length >= MAX_FILES) {
          setFileError(`Maximum ${MAX_FILES} files allowed`);
          break;
        }
        const attachment = await processFile(file);
        if (attachment) {
          newFiles.push(attachment);
        }
      }

      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles].slice(0, MAX_FILES));
      }
    },
    [files.length, processFile]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setFileError(null);
  }, []);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const trimmed = value.trim();
    const filesToSend = files.length > 0 ? files : undefined;
    onSend(trimmed || "(attached files)", filesToSend);
    setValue("");
    setFiles([]);
    setFileError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [canSend, value, files, onSend]);

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

  // Clipboard paste for images
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        addFiles(imageFiles);
      }
    },
    [addFiles]
  );

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current += 1;
    if (e.dataTransfer?.types?.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current -= 1;
    if (dragCountRef.current <= 0) {
      dragCountRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCountRef.current = 0;
      setIsDragging(false);

      const droppedFiles = e.dataTransfer?.files;
      if (droppedFiles && droppedFiles.length > 0) {
        addFiles(droppedFiles);
      }
    },
    [addFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files;
      if (selected && selected.length > 0) {
        addFiles(selected);
      }
      // Reset the input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [addFiles]
  );

  const displayModel =
    MODEL_DISPLAY_NAMES[modelName || ""] || modelName || "AI";

  return (
    <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1c1c1e]">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-3">
        {/* Main input container */}
        <div
          className={`relative bg-gray-50 dark:bg-[#2c2c2e] border rounded-2xl focus-within:ring-2 focus-within:ring-brand-blue/30 focus-within:border-brand-blue/50 transition-all duration-200 ${
            isDragging
              ? "border-brand-blue border-dashed bg-brand-blue/5 dark:bg-brand-blue/10"
              : "border-gray-200 dark:border-gray-700"
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-10 rounded-2xl flex items-center justify-center bg-brand-blue/5 dark:bg-brand-blue/10 border-2 border-dashed border-brand-blue/40 pointer-events-none animate-fade-in">
              <div className="flex flex-col items-center gap-1.5">
                <Upload size={24} className="text-brand-blue" />
                <span className="text-sm font-medium text-brand-blue">Drop files here</span>
              </div>
            </div>
          )}

          {/* File chips row */}
          {files.length > 0 && (
            <div className="pt-2">
              <FilePreview files={files} mode="input" onRemove={removeFile} />
            </div>
          )}

          {/* File error */}
          {fileError && (
            <div className="px-3 pt-1.5">
              <p className="text-xs text-red-500 dark:text-red-400">{fileError}</p>
            </div>
          )}

          {/* Textarea row */}
          <div className="flex items-end">
            {/* Paperclip button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isStreaming}
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors ml-1 mb-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Attach files"
            >
              <Paperclip size={18} />
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT_STRING}
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
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
            {files.length > 0 && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {files.length} file{files.length !== 1 ? "s" : ""} attached
              </span>
            )}
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
