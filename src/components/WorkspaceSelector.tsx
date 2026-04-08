"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { Workspace, WorkspaceConfig } from "@/lib/types";
import { WORKSPACES } from "@/lib/workspaces";
import { useClickOutside } from "@/lib/hooks";
import { Sparkles, Globe, Users, BarChart, ChevronDown, Check } from "./icons";

const iconMap: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Sparkles,
  Globe,
  Users,
  BarChart,
};

interface WorkspaceSelectorProps {
  workspace: Workspace;
  onWorkspaceChange: (workspace: Workspace) => void;
}

export default function WorkspaceSelector({
  workspace,
  onWorkspaceChange,
}: WorkspaceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  const current = WORKSPACES.find((w) => w.id === workspace) || WORKSPACES[0];
  const CurrentIcon = iconMap[current.icon] || Sparkles;

  useEffect(() => {
    if (!isOpen) setFocusIndex(-1);
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((i) => Math.min(i + 1, WORKSPACES.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && focusIndex >= 0) {
        e.preventDefault();
        onWorkspaceChange(WORKSPACES[focusIndex].id);
        setIsOpen(false);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    },
    [focusIndex, onWorkspaceChange]
  );

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-200 group"
      >
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${current.color}18` }}
        >
          <span style={{ color: current.color }}>
            <CurrentIcon size={15} />
          </span>
        </span>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[13px] font-semibold text-gray-200 truncate">
            {current.name}
          </p>
          <p className="text-[11px] text-gray-500 truncate">
            {current.description}
          </p>
        </div>
        <ChevronDown
          size={14}
          className={`text-gray-500 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#242538] border border-white/10 rounded-xl shadow-lg shadow-black/30 z-50 overflow-hidden animate-scale-in">
          <div className="py-1">
            {WORKSPACES.map((ws, idx) => (
              <WorkspaceOption
                key={ws.id}
                config={ws}
                isSelected={ws.id === workspace}
                isFocused={idx === focusIndex}
                onClick={() => {
                  onWorkspaceChange(ws.id);
                  setIsOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceOption({
  config,
  isSelected,
  isFocused,
  onClick,
}: {
  config: WorkspaceConfig;
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
}) {
  const Icon = iconMap[config.icon] || Sparkles;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
        isFocused
          ? "bg-white/10"
          : isSelected
          ? "bg-white/5"
          : "hover:bg-white/5"
      }`}
    >
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${config.color}18` }}
      >
        <span style={{ color: config.color }}>
          <Icon size={15} />
        </span>
      </span>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[13px] font-medium text-gray-200">
          {config.name}
        </p>
        <p className="text-[11px] text-gray-500">
          {config.description}
        </p>
      </div>
      {isSelected && (
        <Check size={14} className="text-gray-400 flex-shrink-0" />
      )}
    </button>
  );
}
