"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import {
  Layers,
  Activity,
  Users,
  Globe,
  BarChart,
  Sparkles,
  Mail,
  Target,
  Funnel,
  Map,
  GraduationCap,
  Settings,
  FileText,
  Zap,
  Search,
  AIBrain,
  ChevronDown,
  TrendingUp,
} from "./icons";
import ModeSwitcher from "./portal/ModeSwitcher";
import SyncBadge from "./portal/SyncBadge";
import UserMenu from "./portal/UserMenu";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  status?: "live" | "scaffold" | "soon";
};

type NavGroup = {
  title: string;
  items: NavItem[];
  /** When true, group renders collapsed by default. */
  defaultCollapsed?: boolean;
};

const NAV_GROUPS: NavGroup[] = [
  // No group header — top-level dashboard pages, always visible
  {
    title: "",
    items: [
      { href: "/portal", label: "Home", icon: Layers, status: "live" },
      { href: "/portal/reports/weekly", label: "Weekly digest", icon: FileText, status: "live" },
    ],
  },
  {
    title: "Reports",
    items: [
      { href: "/portal/reports/funnels", label: "Funnels", icon: Funnel, status: "live" },
      { href: "/portal/reports/channels", label: "Channels", icon: Map, status: "live" },
      { href: "/portal/reports/landing-pages", label: "Landing pages", icon: Target, status: "live" },
      { href: "/portal/reports/courses", label: "Courses", icon: GraduationCap, status: "live" },
      { href: "/portal/reports/emails", label: "Emails", icon: Mail, status: "live" },
      { href: "/portal/reports/campaigns", label: "Campaigns", icon: Zap, status: "live" },
      { href: "/portal/seo", label: "SEO health", icon: Search, status: "live" },
      { href: "/portal/gsc", label: "Search rankings", icon: TrendingUp, status: "live" },
    ],
  },
  {
    title: "Data sources",
    defaultCollapsed: true,
    items: [
      { href: "/portal/keap", label: "Keap (CRM)", icon: Users, status: "live" },
      { href: "/portal/thinkific", label: "Thinkific (LMS)", icon: Sparkles, status: "live" },
      { href: "/portal/wp", label: "WordPress", icon: Globe, status: "live" },
      { href: "/portal/analytics", label: "Google Analytics", icon: BarChart, status: "live" },
      { href: "/portal/customer-flows", label: "Customer journeys", icon: Activity, status: "scaffold" },
    ],
  },
  {
    title: "Workspace",
    defaultCollapsed: true,
    items: [
      { href: "/chat", label: "AI chat", icon: AIBrain, status: "live" },
      { href: "/portal/reports/setup", label: "Tracking setup", icon: Settings, status: "live" },
    ],
  },
];

function statusDot(status?: NavItem["status"], pending?: boolean) {
  if (pending) {
    return (
      <span className="relative flex h-2 w-2" title="Loading…">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-blue opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-blue" />
      </span>
    );
  }
  if (!status) return null;
  const cls = {
    live: "bg-emerald-500",
    scaffold: "bg-amber-500",
    soon: "bg-gray-300 dark:bg-gray-600",
  }[status];
  const title = { live: "Live data", scaffold: "Scaffold", soon: "Coming soon" }[status];
  return <span className={`h-1.5 w-1.5 rounded-full ${cls}`} title={title} />;
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isSoon = item.status === "soon";

  const base =
    "group flex items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] transition-all";
  const activeStyle =
    "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]";
  const pendingStyle = "bg-white/[0.04] text-white";
  const idleStyle =
    "text-gray-400 hover:bg-white/[0.04] hover:text-gray-100";
  const disabled = "cursor-not-allowed text-gray-600";

  const content = (
    <>
      <Icon size={16} className="flex-shrink-0" />
      <span className="flex-1 truncate font-medium tracking-tight">{item.label}</span>
      {statusDot(item.status, isPending)}
    </>
  );

  if (isSoon) {
    return (
      <span className={`${base} ${disabled}`} title="Coming soon">
        {content}
      </span>
    );
  }

  const stateClass = active ? activeStyle : isPending ? pendingStyle : idleStyle;

  // Use a custom click handler that wraps router.push in startTransition.
  // This makes isPending light up the moment the user clicks, regardless of
  // how long the new page takes to server-render — instant visual feedback.
  return (
    <Link
      href={item.href}
      prefetch
      onClick={(e) => {
        // Allow modifier-key opens (cmd/ctrl-click for new tab)
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        startTransition(() => {
          router.push(item.href);
        });
      }}
      className={`${base} ${stateClass}`}
    >
      {content}
    </Link>
  );
}

function isActive(href: string, pathname: string): boolean {
  if (href === "/portal") return pathname === "/portal";
  return pathname === href || pathname.startsWith(href + "/");
}

const COLLAPSE_STORAGE_KEY = "zh-sidebar-collapsed";

function loadCollapseState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export default function PortalSidebar() {
  const pathname = usePathname() || "";
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount, falling back to defaultCollapsed.
  useEffect(() => {
    const stored = loadCollapseState();
    const next: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) {
      next[g.title] = stored[g.title] ?? g.defaultCollapsed ?? false;
    }
    setCollapsed(next);
    setHydrated(true);
  }, []);

  // Persist on change (skip the initial hydration write)
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(collapsed));
    } catch {}
  }, [collapsed, hydrated]);

  const toggleGroup = (title: string) => {
    setCollapsed((c) => ({ ...c, [title]: !c[title] }));
  };

  return (
    <aside className="flex h-screen w-64 flex-shrink-0 flex-col bg-[#1a1b2e] text-gray-200">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://zhealtheducation.com/wp-content/uploads/2024/02/logo.svg"
          alt="Z-Health"
          className="h-5 w-auto invert"
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
          Portal
        </span>
      </div>

      <ModeSwitcher tone="light" />

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {NAV_GROUPS.map((group) => {
          const groupHasActive = group.items.some((it) => isActive(it.href, pathname));
          // If any item in the group is active, force the group open even if collapsed
          const isCollapsed = (collapsed[group.title] ?? group.defaultCollapsed ?? false) && !groupHasActive;
          const isCollapsible = (group.items.length > 1) || group.defaultCollapsed;

          return (
            <div key={group.title} className="mb-4">
              {group.title && isCollapsible ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  className="mb-1 flex w-full items-center justify-between px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-gray-500 hover:text-gray-300"
                >
                  <span>{group.title}</span>
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                  />
                </button>
              ) : group.title ? (
                <div className="mb-1 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-gray-500">
                  {group.title}
                </div>
              ) : null}
              {!isCollapsed && (
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <NavLink item={item} active={isActive(item.href, pathname)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <SyncBadge />

      <UserMenu />
    </aside>
  );
}
