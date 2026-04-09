"use client";

import React, { useEffect, useRef, useState } from "react";
import { Edit, Pin, Download, Eraser, Trash, Layers, FileText } from "./icons";

export interface ConversationMenuProps {
  x: number;
  y: number;
  isPinned: boolean;
  isArchived: boolean;
  onRename: () => void;
  onPin: () => void;
  onArchive: () => void;
  onExport: () => void;
  onExportPdf: () => void;
  onClear: () => void;
  onDelete: () => void;
  onClose: () => void;
}

interface MenuItemProps {
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function MenuItem({ icon: Icon, label, onClick, danger }: MenuItemProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium transition-colors touch-target ${
        danger
          ? "text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 dark:active:bg-red-900/30"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 active:bg-gray-100 dark:active:bg-white/10"
      }`}
    >
      <Icon size={14} className={danger ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500"} />
      {label}
    </button>
  );
}

export default function ConversationMenu({
  x,
  y,
  isPinned,
  isArchived,
  onRename,
  onPin,
  onArchive,
  onExport,
  onExportPdf,
  onClear,
  onDelete,
  onClose,
}: ConversationMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let ax = x;
    let ay = y;
    if (ax + rect.width > window.innerWidth - 8) {
      ax = window.innerWidth - rect.width - 8;
    }
    if (ay + rect.height > window.innerHeight - 8) {
      ay = window.innerHeight - rect.height - 8;
    }
    if (ax < 8) ax = 8;
    if (ay < 8) ay = 8;
    setAdjustedPos({ x: ax, y: ay });
  }, [x, y]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Use a short delay so the triggering click doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-[200px] bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 animate-in fade-in duration-100"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem icon={Edit} label="Rename" onClick={onRename} />
      <MenuItem icon={Pin} label={isPinned ? "Unpin" : "Pin"} onClick={onPin} />
      <MenuItem icon={Layers} label={isArchived ? "Unarchive" : "Archive"} onClick={onArchive} />
      <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
      <MenuItem icon={Download} label="Export as Text" onClick={onExport} />
      <MenuItem icon={FileText} label="Export as PDF" onClick={onExportPdf} />
      <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
      <MenuItem icon={Eraser} label="Clear messages" onClick={onClear} />
      <MenuItem icon={Trash} label="Delete" onClick={onDelete} danger />
    </div>
  );
}
