"use client";

import React from "react";
import { Zap, FolderOpen, Bug, Activity, Clock } from "./icons";

interface RightBarProps {
  onOpenCommands: () => void;
  onOpenFiles: () => void;
  onOpenDebug: () => void;
  onOpenActivity: () => void;
  onOpenJobs: () => void;
  hasErrors?: boolean;
  activeJobCount?: number;
}

interface BarButtonProps {
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
  badge?: number | boolean;
  badgeColor?: string;
}

function BarButton({ icon: Icon, label, onClick, badge, badgeColor = "bg-red-500" }: BarButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 active:bg-gray-200 dark:active:bg-white/10 transition-colors"
      title={label}
    >
      <Icon size={16} />
      {badge && (
        <span className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 ${badgeColor} rounded-full text-[8px] font-bold text-white flex items-center justify-center`}>
          {typeof badge === "number" ? (badge > 9 ? "9+" : badge) : ""}
        </span>
      )}
    </button>
  );
}

export default function RightBar({
  onOpenCommands,
  onOpenFiles,
  onOpenDebug,
  onOpenActivity,
  onOpenJobs,
  hasErrors,
  activeJobCount,
}: RightBarProps) {
  return (
    <div className="hidden md:flex flex-col items-center w-11 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1c1c1e] py-3 gap-1 flex-shrink-0">
      <BarButton icon={Zap} label="Quick Commands" onClick={onOpenCommands} />
      <BarButton icon={FolderOpen} label="Files & Reports" onClick={onOpenFiles} />
      <BarButton icon={Activity} label="Activity" onClick={onOpenActivity} />
      <BarButton
        icon={Clock}
        label="Jobs"
        onClick={onOpenJobs}
        badge={activeJobCount && activeJobCount > 0 ? activeJobCount : undefined}
        badgeColor="bg-brand-blue"
      />
      <div className="flex-1" />
      <BarButton
        icon={Bug}
        label="Debug Logs"
        onClick={onOpenDebug}
        badge={hasErrors || undefined}
        badgeColor="bg-red-500"
      />
    </div>
  );
}
