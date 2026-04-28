import Link from "next/link";
import { ArrowRight } from "@/components/icons";

type Stat = { label: string; value: string | number };

type Props = {
  title: string;
  href: string;
  status: "ok" | "warn" | "error" | "soon";
  description?: string;
  stats?: Stat[];
  errorMessage?: string;
};

const STATUS = {
  ok: {
    dot: "bg-emerald-500 ring-2 ring-emerald-500/20",
    label: "Connected",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  warn: {
    dot: "bg-amber-500 ring-2 ring-amber-500/20",
    label: "Scaffold",
    text: "text-amber-700 dark:text-amber-400",
  },
  error: {
    dot: "bg-rose-500 ring-2 ring-rose-500/20",
    label: "Error",
    text: "text-rose-700 dark:text-rose-400",
  },
  soon: {
    dot: "bg-gray-300 ring-2 ring-gray-300/20 dark:bg-gray-600 dark:ring-gray-600/20",
    label: "Coming soon",
    text: "text-gray-500 dark:text-gray-400",
  },
} as const;

export default function StatusCard({
  title,
  href,
  status,
  description,
  stats = [],
  errorMessage,
}: Props) {
  const s = STATUS[status];
  const disabled = status === "soon";

  const inner = (
    <div
      className={[
        "group relative h-full overflow-hidden rounded-2xl border border-gray-200/70 bg-gradient-to-br from-white to-gray-50/50 p-6 shadow-sm ring-1 ring-black/[0.03] transition-all",
        "dark:border-white/5 dark:from-[#1f1f22] dark:to-[#19191c] dark:ring-white/[0.04]",
        disabled
          ? ""
          : "hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md dark:hover:border-white/10",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-50">
          {title}
        </h3>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${s.dot}`} />
          <span className={`text-[11px] font-medium ${s.text}`}>{s.label}</span>
        </div>
      </div>
      {description && (
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {description}
        </p>
      )}
      {stats.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-500">
                {stat.label}
              </dt>
              <dd className="mt-0.5 text-xl font-semibold tracking-tight tabular-nums text-gray-900 dark:text-gray-50">
                {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {errorMessage && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
          {errorMessage}
        </p>
      )}
      {!disabled && (
        <div className="mt-5 flex items-center text-xs font-medium text-brand-blue opacity-0 transition-opacity group-hover:opacity-100">
          Open
          <ArrowRight size={12} className="ml-1" />
        </div>
      )}
    </div>
  );

  if (disabled) {
    return <div className="opacity-60">{inner}</div>;
  }
  return (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  );
}
