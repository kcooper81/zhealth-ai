"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Search, X, Users, ChevronRight, BarChart, Activity, Loader } from "./icons";

interface Contact {
  id: number;
  name: string;
  email: string;
  tagCount: number;
}

interface Tag {
  id: number;
  name: string;
  count: number;
}

type FilterType = "all" | "tagged" | "recent";

const CRM_QUICK_REPORTS = [
  {
    id: "contact-growth",
    label: "Contact Overview",
    icon: Users,
    prompt: "Show a contact overview report with names, emails, tags, and creation dates",
  },
  {
    id: "tag-breakdown",
    label: "Tag Breakdown",
    icon: BarChart,
    prompt: "Show a tag breakdown report with all tags and their categories",
  },
  {
    id: "revenue",
    label: "Revenue Report",
    icon: Activity,
    prompt: "Show a revenue report for the last 30 days with orders and totals",
  },
  {
    id: "pipeline",
    label: "Pipeline Status",
    icon: BarChart,
    prompt: "Show the current pipeline status with all opportunities and projected revenue",
  },
  {
    id: "emails",
    label: "Email Activity",
    icon: Activity,
    prompt: "Show email send activity for the last 30 days with subjects and recipients",
  },
];

interface CRMPanelProps {
  onSelectContact: (contact: { id: number; name: string; email: string }) => void;
  selectedContactId: number | null;
  accentColor: string;
  onQuickAction?: (action: string) => void;
}

export default function CRMPanel({
  onSelectContact,
  selectedContactId,
  accentColor,
  onQuickAction,
}: CRMPanelProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState<{ totalContacts: number; totalTags: number; openDeals: number; pipelineValue: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Normalize raw API contacts into our Contact shape
  const normalizeContacts = useCallback((rawContacts: Record<string, unknown>[]): Contact[] => {
    return rawContacts.map((c) => ({
      id: c.id as number,
      name:
        ((c.given_name || c.first_name || "") as string) +
        " " +
        ((c.family_name || c.last_name || "") as string).trim() ||
        (c.name as string) ||
        "Unknown",
      email:
        (c.email_address as string) ||
        (Array.isArray(c.email_addresses) && c.email_addresses.length > 0
          ? (c.email_addresses[0] as Record<string, unknown>).email as string
          : "") ||
        (c.email as string) ||
        "",
      tagCount: Array.isArray(c.tag_ids)
        ? c.tag_ids.length
        : typeof c.tagCount === "number"
        ? c.tagCount
        : 0,
    }));
  }, []);

  // Fetch default contacts and stats on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetch("/api/keap?action=contacts&limit=30").then((res) => res.ok ? res.json() : { contacts: [], tags: [] }),
      fetch("/api/keap?action=contacts&limit=1").then((res) => res.ok ? res.json() : { count: 0 }).catch(() => ({ count: 0 })),
      fetch("/api/keap?action=tags&limit=1").then((res) => res.ok ? res.json() : { count: 0 }).catch(() => ({ count: 0 })),
      fetch("/api/keap?action=opportunities&limit=1").then((res) => res.ok ? res.json() : { opportunities: [], count: 0 }).catch(() => ({ opportunities: [], count: 0 })),
    ]).then(([data, contactStats, tagStats, oppStats]) => {
      if (cancelled) return;
      const rawContacts = Array.isArray(data.contacts)
        ? data.contacts
        : Array.isArray(data)
        ? data
        : [];
      setContacts(normalizeContacts(rawContacts));
      if (data.tags && Array.isArray(data.tags)) {
        setTags(
          data.tags.slice(0, 15).map((t: Record<string, unknown>) => ({
            id: t.id as number,
            name: t.name as string,
            count: (t.count as number) || 0,
          }))
        );
      }
      const opps = oppStats.opportunities || [];
      const pipelineValue = opps.reduce((sum: number, o: any) => sum + (o.projected_revenue_high || 0), 0);
      setStats({
        totalContacts: contactStats.count || 0,
        totalTags: tagStats.count || 0,
        openDeals: oppStats.count || 0,
        pipelineValue,
      });
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [normalizeContacts]);

  // Debounced server-side search when user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const query = search.trim();
    if (!query) {
      // Reset to default contacts when search is cleared
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const encodedQuery = encodeURIComponent(query);
        const [emailRes, nameRes] = await Promise.all([
          fetch(`/api/keap?action=contacts&email=${encodedQuery}&limit=30`).then((r) => r.ok ? r.json() : { contacts: [] }),
          fetch(`/api/keap?action=contacts&name=${encodedQuery}&limit=30`).then((r) => r.ok ? r.json() : { contacts: [] }),
        ]);

        const emailContacts = Array.isArray(emailRes.contacts) ? emailRes.contacts : [];
        const nameContacts = Array.isArray(nameRes.contacts) ? nameRes.contacts : [];

        // Merge and deduplicate by ID
        const seen = new Set<number>();
        const merged: Record<string, unknown>[] = [];
        for (const c of [...nameContacts, ...emailContacts]) {
          const id = c.id as number;
          if (!seen.has(id)) {
            seen.add(id);
            merged.push(c);
          }
        }

        setContacts(normalizeContacts(merged));
      } catch {
        // Keep current contacts on error
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, normalizeContacts]);

  const filtered = useMemo(() => {
    let result = contacts;
    // Client-side filtering is only applied for filter pills, not for the search
    // (search is now server-side)
    switch (filter) {
      case "tagged":
        result = result.filter((c) => c.tagCount > 0);
        break;
      case "recent":
        result = result.slice(0, 10);
        break;
    }
    return result;
  }, [contacts, filter]);

  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Tagged", value: "tagged" },
    { label: "Recent", value: "recent" },
  ];

  const handleClearSelection = useCallback(() => {
    onSelectContact({ id: 0, name: "", email: "" });
  }, [onSelectContact]);

  return (
    <div className="flex flex-col h-full">
      {/* Stats overview */}
      {stats && (
        <div className="grid grid-cols-2 gap-2 px-3 pb-2">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-2.5 py-2">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Contacts</p>
            <p className="text-[17px] font-semibold text-gray-900 dark:text-gray-100 leading-tight mt-0.5">{stats.totalContacts.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-2.5 py-2">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Tags</p>
            <p className="text-[17px] font-semibold text-gray-900 dark:text-gray-100 leading-tight mt-0.5">{stats.totalTags.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-2.5 py-2">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Open Deals</p>
            <p className="text-[17px] font-semibold text-gray-900 dark:text-gray-100 leading-tight mt-0.5">{stats.openDeals.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-2.5 py-2">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Pipeline Value</p>
            <p className="text-[17px] font-semibold text-gray-900 dark:text-gray-100 leading-tight mt-0.5">${stats.pipelineValue > 0 ? "$" + stats.pipelineValue.toLocaleString() : "$0"}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#2c2c2e] rounded-lg px-3 py-2">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="px-3 pb-2">
        <div className="flex gap-1 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                filter === f.value
                  ? "text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
              style={
                filter === f.value
                  ? { backgroundColor: accentColor }
                  : undefined
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts list */}
      <div className="flex-1 overflow-y-auto px-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-gray-200 dark:border-gray-700 border-t-gray-400 dark:border-t-gray-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && searching && (
          <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-gray-400 dark:text-gray-500">
            <Loader size={12} className="animate-spin" />
            <span>Searching...</span>
          </div>
        )}

        {!loading && selectedContactId !== null && selectedContactId !== 0 && (
          <button
            onClick={handleClearSelection}
            className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors mb-0.5"
          >
            <X size={12} />
            <span>Clear selection</span>
          </button>
        )}

        {!loading &&
          filtered.map((contact) => (
            <button
              key={contact.id}
              onClick={() =>
                onSelectContact({
                  id: contact.id,
                  name: contact.name,
                  email: contact.email,
                })
              }
              className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left transition-all duration-200 mb-0.5 ${
                contact.id === selectedContactId
                  ? "ring-1 ring-opacity-20"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
              style={
                contact.id === selectedContactId
                  ? {
                      backgroundColor: `${accentColor}0d`,
                      boxShadow: `inset 0 0 0 1px ${accentColor}40`,
                    }
                  : undefined
              }
            >
              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[11px] font-semibold"
                style={{ backgroundColor: `${accentColor}60` }}
              >
                {contact.name.charAt(0).toUpperCase()}
              </div>

              {/* Name and email */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium truncate ${
                    contact.id === selectedContactId
                      ? ""
                      : "text-gray-800 dark:text-gray-200"
                  }`}
                  style={
                    contact.id === selectedContactId
                      ? { color: accentColor }
                      : undefined
                  }
                >
                  {contact.name}
                </p>
                {contact.email && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                    {contact.email}
                  </p>
                )}
              </div>

              {/* Tag count */}
              {contact.tagCount > 0 && (
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-full px-1.5 py-0.5 flex-shrink-0">
                  {contact.tagCount} tags
                </span>
              )}
            </button>
          ))}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <Users
              size={24}
              className="text-gray-300 dark:text-gray-600 mb-2"
            />
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
              {contacts.length === 0
                ? "No contacts loaded"
                : "No contacts match your search"}
            </p>
          </div>
        )}
      </div>

      {/* Quick reports */}
      {onQuickAction && (
        <div className="px-3 pt-2 pb-2 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
            Quick Reports
          </p>
          <div className="space-y-0.5">
            {CRM_QUICK_REPORTS.map((report) => {
              const Icon = report.icon;
              return (
                <button
                  key={report.id}
                  onClick={() => onQuickAction(report.prompt)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-700/50 group touch-target"
                >
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${accentColor}12` }}
                  >
                    <Icon size={12} className="text-amber-500" />
                  </span>
                  <span className="flex-1 text-[12px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
                    {report.label}
                  </span>
                  <ChevronRight size={11} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tags section */}
      {!loading && tags.length > 0 && (
        <div className="px-3 pt-2 pb-2 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
            Top Tags
          </p>
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
              >
                {tag.name}
                {tag.count > 0 && (
                  <span className="text-gray-300 dark:text-gray-600">
                    {tag.count}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
