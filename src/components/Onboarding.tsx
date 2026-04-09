"use client";

import React from "react";
import { useLocalStorage } from "@/lib/hooks";
import { Document, BarChart, Users, GraduationCap } from "./icons";

interface OnboardingProps {
  onComplete: () => void;
}

const capabilities = [
  {
    icon: Document,
    title: "Manage Your Website",
    description: "Create pages, edit content, SEO, and Elementor layouts",
  },
  {
    icon: Users,
    title: "CRM & Contacts",
    description: "Manage contacts, tags, campaigns, and pipeline in Keap",
  },
  {
    icon: GraduationCap,
    title: "LMS & Courses",
    description: "Manage courses, students, and enrollments in Thinkific",
  },
  {
    icon: BarChart,
    title: "Analytics & Reports",
    description: "Traffic data, reports, and performance insights",
  },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [seen, setSeen] = useLocalStorage("zhealth-onboarding-seen", false);

  if (seen) return null;

  const handleGetStarted = () => {
    setSeen(true);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md" />

      {/* Card */}
      <div className="relative bg-white dark:bg-[#2c2c2e] rounded-3xl shadow-2xl max-w-[520px] w-full p-6 md:p-8 animate-scale-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-blue to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-blue/20">
            <span className="text-white text-xl font-bold">Z</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Welcome to Z-Health AI
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Your intelligent assistant for managing the Z-Health Education website.
          </p>
        </div>

        {/* Capability grid */}
        <div className="grid grid-cols-2 gap-2 md:gap-3 mb-6 md:mb-8">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 hover:border-brand-blue/20 dark:hover:border-brand-blue/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-brand-blue/10 dark:bg-brand-blue/20 flex items-center justify-center mb-3">
                <cap.icon size={18} className="text-brand-blue" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                {cap.title}
              </h3>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">
                {cap.description}
              </p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={handleGetStarted}
            className="w-full py-3.5 bg-brand-blue text-white font-semibold rounded-xl hover:bg-blue-600 active:scale-[0.98] transition-all duration-200 shadow-sm shadow-brand-blue/20 touch-target min-h-[48px] text-base"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
