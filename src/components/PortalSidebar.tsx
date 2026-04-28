"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers,
  Activity,
  Users,
  Globe,
  BarChart,
  MessageSquare,
  Settings,
  PanelLeft,
  Sparkles,
} from "./icons";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  status?: "live" | "scaffold" | "soon";
};

const PORTAL_ITEMS: NavItem[] = [
  { href: "/portal", label: "Overview", icon: Layers, status: "live" },
  { href: "/portal/customer-flows", label: "Customer Flows", icon: Activity, status: "scaffold" },
  { href: "/portal/keap", label: "Keap CRM", icon: Users, status: "live" },
  { href: "/portal/thinkific", label: "Thinkific LMS", icon: Sparkles, status: "live" },
  { href: "/portal/wp", label: "WordPress site", icon: Globe, status: "soon" },
  { href: "/portal/analytics", label: "Analytics", icon: BarChart, status: "soon" },
];

const TOOL_ITEMS: NavItem[] = [
  { href: "/", label: "Chat", icon: MessageSquare },
];

function statusDot(status?: NavItem["status"]) {
  if (!status) return null;
  const cls = {
    live: "bg-green-500",
    scaffold: "bg-yellow-500",
    soon: "bg-gray-400 dark:bg-gray-600",
  }[status];
  const title = { live: "Live data", scaffold: "Scaffold (no live data yet)", soon: "Coming soon" }[status];
  return <span className={`h-1.5 w-1.5 rounded-full ${cls}`} title={title} />;
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const isSoon = item.status === "soon";
  const base =
    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors";
  const activeStyle = "bg-gray-200 text-gray-900 dark:bg-white/10 dark:text-gray-100";
  const idleStyle =
    "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-gray-100";
  const disabled = "cursor-not-allowed text-gray-400 dark:text-gray-600";

  const content = (
    <>
      <Icon size={16} className="flex-shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {statusDot(item.status)}
    </>
  );

  if (isSoon) {
    return (
      <span className={`${base} ${disabled}`} title="Coming soon">
        {content}
      </span>
    );
  }

  return (
    <Link href={item.href} className={`${base} ${active ? activeStyle : idleStyle}`}>
      {content}
    </Link>
  );
}

export default function PortalSidebar() {
  const pathname = usePathname() || "";

  return (
    <aside className="flex h-screen w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-[#161618]">
      <div className="flex items-center gap-2 px-4 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <PanelLeft size={16} className="text-brand-blue" />
        Z-Health Portal
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">
          Portal
        </div>
        <ul className="mb-4 space-y-0.5">
          {PORTAL_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                active={
                  item.href === "/portal"
                    ? pathname === "/portal"
                    : pathname.startsWith(item.href)
                }
              />
            </li>
          ))}
        </ul>

        <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">
          Tools
        </div>
        <ul className="space-y-0.5">
          {TOOL_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={false} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-gray-200 px-4 py-3 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-500">
        <div className="flex items-center gap-2">
          <Settings size={12} />
          <span>Internal — @zhealth.net only</span>
        </div>
      </div>
    </aside>
  );
}
