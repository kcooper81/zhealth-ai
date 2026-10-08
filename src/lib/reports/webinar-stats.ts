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
  registered: number;        // primary registration (best signup tag)
  registeredBySource: Record<string, number>;
  replaySignups: number;
  saleClaimed: number;
  regToReplay: number;       // replay / registered
  regToSale: number;         // sale / registered
  tags: WebinarTag[];
};

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
    const replaySignups = replayTags.reduce((mx, t) => Math.max(mx, t.count), 0);
    const saleClaimed = saleTags.reduce((s, t) => s + t.count, 0);

    stats.push({
      webinar,
      registered,
      registeredBySource,
      replaySignups,
      saleClaimed,
      regToReplay: registered ? replaySignups / registered : 0,
      regToSale: registered ? saleClaimed / registered : 0,
      tags: wtags.sort((a, b) => b.count - a.count),
    });
  }

  // Newest first (tags are named with the year up front).
  return stats.filter((s) => s.registered > 0 || s.saleClaimed > 0).sort((a, b) => b.webinar.localeCompare(a.webinar));
}

export const WEBINAR_FRESH_SECONDS = 60 * 60;      // 1h fresh
export const WEBINAR_HARD_SECONDS = 24 * 60 * 60;  // 24h snapshot
export const WEBINAR_CACHE_KEY = "webinars:stats:v1";
