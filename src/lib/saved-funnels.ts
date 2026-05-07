/**
 * Saved (named) custom funnels — backed by the api_cache Supabase table
 * via cacheGet / cacheSet so we don't need a separate schema. Records the
 * full FunnelDefinition shape so the funnels page can render saved customs
 * alongside the built-in presets.
 */
import { cacheGet, cacheSet } from "./cache";
import { type FunnelDefinition, type FunnelStep } from "./funnel-config";

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
