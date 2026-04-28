type KPI = {
  label: string;
  value: string | number;
  hint?: string;
};

export default function KPIGrid({ kpis }: { kpis: KPI[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#202022]"
        >
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {kpi.label}
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
          </div>
          {kpi.hint && (
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">{kpi.hint}</div>
          )}
        </div>
      ))}
    </div>
  );
}
