"use client";

import React, { useState } from "react";
import type { FileAttachment } from "@/lib/types";
import { X, FileIcon, FileText, ImageIcon } from "./icons";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

function getFileIcon(type: string) {
  if (isImageType(type)) return ImageIcon;
  if (
    type === "application/pdf" ||
    type === "text/plain" ||
    type === "text/csv" ||
    type.includes("document") ||
    type.includes("msword")
  ) {
    return FileText;
  }
  return FileIcon;
}

interface FilePreviewProps {
  files: FileAttachment[];
  mode: "input" | "message";
  onRemove?: (id: string) => void;
}

export default function FilePreview({ files, mode, onRemove }: FilePreviewProps) {
  if (!files || files.length === 0) return null;

  if (mode === "input") {
    return (
      <div className="flex flex-wrap gap-2 px-3 pb-2">
        {files.map((file) => (
          <FileChip key={file.id} file={file} onRemove={onRemove} />
        ))}
      </div>
    );
  }

  // Message mode
  return (
    <div className="flex flex-col gap-2 mb-2">
      {files.map((file) =>
        isImageType(file.type) ? (
          <MessageImage key={file.id} file={file} />
        ) : (
          <MessageFileCard key={file.id} file={file} />
        )
      )}
    </div>
  );
}

function FileChip({
  file,
  onRemove,
}: {
  file: FileAttachment;
  onRemove?: (id: string) => void;
}) {
  const Icon = getFileIcon(file.type);
  const isImage = isImageType(file.type);

  return (
    <div className="flex items-center gap-2 bg-white dark:bg-[#3a3a3c] border border-gray-200 dark:border-gray-600 rounded-xl px-2.5 py-1.5 shadow-sm animate-slide-up max-w-[200px]">
      {isImage && file.preview ? (
        <img
          src={file.preview}
          alt={file.name}
          className="w-8 h-8 rounded-md object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-gray-500 dark:text-gray-400" />
        </div>
      )}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-xs text-gray-700 dark:text-gray-200 truncate leading-tight">
          {file.name}
        </span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
          {formatFileSize(file.size)}
        </span>
      </div>
      {onRemove && (
        <button
          onClick={() => onRemove(file.id)}
          className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          title="Remove file"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function MessageImage({ file }: { file: FileAttachment }) {
  const [expanded, setExpanded] = useState(false);
  const src = file.preview || file.url || (file.data ? `data:${file.type};base64,${file.data}` : "");

  if (!src) return null;

  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className="block rounded-xl overflow-hidden max-w-[200px] border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity"
      >
        <img
          src={src}
          alt={file.name}
          className="max-w-[200px] max-h-[200px] object-cover rounded-xl"
        />
      </button>

      {/* Lightbox */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setExpanded(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={src}
              alt={file.name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setExpanded(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={16} />
            </button>
            <p className="text-center text-sm text-white/70 mt-3">
              {file.name} -- {formatFileSize(file.size)}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function MessageFileCard({ file }: { file: FileAttachment }) {
  const Icon = getFileIcon(file.type);

  return (
    <div className="flex items-center gap-2.5 bg-gray-50 dark:bg-[#3a3a3c] border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 max-w-[250px]">
      <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-gray-500 dark:text-gray-400" />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm text-gray-700 dark:text-gray-200 truncate leading-tight">
          {file.name}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 leading-tight">
          {formatFileSize(file.size)}
        </span>
      </div>
    </div>
  );
}
