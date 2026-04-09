import { useState, useEffect, useCallback, useRef } from "react";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration: number; // ms
  createdAt: number; // Date.now()
}

type Listener = (notifications: Notification[]) => void;

// ---------------------------------------------------------------------------
// Global notification store (event-based, no context needed)
// ---------------------------------------------------------------------------
let notifications: Notification[] = [];
const listeners = new Set<Listener>();

function emit() {
  const copy = [...notifications];
  listeners.forEach((fn) => fn(copy));
}

function addNotification(n: Notification) {
  // Max 3 visible
  notifications = [...notifications.slice(-(2)), n];
  emit();
}

function removeNotification(id: string) {
  notifications = notifications.filter((n) => n.id !== id);
  emit();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function notify(
  type: NotificationType,
  title: string,
  message?: string,
  duration = 4000
) {
  const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  addNotification({ id, type, title, message, duration, createdAt: Date.now() });
}

export function dismissNotification(id: string) {
  removeNotification(id);
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useNotifications(): Notification[] {
  const [state, setState] = useState<Notification[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const listener: Listener = (notifs) => {
      setState(notifs);

      // Set up auto-dismiss timers for new notifications
      for (const n of notifs) {
        if (!timersRef.current.has(n.id)) {
          const timer = setTimeout(() => {
            removeNotification(n.id);
            timersRef.current.delete(n.id);
          }, n.duration);
          timersRef.current.set(n.id, timer);
        }
      }

      // Clean up timers for removed notifications
      for (const [id, timer] of timersRef.current.entries()) {
        if (!notifs.find((n) => n.id === id)) {
          clearTimeout(timer);
          timersRef.current.delete(id);
        }
      }
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      // Clear all timers on unmount
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    removeNotification(id);
  }, []);

  return state;
}
