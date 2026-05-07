import { Check, AlertCircle } from "@/components/icons";

type Props = {
  /** true → green check, false → amber alert, null → grey "not checked" */
  ok: boolean | null;
  label?: string;
};

/**
 * Compact verified/not-verified pill used as the `action` of each Step
 * Section on /portal/reports/setup. Computed server-side from the live
 * site fetch so it always reflects current production state.
 */
export default function StepStatus({ ok, label }: Props) {
  if (ok === true) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Check size={12} />
        <span>{label || "Verified"}</span>
      </span>
    );
  }
  if (ok === false) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        <AlertCircle size={12} />
        <span>{label || "Not detected"}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-white/5 dark:text-gray-400">
      <span>{label || "Manual step"}</span>
    </span>
  );
}
