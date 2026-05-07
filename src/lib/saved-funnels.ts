/**
 * Saved (named) custom funnels — backed by the api_cache Supabase table
 * via cacheGet / cacheSet so we don't need a separate schema. Records the
 * full FunnelDefinition shape so the funnels page can render saved customs
 * alongside the built-in presets.
 */
import { cacheGet, cacheSet } from "./cache";
import { FUNNELS, type FunnelDefinition, type FunnelStep } from "./funnel-config";

const STORE_KEY = "saved-funnels:list";
const STORE_TTL = 365 * 24 * 60 * 60; // effectively forever (1 year)

export type SavedFunnel = FunnelDefinition & {
  /** Always starts with "custom-" so it never collides with built-in ids. */
  id: string;
  /** ISO timestamp */
  createdAt: string;
  updatedAt: string;
  /** Which path the steps are scoped to (echoed for UI editing) */
  entryPath: string;
};

function newId(): string {
  return "custom-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export async function listSavedFunnels(): Promise<SavedFunnel[]> {
  const stored = await cacheGet<SavedFunnel[]>(STORE_KEY);
  return Array.isArray(stored) ? stored : [];
}

export async function saveFunnel(input: {
  id?: string;
  label: string;
  description?: string;
  property: "website" | "lms";
  entryPath: string;
  steps: FunnelStep[];
}): Promise<SavedFunnel> {
  const all = await listSavedFunnels();
  const now = new Date().toISOString();
  if (input.id) {
    const idx = all.findIndex((f) => f.id === input.id);
    if (idx >= 0) {
      const updated: SavedFunnel = {
        ...all[idx],
        label: input.label,
        description: input.description || all[idx].description,
        property: input.property,
        steps: input.steps,
        entryPath: input.entryPath,
        updatedAt: now,
      };
      all[idx] = updated;
      await cacheSet(STORE_KEY, all, STORE_TTL);
      return updated;
    }
  }
  const created: SavedFunnel = {
    id: newId(),
    label: input.label,
    description: input.description || `Custom funnel for ${input.entryPath}`,
    property: input.property,
    steps: input.steps,
    entryPath: input.entryPath,
    createdAt: now,
    updatedAt: now,
  };
  all.push(created);
  await cacheSet(STORE_KEY, all, STORE_TTL);
  return created;
}

export async function deleteFunnel(id: string): Promise<{ ok: boolean }> {
  const all = await listSavedFunnels();
  const next = all.filter((f) => f.id !== id);
  await cacheSet(STORE_KEY, next, STORE_TTL);
  return { ok: true };
}

export async function getFunnel(id: string): Promise<SavedFunnel | null> {
  const all = await listSavedFunnels();
  return all.find((f) => f.id === id) || null;
}

/**
 * Seed the built-in preset funnels into the saved store. Used on first
 * load so the team has all of them as editable custom funnels (with
 * predictable seed-prefixed IDs so re-seeding is idempotent).
 *
 * `mode: "if-empty"` only seeds when no saved funnels exist yet.
 * `mode: "force"` re-creates any seed-prefixed funnels (resets to defaults).
 */
export async function seedBuiltInFunnels(
  mode: "if-empty" | "force" = "if-empty"
): Promise<{ seeded: number }> {
  const all = await listSavedFunnels();
  if (mode === "if-empty" && all.length > 0) return { seeded: 0 };

  // Map built-in def → SavedFunnel format. Prefix id with "seed-" so we
  // can identify (and replace) seeded funnels on later re-seeds without
  // touching user-created customs.
  const now = new Date().toISOString();
  const fromBuiltIn = (def: FunnelDefinition): SavedFunnel => {
    // Derive the entryPath from the first step's pageMatch (presets always
    // use a pageMatch on step 1; if not, default to "/")
    const entryPath = def.steps.find((s) => s.pageMatch)?.pageMatch || "/";
    return {
      id: `seed-${def.id}`,
      label: def.label,
      description: def.description,
      property: def.property,
      steps: def.steps,
      entryPath,
      createdAt: now,
      updatedAt: now,
    };
  };

  if (mode === "force") {
    // Drop any existing seed-* funnels, then re-add fresh seeds + keep user customs
    const userCustoms = all.filter((f) => !f.id.startsWith("seed-"));
    const seeds = FUNNELS.map(fromBuiltIn);
    const next = [...seeds, ...userCustoms];
    await cacheSet(STORE_KEY, next, STORE_TTL);
    return { seeded: seeds.length };
  } else {
    const seeds = FUNNELS.map(fromBuiltIn);
    await cacheSet(STORE_KEY, seeds, STORE_TTL);
    return { seeded: seeds.length };
  }
}
