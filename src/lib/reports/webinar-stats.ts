/**
 * Webinar (masterclass) funnel data — sourced from Keap tags, since WebinarJam
 * registrations/replay-signups/sales all sync into Keap as tags per masterclass.
 *
 * Tag naming (examples):
 *   "2026 February 18 Masterclass (how to deliver results) SIGNUP (webinarjam)"
 *   "2026 February 18 Masterclass (how to deliver results) SIGNUP (REPLAY)"
 *   "2026 February 18 Masterclass (how to deliver results) SALE CLAIMED"
 *   "2025 September 22 Masterclass SIGNUP (landing page)"
 *   "2025 September 22 Masterclass SIGNUP (meta ad)"
 *   "2025 September 22 Masterclass Sale Claimed"
 */
import { listTags, getContactsWithTag } from "@/lib/keap";

export type WebinarRole = "register" | "replay" | "sale";
export type WebinarSource = "webinarjam" | "landing page" | "meta ad" | "other";

export type WebinarTag = { id: number; name: string; role: WebinarRole; source: WebinarSource; count: number };

export type WebinarStat = {
  webinar: string;           // grouped webinar label
  dateKey: string;           // YYYYMMDD for sorting/trends ("" if unparseable)
  registered: number;        // primary registration (best signup tag)
  registeredBySource: Record<string, number>;
  topSource: string;         // highest-registration source
  replaySignups: number;     // total (live + on-demand)
  replayLive: number;
  replayOnDemand: number;
  saleClaimed: number;
  regToReplay: number;       // replay / registered
  regToSale: number;         // sale / registered
  tags: WebinarTag[];
};

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};
function parseDateKey(name: string): string {
  const y = name.match(/\b(20\d{2})\b/)?.[1];
  const mo = name.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i)?.[1]?.toLowerCase();
  const day = name.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i)?.[2];
  if (!y) return "";
  return `${y}${mo ? MONTHS[mo] : "00"}${day ? String(day).padStart(2, "0") : "00"}`;
}

function classify(name: string): { key: string; role: WebinarRole; source: WebinarSource } {
  const u = name.toUpperCase();
  let role: WebinarRole = "register";
  if (/SALE\s*CLAIMED|CLAIMED/.test(u)) role = "sale";
  else if (/REPLAY/.test(u)) role = "replay";
  else role = "register";

  let source: WebinarSource = "other";
  if (/WEBINARJAM/.test(u)) source = "webinarjam";
  else if (/META\s*AD|META/.test(u)) source = "meta ad";
  else if (/LANDING/.test(u)) source = "landing page";

  // Webinar key = text before the SIGNUP/SALE/REPLAY marker.
  let key = name.replace(/\s*(SIGNUP|SALE\s*CLAIMED|REPLAY|LIVE\s*REPLAY|ON-DEMAND\s*REPLAY|Sale\s*Claimed).*$/i, "").trim();
  key = key.replace(/\s*\(.*$/, "").trim(); // drop trailing "(how to deliver results)" etc.
  return { key: key || name, role, source };
}

export async function getWebinarStats(): Promise<WebinarStat[]> {
  const { tags } = await listTags({ limit: 1000 });
  // Masterclass tags only (the WebinarJam-synced funnel tags).
  const relevant = tags.filter((t) => /masterclass/i.test(t.name));
  if (relevant.length === 0) return [];

  // Count contacts per tag (parallel, capped).
  const counted: WebinarTag[] = await Promise.all(
    relevant.map(async (t) => {
      const { role, source } = classify(t.name);
      let count = 0;
      try {
        count = (await getContactsWithTag(t.id, { limit: 1 })).count;
      } catch {
        count = 0;
      }
      return { id: t.id, name: t.name, role, source, count };
    })
  );

  // Group by webinar key.
  const groups = new Map<string, WebinarTag[]>();
  for (const t of counted) {
    const { key } = classify(t.name);
    const arr = groups.get(key) || [];
    arr.push(t);
    groups.set(key, arr);
  }

  const stats: WebinarStat[] = [];
  for (const [webinar, wtags] of Array.from(groups.entries())) {
    const regTags = wtags.filter((t) => t.role === "register");
    const replayTags = wtags.filter((t) => t.role === "replay");
    const saleTags = wtags.filter((t) => t.role === "sale");

    // Primary registered = the single largest registration tag (usually the
    // webinarjam one). Summing sources would double-count overlaps.
    const registered = regTags.reduce((mx, t) => Math.max(mx, t.count), 0);
    const registeredBySource: Record<string, number> = {};
    for (const t of regTags) registeredBySource[t.source] = Math.max(registeredBySource[t.source] || 0, t.count);
    const topSource = Object.entries(registeredBySource).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    const replayLive = replayTags.filter((t) => /live\s*replay/i.test(t.name)).reduce((mx, t) => Math.max(mx, t.count), 0);
    const replayOnDemand = replayTags.filter((t) => /on-?demand/i.test(t.name)).reduce((mx, t) => Math.max(mx, t.count), 0);
    const replayGeneric = replayTags.filter((t) => !/live\s*replay|on-?demand/i.test(t.name)).reduce((mx, t) => Math.max(mx, t.count), 0);
    const replaySignups = replayLive + replayOnDemand || replayGeneric;
    const saleClaimed = saleTags.reduce((s, t) => s + t.count, 0);

    stats.push({
      webinar,
      dateKey: parseDateKey(webinar),
      registered,
      registeredBySource,
      topSource,
      replaySignups,
      replayLive,
      replayOnDemand,
      saleClaimed,
      regToReplay: registered ? replaySignups / registered : 0,
      regToSale: registered ? saleClaimed / registered : 0,
      tags: wtags.sort((a, b) => b.count - a.count),
    });
  }

  // Newest first by parsed date (fallback to name).
  return stats
    .filter((s) => s.registered > 0 || s.saleClaimed > 0)
    .sort((a, b) => (b.dateKey || "0").localeCompare(a.dateKey || "0") || b.webinar.localeCompare(a.webinar));
}

export const WEBINAR_FRESH_SECONDS = 60 * 60;      // 1h fresh
export const WEBINAR_HARD_SECONDS = 24 * 60 * 60;  // 24h snapshot
export const WEBINAR_CACHE_KEY = "webinars:stats:v2";
