"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useClickOutside } from "@/lib/hooks";
import { Search, ChevronDown, X } from "./icons";

interface PageItem {
  id: number;
  title: string;
  status: "publish" | "draft" | "pending" | "private" | "trash";
  type: "page" | "post";
  modified?: string;
}

interface PageSelectorProps {
  pages: PageItem[];
  selectedPageId: number | null;
  onSelect: (pageId: number | null) => void;
  compact?: boolean;
}

const statusColors: Record<string, string> = {
  publish: "bg-emerald-400",
  draft: "bg-amber-400",
  pending: "bg-amber-400",
  private: "bg-gray-400",
  trash: "bg-red-400",
};

export default function PageSelector({
  pages,
  selectedPageId,
  onSelect,
  compact = false,
}: PageSelectorProps) {
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
  };

  const allFiltered = [...groupedPages.page, ...groupedPages.post];

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
