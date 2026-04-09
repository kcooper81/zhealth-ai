"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useClickOutside } from "@/lib/hooks";
import { Search, ChevronDown, X } from "./icons";

interface PageItem {
  id: number;
  title: string;
  status: "publish" | "draft" | "pending" | "private" | "trash";
  type: "page" | "post" | "popup";
  modified?: string;
}

interface PageSelectorProps {
  pages: PageItem[];
  selectedPageId: number | null;
  onSelect: (pageId: number | null) => void;
  compact?: boolean;
  mode?: "dropdown" | "list";
}

const statusColors: Record<string, string> = {
  publish: "bg-emerald-400",
  draft: "bg-amber-400",
  pending: "bg-amber-400",
  private: "bg-gray-400",
  trash: "bg-red-400",
};

const statusLabels: Record<string, string> = {
  publish: "Published",
  draft: "Draft",
  pending: "Pending",
  private: "Private",
  trash: "Trash",
};

type FilterType = "all" | "publish" | "draft" | "page" | "post" | "popup";

function formatRelativeDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function PageSelector({
  pages,
  selectedPageId,
  onSelect,
  compact = false,
  mode = "dropdown",
}: PageSelectorProps) {
  if (mode === "list") {
    return (
      <PageSelectorList
        pages={pages}
        selectedPageId={selectedPageId}
        onSelect={onSelect}
      />
    );
  }

  return (
    <PageSelectorDropdown
      pages={pages}
      selectedPageId={selectedPageId}
      onSelect={onSelect}
      compact={compact}
    />
  );
}

function PageSelectorList({
  pages,
  selectedPageId,
  onSelect,
}: {
  pages: PageItem[];
  selectedPageId: number | null;
  onSelect: (pageId: number | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredPages = useMemo(() => {
    let result = pages;

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.title.toLowerCase().includes(q));
    }

    // Filter pills
    switch (filter) {
      case "publish":
        result = result.filter((p) => p.status === "publish");
        break;
      case "draft":
        result = result.filter((p) => p.status === "draft" || p.status === "pending");
        break;
      case "page":
        result = result.filter((p) => p.type === "page");
        break;
      case "post":
        result = result.filter((p) => p.type === "post");
        break;
      case "popup":
        result = result.filter((p) => p.type === "popup");
        break;
    }

    return result;
  }, [pages, search, filter]);

  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Published", value: "publish" },
    { label: "Draft", value: "draft" },
    { label: "Pages", value: "page" },
    { label: "Posts", value: "post" },
    { label: "Popups", value: "popup" },
  ];

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
            placeholder="Search pages and posts..."
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
                  ? "bg-brand-blue text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Page list */}
      <div className="flex-1 overflow-y-auto px-2">
        {/* Clear selection option */}
        {selectedPageId !== null && (
          <button
            onClick={() => onSelect(null)}
            className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors mb-0.5"
          >
            <X size={12} />
            <span>Clear selection</span>
          </button>
        )}

        {filteredPages.map((page) => (
          <button
            key={page.id}
            onClick={() => onSelect(page.id)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left transition-all duration-200 mb-0.5 ${
              page.id === selectedPageId
                ? "bg-brand-blue/[0.08] ring-1 ring-brand-blue/20"
                : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
            }`}
          >
            {/* Status dot */}
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[page.status]}`}
            />

            {/* Title and meta */}
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium truncate ${
                  page.id === selectedPageId
                    ? "text-brand-blue"
                    : "text-gray-800 dark:text-gray-200"
                }`}
              >
                {page.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-gray-400 dark:text-gray-500 capitalize">
                  {page.type}
                </span>
                <span className="text-[10px] text-gray-300 dark:text-gray-600">
                  |
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  {statusLabels[page.status] || page.status}
                </span>
              </div>
            </div>

            {/* Modified date */}
            {page.modified && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                {formatRelativeDate(page.modified)}
              </span>
            )}
          </button>
        ))}

        {filteredPages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
              No pages found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PageSelectorDropdown({
  pages,
  selectedPageId,
  onSelect,
  compact,
}: {
  pages: PageItem[];
  selectedPageId: number | null;
  onSelect: (pageId: number | null) => void;
  compact: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [focusIndex, setFocusIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  const filteredPages = pages.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const groupedPages = {
    page: filteredPages.filter((p) => p.type === "page"),
    post: filteredPages.filter((p) => p.type === "post"),
    popup: filteredPages.filter((p) => p.type === "popup"),
  };

  const allFiltered = [...groupedPages.page, ...groupedPages.post, ...groupedPages.popup];

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((i) => Math.min(i + 1, allFiltered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && focusIndex >= 0) {
        e.preventDefault();
        onSelect(allFiltered[focusIndex].id);
        setIsOpen(false);
        setSearch("");
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    },
    [allFiltered, focusIndex, onSelect]
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-2 text-left transition-colors duration-200 ${
          compact
            ? "px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
            : "px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
        }`}
      >
        {selectedPage ? (
          <>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[selectedPage.status]}`} />
            <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">
              {selectedPage.title}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm text-gray-400 dark:text-gray-500">Select a page...</span>
            <ChevronDown size={14} className="text-gray-400" />
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden animate-scale-in"
          onKeyDown={handleKeyDown}
        >
          {/* Search */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-1.5">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setFocusIndex(-1);
                }}
                placeholder="Search..."
                className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 outline-none"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto py-1">
            {/* None option */}
            <button
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
                setSearch("");
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              None -- create new
            </button>

            {groupedPages.page.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Pages
                </div>
                {groupedPages.page.map((page) => {
                  const idx = allFiltered.indexOf(page);
                  return (
                    <PageRow
                      key={page.id}
                      page={page}
                      isFocused={idx === focusIndex}
                      isSelected={page.id === selectedPageId}
                      onClick={() => {
                        onSelect(page.id);
                        setIsOpen(false);
                        setSearch("");
                      }}
                    />
                  );
                })}
              </>
            )}

            {groupedPages.post.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Posts
                </div>
                {groupedPages.post.map((page) => {
                  const idx = allFiltered.indexOf(page);
                  return (
                    <PageRow
                      key={page.id}
                      page={page}
                      isFocused={idx === focusIndex}
                      isSelected={page.id === selectedPageId}
                      onClick={() => {
                        onSelect(page.id);
                        setIsOpen(false);
                        setSearch("");
                      }}
                    />
                  );
                })}
              </>
            )}

            {groupedPages.popup.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Popups
                </div>
                {groupedPages.popup.map((page) => {
                  const idx = allFiltered.indexOf(page);
                  return (
                    <PageRow
                      key={page.id}
                      page={page}
                      isFocused={idx === focusIndex}
                      isSelected={page.id === selectedPageId}
                      onClick={() => {
                        onSelect(page.id);
                        setIsOpen(false);
                        setSearch("");
                      }}
                    />
                  );
                })}
              </>
            )}

            {allFiltered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-gray-400 dark:text-gray-500">
                No pages found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PageRow({
  page,
  isFocused,
  isSelected,
  onClick,
}: {
  page: PageItem;
  isFocused: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
        isFocused
          ? "bg-brand-blue/10 dark:bg-brand-blue/20"
          : isSelected
          ? "bg-gray-50 dark:bg-gray-700/30"
          : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
      }`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[page.status]}`} />
      <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">{page.title}</span>
      {page.modified && (
        <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
          {new Date(page.modified).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      )}
    </button>
  );
}
