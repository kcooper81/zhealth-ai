type Item = {
  label: string;
  value: number;
  sublabel?: string;
  href?: string;
};

type Props = {
  items: Item[];
  formatValue?: (n: number) => string;
  emptyMessage?: string;
  color?: "blue" | "green" | "amber" | "purple" | "rose";
};

const COLORS = {
  blue: { bar: "from-blue-400 to-blue-600", track: "bg-blue-50 dark:bg-blue-950/30" },
  green: { bar: "from-emerald-400 to-emerald-600", track: "bg-emerald-50 dark:bg-emerald-950/30" },
  amber: { bar: "from-amber-400 to-amber-600", track: "bg-amber-50 dark:bg-amber-950/30" },
  purple: { bar: "from-violet-400 to-violet-600", track: "bg-violet-50 dark:bg-violet-950/30" },
  rose: { bar: "from-rose-400 to-rose-600", track: "bg-rose-50 dark:bg-rose-950/30" },
};

export default function BarList({
  items,
  formatValue,
  emptyMessage = "No data",
  color = "blue",
}: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-500">
        {emptyMessage}
      </p>
    );
  }

  const max = Math.max(...items.map((i) => i.value), 1);
  const c = COLORS[color];

  return (
    <ol className="space-y-3">
      {items.map((item, i) => {
        const pct = Math.round((item.value / max) * 100);
        const formatted = formatValue ? formatValue(item.value) : item.value.toLocaleString();
        const labelClass =
          "truncate text-sm font-medium text-gray-900 dark:text-gray-100";
        return (
          <li key={`${item.label}-${i}`} className="group">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="w-5 text-right text-xs font-mono text-gray-400 dark:text-gray-500">
                  {i + 1}
                </span>
                {item.href ? (
                  <a href={item.href} className={`${labelClass} hover:underline`}>
                    {item.label}
                  </a>
                ) : (
                  <span className={labelClass}>{item.label}</span>
                )}
                {item.sublabel && (
                  <span className="truncate text-xs text-gray-500 dark:text-gray-500">
                    · {item.sublabel}
                  </span>
                )}
              </div>
              <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {formatted}
              </span>
            </div>
            <div className={`h-2 overflow-hidden rounded-full ${c.track}`}>
              <div
                className={`h-full rounded-full bg-gradient-to-r ${c.bar} transition-all duration-700 ease-out`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
