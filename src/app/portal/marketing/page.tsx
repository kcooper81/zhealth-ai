import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marketing plan — Z-Health" };

type Status = "ACTIVE" | "PLANNING" | "QUEUED" | "PAUSED" | "DONE" | "IDEA";
const STATUSES: Status[] = ["ACTIVE", "PLANNING", "QUEUED", "PAUSED", "DONE", "IDEA"];

const STATUS_STYLE: Record<Status, string> = {
  ACTIVE:   "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200 ring-1 ring-emerald-500/40",
  PLANNING: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200 ring-1 ring-blue-500/40",
  QUEUED:   "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 ring-1 ring-amber-500/40",
  PAUSED:   "bg-gray-200 text-gray-800 dark:bg-gray-700/60 dark:text-gray-200 ring-1 ring-gray-400/40",
  DONE:     "bg-gray-100 text-gray-500 dark:bg-gray-800/60 dark:text-gray-500 ring-1 ring-gray-500/20 line-through-none",
  IDEA:     "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200 ring-1 ring-purple-500/40",
};

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string; status?: Status }
  | { kind: "para"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "hr" };

// Tiny inline markdown → HTML: bold, code, links, and hard breaks. Everything
// else is left as escaped text.
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(md: string): string {
  let s = esc(md);
  s = s.replace(/`([^`]+)`/g, '<code class="rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.5 text-[0.85em]">$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="text-brand-blue underline underline-offset-2 hover:opacity-80" href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/_([^_]+)_/g, "<em>$1</em>");
  return s;
}

function parse(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const out: Block[] = [];
  let ulBuf: string[] | null = null;
  const flushUl = () => { if (ulBuf) { out.push({ kind: "ul", items: ulBuf }); ulBuf = null; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { flushUl(); continue; }
    if (/^---+$/.test(line.trim())) { flushUl(); out.push({ kind: "hr" }); continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushUl();
      const level = h[1].length;
      const text = h[2].trim();
      if (level === 1) out.push({ kind: "h1", text });
      else if (level === 2) out.push({ kind: "h2", text });
      else {
        // h3+: peel off a leading STATUS token like "ACTIVE — foo"
        const statusMatch = text.match(/^([A-Z]{4,8})\s*[—-]\s*(.+)$/);
        const status = statusMatch && (STATUSES as string[]).includes(statusMatch[1])
          ? (statusMatch[1] as Status)
          : undefined;
        const label = status ? statusMatch![2].trim() : text;
        out.push({ kind: "h3", text: label, status });
      }
      continue;
    }

    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      if (!ulBuf) ulBuf = [];
      ulBuf.push(li[1]);
      continue;
    }

    flushUl();
    out.push({ kind: "para", text: line });
  }
  flushUl();
  return out;
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

function renderBlocks(blocks: Block[]) {
  return blocks.map((b, i) => {
    switch (b.kind) {
      case "h1":
        return (
          <h1 key={i} className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            {b.text}
          </h1>
        );
      case "h2":
        return (
          <h2 key={i} className="mt-14 mb-4 border-b border-gray-200 pb-2 text-2xl font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
            {b.text}
          </h2>
        );
      case "h3":
        return (
          <h3 key={i} className="mt-8 mb-3 flex items-center gap-3 text-lg font-medium text-gray-800 dark:text-gray-200">
            {b.status && <StatusBadge status={b.status} />}
            <span>{b.text}</span>
          </h3>
        );
      case "para":
        return (
          <p key={i} className="mb-3 max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-400"
             dangerouslySetInnerHTML={{ __html: inline(b.text) }} />
        );
      case "ul":
        return (
          <ul key={i} className="mb-4 max-w-3xl list-disc space-y-1 pl-6 text-sm text-gray-600 dark:text-gray-400">
            {b.items.map((it, j) => (
              <li key={j} dangerouslySetInnerHTML={{ __html: inline(it) }} />
            ))}
          </ul>
        );
      case "hr":
        return null; // borders on h2 do the job
    }
  });
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map(s => <StatusBadge key={s} status={s} />)}
    </div>
  );
}

export default async function MarketingPlanPage() {
  const file = path.join(process.cwd(), "src", "data", "marketing-plan.md");
  const md = await fs.readFile(file, "utf8");
  const blocks = parse(md);

  const updatedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="mx-auto max-w-5xl px-8 py-12">
      <header className="mb-8">
        <div className="mb-4 flex items-baseline justify-between">
          <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Strategy
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">Rendered {updatedAt} PT</span>
        </div>
        <StatusLegend />
      </header>
      <article>{renderBlocks(blocks)}</article>
      <footer className="mt-16 border-t border-gray-200 pt-6 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-500">
        Source: <code className="rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.5">src/data/marketing-plan.md</code>
        {" "}— edit + commit + deploy and this page reflects it.
      </footer>
    </main>
  );
}
