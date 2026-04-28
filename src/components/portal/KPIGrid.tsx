type KPI = {
  label: string;
  value: string | number;
  hint?: string;
  trend?: { value: number; positive?: boolean };
};

type Accent = "neutral" | "blue" | "green" | "amber" | "purple" | "rose";

const ACCENTS: Record<Accent, string> = {
  neutral:
    "from-white to-gray-50/50 dark:from-[#1f1f22] dark:to-[#1a1a1d]",
  blue: "from-blue-50/80 via-white to-white dark:from-blue-950/30 dark:via-[#1f1f22] dark:to-[#1a1a1d]",
  green:
    "from-emerald-50/80 via-white to-white dark:from-emerald-950/30 dark:via-[#1f1f22] dark:to-[#1a1a1d]",
  amber:
    "from-amber-50/80 via-white to-white dark:from-amber-950/30 dark:via-[#1f1f22] dark:to-[#1a1a1d]",
  purple:
    "from-violet-50/80 via-white to-white dark:from-violet-950/30 dark:via-[#1f1f22] dark:to-[#1a1a1d]",
  rose: "from-rose-50/80 via-white to-white dark:from-rose-950/30 dark:via-[#1f1f22] dark:to-[#1a1a1d]",
};

export default function KPIGrid({
  kpis,
  accent = "neutral",
}: {
  kpis: KPI[];
  accent?: Accent;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {kpis.map((kpi, i) => (
        <div
          key={kpi.label}
          className={[
            "relative overflow-hidden rounded-2xl border border-gray-200/70 bg-gradient-to-br p-5 shadow-sm ring-1 ring-black/[0.03]",
            "dark:border-white/5 dark:ring-white/[0.04]",
            i === 0 ? ACCENTS[accent] : ACCENTS.neutral,
          ].join(" ")}
        >
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {kpi.label}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              {typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
            </span>
            {kpi.trend && (
              <span
                className={[
                  "text-xs font-medium tabular-nums",
                  kpi.trend.positive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400",
                ].join(" ")}
              >
                {kpi.trend.positive ? "▲" : "▼"} {Math.abs(kpi.trend.value)}%
              </span>
            )}
          </div>
          {kpi.hint && (
            <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">{kpi.hint}</div>
          )}
        </div>
      ))}
    </div>
  );
}
