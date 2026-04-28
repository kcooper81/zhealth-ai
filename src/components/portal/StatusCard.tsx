import Link from "next/link";

type Stat = { label: string; value: string | number };

type Props = {
  title: string;
  href: string;
  status: "ok" | "warn" | "error" | "soon";
  description?: string;
  stats?: Stat[];
  errorMessage?: string;
};

const statusBadge = {
  ok: { dot: "bg-green-500", label: "Connected", text: "text-green-700 dark:text-green-400" },
  warn: { dot: "bg-yellow-500", label: "Degraded", text: "text-yellow-700 dark:text-yellow-400" },
  error: { dot: "bg-red-500", label: "Error", text: "text-red-700 dark:text-red-400" },
  soon: { dot: "bg-gray-400", label: "Coming soon", text: "text-gray-500 dark:text-gray-400" },
} as const;

export default function StatusCard({ title, href, status, description, stats = [], errorMessage }: Props) {
  const s = statusBadge[status];
  const disabled = status === "soon";

  const inner = (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-brand-blue dark:border-gray-800 dark:bg-[#202022] dark:hover:border-brand-blue">
      <div className="flex items-start justify-between">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${s.dot}`} />
          <span className={`text-xs ${s.text}`}>{s.label}</span>
        </div>
      </div>
      {description && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      )}
      {stats.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-500">
                {stat.label}
              </dt>
              <dd className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {errorMessage && (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
      )}
    </div>
  );

  if (disabled) {
    return <div className="opacity-60">{inner}</div>;
  }
  return (
    <Link href={href} className="block">
      {inner}
    </Link>
  );
}
