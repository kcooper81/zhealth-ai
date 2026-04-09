"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search, GraduationCap, Users, TrendingUp } from "./icons";

interface Course {
  id: number;
  name: string;
  status: string;
  user_count?: number;
  slug?: string;
}

interface LMSPanelProps {
  onSelectCourse: (course: { id: number; name: string }) => void;
  selectedCourseId: number | null;
  accentColor: string;
  onQuickAction?: (action: string) => void;
}

export default function LMSPanel({
  onSelectCourse,
  selectedCourseId,
  accentColor,
  onQuickAction,
}: LMSPanelProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "draft">("all");
  const [stats, setStats] = useState<{
    total_courses: number;
    total_students: number;
    total_enrollments: number;
    total_orders: number;
  } | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [coursesRes, statsRes] = await Promise.all([
          fetch("/api/thinkific?action=courses&limit=50").then((r) =>
            r.ok ? r.json() : null
          ),
          fetch("/api/thinkific?action=overview").then((r) =>
            r.ok ? r.json() : null
          ),
        ]);

        if (coursesRes?.items) {
          setCourses(
            coursesRes.items.map((c: any) => ({
              id: c.id,
              name: c.name,
              status: c.status || "active",
              user_count: c.user_count || 0,
              slug: c.slug,
            }))
          );
        } else {
          setError("Could not load courses. Check your Thinkific API token.");
        }

        if (statsRes) {
          setStats(statsRes);
        }
      } catch {
        setError("Thinkific is not connected.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    let result = courses;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (filter === "active") {
      result = result.filter((c) => c.status === "published" || c.status === "active");
    } else if (filter === "draft") {
      result = result.filter((c) => c.status === "draft");
    }
    return result;
  }, [courses, search, filter]);

  const filters: { label: string; value: "all" | "active" | "draft" }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Draft", value: "draft" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8 text-center">
        <GraduationCap size={24} className="mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 text-center">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {stats.total_courses}
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">
              Courses
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 text-center">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {stats.total_students.toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">
              Students
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 text-center">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {stats.total_enrollments.toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">
              Enrollments
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 text-center">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {stats.total_orders.toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">
              Orders
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses..."
            className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 outline-none"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 px-3 pb-3">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
              filter === f.value
                ? "text-white"
                : "text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            style={filter === f.value ? { backgroundColor: accentColor } : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Course list */}
      <div className="flex-1 overflow-y-auto px-2">
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            No courses found
          </p>
        )}
        {filtered.map((course) => (
          <button
            key={course.id}
            onClick={() => onSelectCourse({ id: course.id, name: course.name })}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all mb-1 ${
              selectedCourseId === course.id
                ? "bg-gray-100 dark:bg-gray-800"
                : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
            }`}
            style={
              selectedCourseId === course.id
                ? { boxShadow: `inset 0 0 0 1px ${accentColor}40` }
                : undefined
            }
          >
            <GraduationCap
              size={16}
              className="flex-shrink-0 text-pink-500"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 truncate">
                {course.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    course.status === "published" || course.status === "active"
                      ? "bg-emerald-400"
                      : "bg-amber-400"
                  }`}
                />
                <span className="text-[11px] text-gray-400">
                  {course.user_count || 0} students
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Quick reports */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Quick Reports
        </p>
        <div className="flex flex-col gap-1">
          {[
            "Show course completion rates",
            "Revenue report this month",
            "Most popular courses",
          ].map((action) => (
            <button
              key={action}
              onClick={() => onQuickAction?.(action)}
              className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
            >
              <TrendingUp size={12} className="flex-shrink-0 text-pink-500" />
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
