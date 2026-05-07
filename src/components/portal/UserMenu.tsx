"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { LogOut, ChevronUp, Mail } from "@/components/icons";

/**
 * Bottom-of-sidebar user menu — shows the signed-in user's avatar + email,
 * with a popover that has Sign out. Modeled on Linear / Vercel / Notion's
 * sidebar account widgets.
 */
export default function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (status === "loading") {
    return (
      <div className="border-t border-gray-200/70 px-3 py-2.5 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 animate-pulse rounded-full bg-gray-200/70 dark:bg-white/5" />
          <div className="h-3 flex-1 animate-pulse rounded bg-gray-200/70 dark:bg-white/5" />
        </div>
      </div>
    );
  }

  if (!session?.user) return null;

  const email = session.user.email || "";
  const name = session.user.name || email.split("@")[0] || "User";
  const image = (session.user as any).image as string | undefined;
  const initial = (name || email)[0]?.toUpperCase() || "?";

  return (
    <div ref={wrapperRef} className="relative border-t border-gray-200/70 dark:border-white/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-100/60 dark:hover:bg-white/[0.03]"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name} className="h-7 w-7 flex-shrink-0 rounded-full ring-1 ring-black/5 dark:ring-white/10" />
        ) : (
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-xs font-semibold text-white">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">{name}</div>
          <div className="truncate text-[10px] text-gray-500 dark:text-gray-400">{email}</div>
        </div>
        <ChevronUp size={12} className={`text-gray-400 transition-transform ${open ? "" : "rotate-180"}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-2 right-2 mb-1 overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-xl ring-1 ring-black/5 dark:border-white/10 dark:bg-[#1f1f22] dark:ring-white/10 animate-fade-in"
        >
          <div className="border-b border-gray-200/70 px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 dark:border-white/5 dark:text-gray-400">
            Signed in as
          </div>
          <div className="flex items-center gap-2 px-3 py-2 text-xs">
            <Mail size={12} className="flex-shrink-0 text-gray-500" />
            <span className="truncate text-gray-900 dark:text-gray-100">{email}</span>
          </div>
          <div className="border-t border-gray-200/70 dark:border-white/5">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
