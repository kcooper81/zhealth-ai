/**
 * Time-range parsing and date math for portal reporting pages.
 * Drives the DateRangePicker component and server-side data fetching.
 */

export type RangeKey = "7d" | "30d" | "90d" | "12mo" | "ytd" | "all" | "custom";

export type TimeRange = {
  key: RangeKey;
  label: string;
  from: Date;
  to: Date;
  /** Comparison period of equal length immediately preceding `from` */
  prior: { from: Date; to: Date };
  /** Number of days in the active range */
  days: number;
};

const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "12mo": "Last 12 months",
  ytd: "Year to date",
  all: "All time",
  custom: "Custom",
};

function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

function startOfYear(): Date {
  const d = new Date();
  d.setUTCMonth(0, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Parse a search-params-like object into a normalized TimeRange.
 * Defaults to 30d when nothing is supplied or the value is unrecognized.
 */
export function parseTimeRange(params: {
  range?: string | string[];
  from?: string | string[];
  to?: string | string[];
}): TimeRange {
  const rangeRaw = Array.isArray(params.range) ? params.range[0] : params.range;
  const fromRaw = Array.isArray(params.from) ? params.from[0] : params.from;
  const toRaw = Array.isArray(params.to) ? params.to[0] : params.to;

  const now = new Date();
  let key: RangeKey = "30d";
  let from: Date;
  let to: Date = now;

  switch (rangeRaw) {
    case "7d":
      key = "7d";
      from = new Date(now.getTime() - daysToMs(7));
      break;
    case "30d":
      key = "30d";
      from = new Date(now.getTime() - daysToMs(30));
      break;
    case "90d":
      key = "90d";
      from = new Date(now.getTime() - daysToMs(90));
      break;
    case "12mo":
      key = "12mo";
      from = new Date(now.getTime() - daysToMs(365));
      break;
    case "ytd":
      key = "ytd";
      from = startOfYear();
      break;
    case "all":
      key = "all";
      from = new Date(2010, 0, 1); // far enough back for any realistic data
      break;
    case "custom":
      key = "custom";
      from = fromRaw ? new Date(fromRaw) : new Date(now.getTime() - daysToMs(30));
      to = toRaw ? new Date(toRaw) : now;
      break;
    default:
      from = new Date(now.getTime() - daysToMs(30));
  }

  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / daysToMs(1)));
  const prior = {
    from: new Date(from.getTime() - daysToMs(days)),
    to: from,
  };

  return {
    key,
    label: RANGE_LABELS[key],
    from,
    to,
    prior,
    days,
  };
}

export function isoDate(d: Date): string {
  return d.toISOString();
}

export function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function monthKey(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

export function pctChange(current: number, prior: number): { value: number; positive: boolean } {
  if (prior === 0) return { value: current === 0 ? 0 : 100, positive: current >= 0 };
  const change = ((current - prior) / prior) * 100;
  return { value: Math.round(Math.abs(change) * 10) / 10, positive: change >= 0 };
}
