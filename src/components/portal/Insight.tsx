type Severity = "info" | "good" | "warn" | "alert";

const STYLES: Record<Severity, { ring: string; icon: string; text: string; emoji: string }> = {
  info: {
    ring: "ring-blue-200 dark:ring-blue-900/40",
    icon: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    text: "text-blue-900 dark:text-blue-200",
    emoji: "💡",
  },
  good: {
    ring: "ring-emerald-200 dark:ring-emerald-900/40",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    text: "text-emerald-900 dark:text-emerald-200",
    emoji: "✓",
  },
  warn: {
    ring: "ring-amber-200 dark:ring-amber-900/40",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    text: "text-amber-900 dark:text-amber-200",
    emoji: "⚠",
  },
  alert: {
    ring: "ring-rose-200 dark:ring-rose-900/40",
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    text: "text-rose-900 dark:text-rose-200",
    emoji: "!",
  },
};

export default function Insight({
  severity = "info",
  title,
  children,
}: {
  severity?: Severity;
  title: string;
  children?: React.ReactNode;
}) {
  const s = STYLES[severity];
  return (
    <div
      className={`rounded-xl bg-white/80 p-4 shadow-sm ring-1 ${s.ring} backdrop-blur dark:bg-[#1f1f22]/80`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${s.icon}`}
          aria-hidden
        >
          {s.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-semibold ${s.text}`}>{title}</div>
          {children && (
            <div className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function InsightGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>;
}
