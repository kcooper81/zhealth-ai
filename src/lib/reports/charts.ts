/**
 * QuickChart.io URL builders — returns PNG image URLs for embedding as <img>
 * tags in Basecamp messages or HTML emails.
 *
 * No dependency on a charting library — QuickChart renders server-side from
 * the JSON config we pass in the URL.
 */

const QUICKCHART = "https://quickchart.io/chart";
const GRAY = "#9aa3ad";
const ACCENT = "#1a6e2c";

function chartUrl(config: object, opts: { width?: number; height?: number; backgroundColor?: string } = {}) {
  const c = encodeURIComponent(JSON.stringify(config));
  const w = opts.width || 700;
  const h = opts.height || 320;
  const bg = opts.backgroundColor || "white";
  return `${QUICKCHART}?w=${w}&h=${h}&bkg=${encodeURIComponent(bg)}&c=${c}`;
}

export function yoyLineChart({
  labels,
  thisYear,
  lastYear,
  title,
  thisYearLabel,
  lastYearLabel,
}: {
  labels: string[];
  thisYear: number[];
  lastYear: number[];
  title?: string;
  thisYearLabel?: string;
  lastYearLabel?: string;
}) {
  return chartUrl({
    type: "line",
    data: {
      labels,
      datasets: [
        { label: thisYearLabel || "This year", data: thisYear, borderColor: ACCENT, backgroundColor: "rgba(26,110,44,0.1)", borderWidth: 3, fill: true, tension: 0.3 },
        { label: lastYearLabel || "Last year", data: lastYear, borderColor: GRAY, borderWidth: 2, borderDash: [6, 6], fill: false, tension: 0.3 },
      ],
    },
    options: {
      title: { display: !!title, text: title, fontSize: 14, fontStyle: "bold" },
      legend: { position: "top" },
      scales: { yAxes: [{ ticks: { beginAtZero: true } }] },
    },
  });
}

export function brandStackChart({
  labels,
  brand,
  nonBrand,
  title,
}: {
  labels: string[];
  brand: number[];
  nonBrand: number[];
  title?: string;
}) {
  return chartUrl({
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Non-brand", data: nonBrand, backgroundColor: ACCENT },
        { label: "Brand", data: brand, backgroundColor: GRAY },
      ],
    },
    options: {
      title: { display: !!title, text: title, fontSize: 14, fontStyle: "bold" },
      legend: { position: "top" },
      scales: {
        xAxes: [{ stacked: true }],
        yAxes: [{ stacked: true, ticks: { beginAtZero: true } }],
      },
    },
  }, { width: 700, height: 300 });
}

export function topPagesChart({
  labels,
  thisYear,
  lastYear,
  title,
}: {
  labels: string[];
  thisYear: number[];
  lastYear: number[];
  title?: string;
}) {
  return chartUrl({
    type: "horizontalBar",
    data: {
      labels,
      datasets: [
        { label: "This month", data: thisYear, backgroundColor: ACCENT },
        { label: "Same month last year", data: lastYear, backgroundColor: GRAY },
      ],
    },
    options: {
      title: { display: !!title, text: title, fontSize: 14, fontStyle: "bold" },
      legend: { position: "top" },
      scales: { xAxes: [{ ticks: { beginAtZero: true } }] },
    },
  }, { width: 700, height: 30 + labels.length * 36 });
}

export function channelDonut({
  channels,
  title,
}: {
  channels: { name: string; sessions: number }[];
  title?: string;
}) {
  const palette = ["#1a6e2c", "#3a8e4c", "#5aaa6c", "#7aca8c", "#9aeaac", "#cad9b0", GRAY, "#1f2530"];
  return chartUrl({
    type: "doughnut",
    data: {
      labels: channels.map(c => c.name),
      datasets: [{ data: channels.map(c => c.sessions), backgroundColor: palette.slice(0, channels.length) }],
    },
    options: {
      title: { display: !!title, text: title, fontSize: 14, fontStyle: "bold" },
      legend: { position: "right" },
    },
  }, { width: 600, height: 320 });
}
