"use client";

import React, { useState } from "react";
import { useLocalStorage } from "@/lib/hooks";
import { Document, Globe, BarChart, Zap } from "./icons";

interface OnboardingProps {
  onComplete: () => void;
}

const capabilities = [
  {
    icon: Document,
    title: "Build Pages",
    description: "Describe and edit WordPress pages with AI assistance",
  },
  {
    icon: Globe,
    title: "Manage Content",
    description: "Posts, products, media -- all from a single chat",
  },
  {
    icon: BarChart,
    title: "SEO & Analytics",
    description: "Optimize your site for search engines automatically",
  },
  {
    icon: Zap,
    title: "Automate",
    description: "Workflows and bulk operations at scale",
  },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [seen, setSeen] = useLocalStorage("zhealth-onboarding-seen", false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (seen) return null;

  const handleGetStarted = () => {
    if (dontShowAgain) {
      setSeen(true);
    }
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md" />

      {/* Card */}
      <div className="relative bg-white dark:bg-[#2c2c2e] rounded-3xl shadow-2xl max-w-[520px] w-full p-8 animate-scale-in">
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
        <div className="grid grid-cols-2 gap-3 mb-8">
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
            className="w-full py-3 bg-brand-blue text-white font-semibold rounded-xl hover:bg-blue-600 active:scale-[0.98] transition-all duration-200 shadow-sm shadow-brand-blue/20"
          >
            Get Started
          </button>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-blue focus:ring-brand-blue/30 bg-transparent"
            />
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Don&apos;t show this again
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
