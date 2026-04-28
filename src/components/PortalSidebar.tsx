"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers,
  Activity,
  Users,
  Globe,
  BarChart,
  Sparkles,
} from "./icons";
import ModeSwitcher from "./portal/ModeSwitcher";

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
  { href: "/portal/wp", label: "WordPress site", icon: Globe, status: "live" },
  { href: "/portal/analytics", label: "Analytics", icon: BarChart, status: "soon" },
];

function statusDot(status?: NavItem["status"]) {
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
  const isSoon = item.status === "soon";
  const base =
    "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all";
  const activeStyle =
    "bg-white text-gray-900 shadow-sm ring-1 ring-black/[0.04] dark:bg-white/10 dark:text-gray-50 dark:ring-white/[0.04]";
  const idleStyle =
    "text-gray-700 hover:bg-white/60 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-gray-100";
  const disabled = "cursor-not-allowed text-gray-400 dark:text-gray-600";

  const content = (
    <>
      <Icon size={16} className="flex-shrink-0" />
      <span className="flex-1 truncate font-medium tracking-tight">{item.label}</span>
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
        <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">
          Workspaces
        </div>
        <ul className="space-y-0.5">
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
      </nav>

      <div className="border-t border-gray-200/70 px-4 py-3 text-[10px] tracking-wide text-gray-500 dark:border-white/5 dark:text-gray-500">
        Internal · @zhealth.net only
      </div>
    </aside>
  );
}
