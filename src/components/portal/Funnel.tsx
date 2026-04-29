type Stage = {
  label: string;
  value: number;
  /** Optional sub-label (e.g. "from GA4 page views") */
  hint?: string;
};

type Props = {
  stages: Stage[];
  /** Format the stage value for display */
  formatValue?: (n: number) => string;
  /** Format conversion % between stages (default: "{n}%") */
  /** Color theme for the funnel bars */
  color?: "blue" | "green" | "purple" | "amber";
};

const COLORS = {
  blue: "from-blue-400 via-blue-500 to-blue-600",
  green: "from-emerald-400 via-emerald-500 to-emerald-600",
  purple: "from-violet-400 via-violet-500 to-violet-600",
  amber: "from-amber-400 via-amber-500 to-amber-600",
};

export default function Funnel({ stages, formatValue, color = "blue" }: Props) {
  if (stages.length === 0) return null;

  const max = Math.max(...stages.map((s) => s.value), 1);
  const c = COLORS[color];

  return (
    <ol className="space-y-2">
      {stages.map((stage, i) => {
        const widthPct = Math.max(8, Math.round((stage.value / max) * 100));
        const display = formatValue ? formatValue(stage.value) : stage.value.toLocaleString();
        const prior = i > 0 ? stages[i - 1].value : null;
        const conversion =
          prior !== null && prior > 0 ? Math.round((stage.value / prior) * 1000) / 10 : null;
        const dropoff =
          prior !== null && prior > 0 ? Math.round(((prior - stage.value) / prior) * 1000) / 10 : null;

        return (
          <li key={`${stage.label}-${i}`} className="space-y-1.5">
            {prior !== null && conversion !== null && (
              <div className="ml-6 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-500">
                <span className="font-mono">↓</span>
                <span>
                  {conversion}% continued
                  {dropoff !== null && dropoff > 0 && (
                    <>
                      {" · "}
                      <span className="text-rose-500 dark:text-rose-400">
                        {dropoff}% dropped off
                      </span>
                    </>
                  )}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="w-5 flex-shrink-0 text-right text-xs font-mono text-gray-400 dark:text-gray-500">
                {i + 1}
              </span>
              <div
                className={`relative flex h-12 items-center overflow-hidden rounded-xl bg-gradient-to-r ${c} px-4 shadow-sm transition-all`}
                style={{ width: `${widthPct}%`, minWidth: "180px" }}
              >
                <div className="flex flex-1 items-center justify-between gap-3 text-white">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{stage.label}</div>
                    {stage.hint && (
                      <div className="truncate text-[10px] opacity-80">{stage.hint}</div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-base font-bold tabular-nums">{display}</div>
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
