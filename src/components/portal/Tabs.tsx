"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type Tab = {
  id: string;
  label: string;
  badge?: string | number;
};

const TabsContext = createContext<string>("");

type Props = {
  tabs: Tab[];
  defaultTab?: string;
  queryKey?: string;
  children?: React.ReactNode;
  className?: string;
};

export default function Tabs({
  tabs,
  defaultTab,
  queryKey = "tab",
  children,
  className = "",
}: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const initial = search.get(queryKey) || defaultTab || tabs[0]?.id || "";
  const [active, setActive] = useState<string>(initial);

  useEffect(() => {
    const fromQuery = search.get(queryKey);
    if (fromQuery && fromQuery !== active) setActive(fromQuery);
  }, [search, queryKey, active]);

  const handleClick = (id: string) => {
    setActive(id);
    const params = new URLSearchParams(Array.from(search.entries()));
    params.set(queryKey, id);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <TabsContext.Provider value={active}>
      <div className={className}>
        <div className="border-b border-gray-200/70 dark:border-white/5">
          <nav className="-mb-px flex gap-1 overflow-x-auto" role="tablist">
            {tabs.map((t) => {
              const isActive = t.id === active;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleClick(t.id)}
                  className={[
                    "group relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "text-gray-900 dark:text-gray-50"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
                  ].join(" ")}
                >
                  <span>{t.label}</span>
                  {t.badge !== undefined && (
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        isActive
                          ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                          : "bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-300",
                      ].join(" ")}
                    >
                      {t.badge}
                    </span>
                  )}
                  <span
                    className={[
                      "absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-transform",
                      isActive
                        ? "scale-x-100 bg-gray-900 dark:bg-gray-50"
                        : "scale-x-0 bg-transparent",
                    ].join(" ")}
                  />
                </button>
              );
            })}
          </nav>
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </TabsContext.Provider>
  );
}

export function TabPanel({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const active = useContext(TabsContext);
  if (id !== active) return null;
  return (
    <div role="tabpanel" className="animate-fade-in">
      {children}
    </div>
  );
}
