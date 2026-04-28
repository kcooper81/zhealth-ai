"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tone = "dark" | "light";

const MODES = [
  { id: "chat", label: "Chat", href: "/" },
  { id: "portal", label: "Portal", href: "/portal" },
] as const;

export default function ModeSwitcher({ tone = "light" }: { tone?: Tone }) {
  const pathname = usePathname() || "";
  const active = pathname.startsWith("/portal") ? "portal" : "chat";

  const trackBg =
    tone === "dark"
      ? "bg-white/5"
      : "bg-gray-100/80 dark:bg-white/5";
  const inactiveText =
    tone === "dark"
      ? "text-gray-400 hover:text-gray-100"
      : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100";
  const activeBg =
    tone === "dark"
      ? "bg-white text-gray-900"
      : "bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-gray-50";

  return (
    <div
      role="tablist"
      aria-label="App mode"
      className={`mx-3 my-2 inline-flex w-[calc(100%-1.5rem)] rounded-xl p-1 ${trackBg}`}
    >
      {MODES.map((m) => {
        const isActive = m.id === active;
        return (
          <Link
            key={m.id}
            href={m.href}
            role="tab"
            aria-selected={isActive}
            className={[
              "flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-medium transition-all",
              isActive ? activeBg : inactiveText,
            ].join(" ")}
          >
            {m.label}
          </Link>
        );
      })}
    </div>
  );
}
