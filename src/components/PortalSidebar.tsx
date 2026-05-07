"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
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
} from "./icons";
import ModeSwitcher from "./portal/ModeSwitcher";
import SyncBadge from "./portal/SyncBadge";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  status?: "live" | "scaffold" | "soon";
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/portal", label: "Home", icon: Layers, status: "live" },
    ],
  },
  {
    title: "Reports",
    items: [
      { href: "/portal/reports/channels", label: "Channels", icon: Map, status: "live" },
      { href: "/portal/reports/landing-pages", label: "Landing pages", icon: Target, status: "live" },
      { href: "/portal/reports/courses", label: "Courses", icon: GraduationCap, status: "live" },
      { href: "/portal/reports/emails", label: "Emails", icon: Mail, status: "live" },
      { href: "/portal/reports/campaigns", label: "Campaigns", icon: Zap, status: "live" },
      { href: "/portal/reports/funnels", label: "Funnels", icon: Funnel, status: "live" },
    ],
  },
  {
    title: "Summaries",
    items: [
      { href: "/portal/reports/weekly", label: "Weekly", icon: BarChart, status: "live" },
    ],
  },
  {
    title: "Sources",
    items: [
      { href: "/portal/keap", label: "Keap CRM", icon: Users, status: "live" },
      { href: "/portal/thinkific", label: "Thinkific LMS", icon: Sparkles, status: "live" },
      { href: "/portal/wp", label: "WordPress site", icon: Globe, status: "live" },
      { href: "/portal/analytics", label: "GA4 analytics", icon: BarChart, status: "live" },
      { href: "/portal/customer-flows", label: "Customer flows", icon: Activity, status: "scaffold" },
    ],
  },
  {
    title: "Setup",
    items: [
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
    "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all";
  const activeStyle =
    "bg-white text-gray-900 shadow-sm ring-1 ring-black/[0.04] dark:bg-white/10 dark:text-gray-50 dark:ring-white/[0.04]";
  const pendingStyle = "bg-white/70 text-gray-900 dark:bg-white/[0.06] dark:text-gray-50";
  const idleStyle =
    "text-gray-700 hover:bg-white/60 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-gray-100";
  const disabled = "cursor-not-allowed text-gray-400 dark:text-gray-600";

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

export default function PortalSidebar() {
  const pathname = usePathname() || "";

  return (
    <aside className="flex h-screen w-64 flex-shrink-0 flex-col border-r border-gray-200/70 bg-gray-50/60 backdrop-blur-xl dark:border-white/5 dark:bg-[#161618]/80">
      <div className="flex items-center gap-2 px-4 pt-5 pb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://zhealtheducation.com/wp-content/uploads/2024/02/logo.svg"
          alt="Z-Health"
          className="h-5 w-auto dark:invert"
        />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Portal
        </span>
      </div>

      <ModeSwitcher tone="light" />

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-4">
            <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">
              {group.title}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={isActive(item.href, pathname)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <SyncBadge />

      <div className="border-t border-gray-200/70 px-4 py-2.5 text-[10px] tracking-wide text-gray-500 dark:border-white/5 dark:text-gray-500">
        Internal · @zhealth.net only
      </div>
    </aside>
  );
}
