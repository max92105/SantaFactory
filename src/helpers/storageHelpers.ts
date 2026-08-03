/**
 * Warehouse space — the one place that answers "how full are we?".
 *
 * Stored count is EVERY item the factory physically holds: all production
 * stages plus the broken pile (see config/storageConfig.ts for why WIP counts).
 * Capacity is derived from owned Warehouse Expansions via Modifiers, so it needs
 * no saved state and older saves simply start at the base capacity.
 */

import type { GameState } from "../state/GameState";
import type { Modifiers } from "../systems/ModifierSystem";
import { BASE_STORAGE_CAPACITY } from "../config/storageConfig";

/** Total items held across every toy type and every stage, broken included. */
export function storedCount(state: GameState): number {
  let total = 0;
  for (const inv of Object.values(state.inventory)) {
    total += inv.wip1 + inv.wip2 + inv.raw + inv.assembled + inv.finished + inv.broken;
  }
  return total;
}

/** How many items the warehouse can hold right now. */
export function storageCapacity(mods: Modifiers): number {
  return Math.floor(BASE_STORAGE_CAPACITY * mods.storageCapMult);
}

/** Room left for newly created items (never negative — a save from before the
 *  cap existed, or a capacity change, can legitimately sit over the line). */
export function freeSpace(state: GameState, mods: Modifiers): number {
  return Math.max(0, storageCapacity(mods) - storedCount(state));
}

/** True when nothing new can be crafted or clicked until space is freed. */
export function isStorageFull(state: GameState, mods: Modifiers): boolean {
  return freeSpace(state, mods) <= 0;
}

/** Fill fraction (0..1, clamped) for meters and warning colours. */
export function storageFillPct(state: GameState, mods: Modifiers): number {
  const cap = storageCapacity(mods);
  if (cap <= 0) return 1;
  return Math.min(1, storedCount(state) / cap);
}

/** Everything the UI needs about warehouse space, computed once per frame. */
export type StorageView = {
  stored: number;
  capacity: number;
  free: number;
  fillPct: number;
  full: boolean;
};

export function storageView(state: GameState, mods: Modifiers): StorageView {
  const capacity = storageCapacity(mods);
  const stored = storedCount(state);
  const free = Math.max(0, capacity - stored);
  return {
    stored,
    capacity,
    free,
    fillPct: capacity > 0 ? Math.min(1, stored / capacity) : 1,
    full: free <= 0,
  };
}
