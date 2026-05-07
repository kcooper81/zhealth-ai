/**
 * Keyword research helpers — works without any paid SEO tool.
 *
 * Two free signal sources:
 *   1. Google Suggest (autocomplete) — what real users actually type when
 *      starting a query that begins with our seed term. Most search-volume
 *      tools derive their own data from this same well, so it's the closest
 *      free proxy for "what people search".
 *   2. Content topic extraction — pulls the most-frequent meaningful
 *      n-grams from a page's actual content. Used to detect mismatches
 *      between what a page TARGETS (Yoast focus keyword / title) and
 *      what the page is actually ABOUT.
 *
 * When GSC is wired in we'll cross these against real queries-driving-
 * impressions to surface "you're already almost ranking for X — go for it".
 */

import { cachedFetch } from "./cache";

/** Minutes — autocomplete results barely change day-to-day. */
const AUTOCOMPLETE_TTL = 7 * 24 * 60 * 60; // 7 days

/**
 * Google Suggest API. Public, no auth, no rate limit at our volume.
 * Returns an array of up to 10 autocomplete suggestions for `seed`.
 *
 * Probes a few "modifier" patterns to widen coverage:
 *   - the seed itself
 *   - "<seed> for <letter>" → "for beginners", "for runners", etc.
 *   - "best <seed>" / "<seed> vs"
 */
export async function getKeywordSuggestions(seed: string): Promise<string[]> {
  const trimmed = (seed || "").trim().toLowerCase();
  if (!trimmed) return [];

  return cachedFetch(`gsuggest:${trimmed}`, AUTOCOMPLETE_TTL, async () => {
    const queries: string[] = [
      trimmed,
      `${trimmed} for`,
      `best ${trimmed}`,
      `${trimmed} vs`,
      `how to ${trimmed}`,
      `what is ${trimmed}`,
    ];

    const results = await Promise.all(
      queries.map(async (q) => {
        try {
          const r = await fetch(
            `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`,
            { cache: "no-store" }
          );
          if (!r.ok) return [];
          const json = (await r.json()) as [string, string[]];
          const list = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
          return list;
        } catch {
          return [];
        }
      })
    );

    const seen = new Set<string>();
    const out: string[] = [];
    for (const list of results) {
      for (const term of list) {
        const t = (term || "").trim().toLowerCase();
        if (!t || seen.has(t)) continue;
        if (t === trimmed) continue;
        seen.add(t);
        out.push(t);
      }
    }
    return out.slice(0, 60);
  });
}

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","at","for","with","by","is","are",
  "was","were","be","been","being","this","that","these","those","it","its","as","you",
  "your","we","our","they","their","i","me","my","he","she","his","her","him","what",
  "which","who","whom","when","where","why","how","than","then","so","not","no","do",
  "does","did","done","have","has","had","can","could","will","would","should","may",
  "might","must","shall","one","two","get","got","just","like","also","more","most",
  "some","any","all","every","each","other","such","very","much","many","few","over",
  "out","up","down","into","from","about","through","during","before","after","above",
  "below","between","among","under","again","further","once","because","while","until",
  "about","into","via","upon","without","within","along","across","amp","quot","nbsp",
  "if","off","on","only","own","same","too","also",
]);

/**
 * Pulls the most-frequent meaningful 1- and 2-word phrases from page text.
 * Used to test whether a page's content actually matches its declared
 * focus keyword.
 */
export function extractTopPhrases(text: string, max: number = 12): Array<{ phrase: string; count: number }> {
  const cleaned = (text || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9\s-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  const unigrams = new Map<string, number>();
  for (const w of words) unigrams.set(w, (unigrams.get(w) ?? 0) + 1);

  const bigrams = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    bigrams.set(phrase, (bigrams.get(phrase) ?? 0) + 1);
  }

  // Trigrams catch important multi-word concepts
  const trigrams = new Map<string, number>();
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    trigrams.set(phrase, (trigrams.get(phrase) ?? 0) + 1);
  }

  const combined = [
    ...Array.from(bigrams.entries()).filter(([, n]) => n >= 2).map(([p, n]) => ({ phrase: p, count: n, weight: n * 2 })),
    ...Array.from(trigrams.entries()).filter(([, n]) => n >= 2).map(([p, n]) => ({ phrase: p, count: n, weight: n * 3 })),
    ...Array.from(unigrams.entries()).filter(([, n]) => n >= 3).map(([p, n]) => ({ phrase: p, count: n, weight: n })),
  ];

  combined.sort((a, b) => b.weight - a.weight);

  // De-dupe near-identical (e.g. "back pain" already covered by "lower back pain")
  const out: Array<{ phrase: string; count: number }> = [];
  for (const c of combined) {
    if (out.some((o) => o.phrase.includes(c.phrase) || c.phrase.includes(o.phrase))) continue;
    out.push({ phrase: c.phrase, count: c.count });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Generate a "topical fit" score — does the page's current focus keyword
 * (or fallback to the page title) actually appear in the most frequent
 * content phrases? Returns 0-100.
 */
export function computeTopicalFit(target: string | null | undefined, topPhrases: Array<{ phrase: string; count: number }>): number {
  if (!target) return 0;
  const t = target.toLowerCase().trim();
  if (!t) return 0;
  const targetWords = t.split(/\s+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  if (targetWords.length === 0) return 0;

  let hits = 0;
  for (const phrase of topPhrases) {
    for (const tw of targetWords) {
      if (phrase.phrase.includes(tw)) {
        hits += 1;
        break;
      }
    }
  }
  return Math.round((hits / Math.max(1, topPhrases.length)) * 100);
}
