"use client";

import { useState } from "react";
import { ClipboardCopy, Check } from "@/components/icons";

type Props = {
  code: string;
  language?: string;
  filename?: string;
};

/**
 * Read-only code block with a copy-to-clipboard button. Used on /portal/reports/setup
 * so the team can paste snippets into GTM, Thinkific, or wp-content/mu-plugins.
 */
export default function CodeBlock({ code, language, filename }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — older browsers or denied permission
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200/70 bg-gray-950 text-gray-100 shadow-sm dark:border-white/10">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
        <span>
          {filename ? <span className="text-gray-300">{filename}</span> : null}
          {filename && language ? <span className="mx-2 text-gray-600">·</span> : null}
          {language ? <span>{language}</span> : null}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-gray-200 transition-colors hover:bg-white/10"
        >
          {copied ? (
            <>
              <Check size={11} className="text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <ClipboardCopy size={11} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
