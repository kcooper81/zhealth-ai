"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Search, X, Users } from "./icons";

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

type FilterType = "all" | "tagged" | "recent" | "pipeline";

interface CRMPanelProps {
  onSelectContact: (contact: { id: number; name: string; email: string }) => void;
  selectedContactId: number | null;
  accentColor: string;
}

export default function CRMPanel({
  onSelectContact,
  selectedContactId,
  accentColor,
}: CRMPanelProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch contacts
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/keap?action=contacts&limit=30")
      .then((res) => (res.ok ? res.json() : { contacts: [], tags: [] }))
      .then((data) => {
        if (cancelled) return;
        // Normalize response
        const rawContacts = Array.isArray(data.contacts)
          ? data.contacts
          : Array.isArray(data)
          ? data
          : [];
        setContacts(
          rawContacts.map((c: Record<string, unknown>) => ({
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
          }))
        );
        if (data.tags && Array.isArray(data.tags)) {
          setTags(
            data.tags.slice(0, 15).map((t: Record<string, unknown>) => ({
              id: t.id as number,
              name: t.name as string,
              count: (t.count as number) || 0,
            }))
          );
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let result = contacts;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      );
    }
    switch (filter) {
      case "tagged":
        result = result.filter((c) => c.tagCount > 0);
        break;
      case "recent":
        result = result.slice(0, 10);
        break;
      case "pipeline":
        // Pipeline filter - show all for now, could be refined with real pipeline data
        break;
    }
    return result;
  }, [contacts, search, filter]);

  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Tagged", value: "tagged" },
    { label: "Recent", value: "recent" },
    { label: "Pipeline", value: "pipeline" },
  ];

  const handleClearSelection = useCallback(() => {
    onSelectContact({ id: 0, name: "", email: "" });
  }, [onSelectContact]);

  return (
    <div className="flex flex-col h-full">
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
                      ringColor: accentColor,
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
