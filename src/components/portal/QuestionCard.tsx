import Link from "next/link";
import { ArrowRight } from "@/components/icons";

type Trend = { value: number; positive?: boolean };

type Props = {
  /** The business question this card answers */
  question: string;
  /** The headline answer (number or short string) */
  answer: string | number;
  /** Supporting context — what does the answer mean */
  context?: string;
  /** Optional period-over-period trend */
  trend?: Trend;
  /** Where to drill in for more detail */
  href: string;
  /** Visual accent — keeps cards visually grouped by theme */
  accent?: "blue" | "green" | "amber" | "purple" | "rose";
  /** Optional secondary fact (e.g., "out of 55,417 total") */
  detail?: string;
};

const ACCENTS = {
  blue: "from-blue-50/70 dark:from-blue-950/20",
  green: "from-emerald-50/70 dark:from-emerald-950/20",
  amber: "from-amber-50/70 dark:from-amber-950/20",
  purple: "from-violet-50/70 dark:from-violet-950/20",
  rose: "from-rose-50/70 dark:from-rose-950/20",
};

export default function QuestionCard({
  question,
  answer,
  context,
  trend,
  href,
  accent = "blue",
  detail,
}: Props) {
  const formatted = typeof answer === "number" ? answer.toLocaleString() : answer;
  return (
    <Link href={href} className="group block h-full">
      <div
        className={[
          "relative h-full overflow-hidden rounded-2xl border border-gray-200/70 bg-gradient-to-br to-white p-6 shadow-sm ring-1 ring-black/[0.03] transition-all",
          "dark:border-white/5 dark:to-[#1f1f22] dark:ring-white/[0.04]",
          "hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md dark:hover:border-white/10",
          ACCENTS[accent],
        ].join(" ")}
      >
        {/* Question */}
        <p className="text-sm font-medium leading-snug text-gray-600 dark:text-gray-400">
          {question}
        </p>

        {/* Answer */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums text-gray-900 dark:text-gray-50">
            {formatted}
          </span>
          {trend && (
            <span
              className={[
                "text-xs font-medium tabular-nums",
                trend.positive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              ].join(" ")}
            >
              {trend.positive ? "▲" : "▼"} {Math.abs(trend.value)}%
            </span>
          )}
        </div>

        {/* Context */}
        {context && (
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-500">
            {context}
          </p>
        )}
        {detail && (
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-600">{detail}</p>
        )}

        {/* Drill-in indicator */}
        <div className="mt-5 flex items-center text-xs font-medium text-brand-blue opacity-0 transition-opacity group-hover:opacity-100">
          See the report
          <ArrowRight size={12} className="ml-1" />
        </div>
      </div>
    </Link>
  );
}
