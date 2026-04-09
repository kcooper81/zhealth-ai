"use client";

import React, { useEffect, useState } from "react";
import { useNotifications, dismissNotification } from "@/lib/notifications";
import type { Notification, NotificationType } from "@/lib/notifications";
import { X, AlertCircle, CircleCheck, CircleX } from "./icons";

const borderColors: Record<NotificationType, string> = {
  success: "border-l-green-500",
  error: "border-l-red-500",
  info: "border-l-blue-500",
  warning: "border-l-amber-500",
};

const progressColors: Record<NotificationType, string> = {
  success: "bg-green-500",
  error: "bg-red-500",
  info: "bg-blue-500",
  warning: "bg-amber-500",
};

const iconMap: Record<NotificationType, React.FC<{ size?: number; className?: string }>> = {
  success: CircleCheck,
  error: CircleX,
  info: AlertCircle,
  warning: AlertCircle,
};

const iconColors: Record<NotificationType, string> = {
  success: "text-green-500",
  error: "text-red-500",
  info: "text-blue-500",
  warning: "text-amber-500",
};

function ToastItem({ notification }: { notification: Notification }) {
  const [entering, setEntering] = useState(true);
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  // Slide in
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 20);
    return () => clearTimeout(t);
  }, []);

  // Progress bar
  useEffect(() => {
    const interval = 50; // update every 50ms
    const totalSteps = notification.duration / interval;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setProgress(Math.max(0, 100 - (step / totalSteps) * 100));
    }, interval);
    return () => clearInterval(timer);
  }, [notification.duration]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => dismissNotification(notification.id), 200);
  };

  const Icon = iconMap[notification.type];

  return (
    <div
      className={`relative w-[340px] bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 border-l-4 ${borderColors[notification.type]} rounded-lg shadow-lg overflow-hidden transition-all duration-200 ease-out ${
        entering
          ? "translate-x-full opacity-0"
          : exiting
          ? "translate-x-full opacity-0"
          : "translate-x-0 opacity-100"
      }`}
    >
      <div className="flex items-start gap-3 p-3 pr-8">
        <div className={`flex-shrink-0 mt-0.5 ${iconColors[notification.type]}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {notification.title}
          </p>
          {notification.message && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
              {notification.message}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 transition-colors touch-target"
      >
        <X size={12} />
      </button>
      {/* Progress bar */}
      <div className="h-[2px] bg-gray-100 dark:bg-gray-700">
        <div
          className={`h-full ${progressColors[notification.type]} transition-all duration-50 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function NotificationToast() {
  const notifications = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-auto">
      {notifications.map((n) => (
        <ToastItem key={n.id} notification={n} />
      ))}
    </div>
  );
}
