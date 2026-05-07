"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tone = "dark" | "light";

const MODES = [
  { id: "chat", label: "Chat", href: "/chat" },
  { id: "portal", label: "Portal", href: "/portal" },
] as const;

export default function ModeSwitcher({ tone = "light" }: { tone?: Tone }) {
  const pathname = usePathname() || "";
  const active = pathname.startsWith("/portal") ? "portal" : "chat";

  // Both portal and chat use a dark sidebar now — use the same dark
  // mode-switcher styling regardless of `tone` so they feel uniform.
  const trackBg = "bg-white/[0.06]";
  const inactiveText = "text-gray-400 hover:text-gray-100";
  const activeBg = "bg-white/[0.12] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]";

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
