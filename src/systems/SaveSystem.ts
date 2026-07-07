/**
 * SaveSystem — persistence to localStorage.
 * Storage key: config/saveConfig.ts. Loading merges the save over a fresh
 * state so old saves keep working when new fields are added.
 */

import type { GameState } from "../state/GameState";
import { SAVE_KEY } from "../config/saveConfig";
import { createInitialState } from "../state/GameState";

export function createSaveSystem() {
  function save(state: GameState) {
    const payload = JSON.stringify(state);
    localStorage.setItem(SAVE_KEY, payload);
    state.meta.lastSavedAt = Date.now();
    state.meta.statusText = "Saved.";
  }

  function load(): GameState | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as any;
      const fresh = createInitialState();

      const state: GameState = {
        ...fresh,
        ...parsed,
        resources: { ...fresh.resources, ...(parsed.resources ?? {}) },
        stats: { ...fresh.stats, ...(parsed.stats ?? {}) },
        time: { ...fresh.time, ...(parsed.time ?? {}) },
        owned: {
          producers: { ...fresh.owned.producers, ...(parsed.owned?.producers ?? {}) },
          upgrades: { ...fresh.owned.upgrades, ...(parsed.owned?.upgrades ?? {}) },
          toys: { ...fresh.owned.toys, ...(parsed.owned?.toys ?? {}) },
        },
        meta: { ...fresh.meta, ...(parsed.meta ?? {}) },
        derived: { ...fresh.derived, ...(parsed.derived ?? {}) },
      };

      // Migration: older saves used derived.giftsPerClick
      if (typeof parsed?.derived?.giftsPerClick === "number" && typeof state.derived.baseGpc !== "number") {
        state.derived.baseGpc = parsed.derived.giftsPerClick;
      }

      if (typeof state.derived.baseGpc !== "number") {
        state.derived.baseGpc = fresh.derived.baseGpc;
      }

      if (typeof state.stats.lifetimeSoldGifts !== "number") {
        state.stats.lifetimeSoldGifts = 0;
      }

      if (typeof state.meta.lastWageResult !== "string") {
        state.meta.lastWageResult = "—";
      }

      // Migration: saves from before toy unlocks could already produce every
      // toy, so grandfather them in rather than re-locking their toys.
      if (!parsed.owned?.toys) {
        for (const id of Object.keys(state.owned.toys)) {
          state.owned.toys[id] = true;
        }
      }

      return state;
    } catch {
      return null;
    }
  }

  function clear() {
    localStorage.removeItem(SAVE_KEY);
  }

  return { save, load, clear };
}

export type SaveSystem = ReturnType<typeof createSaveSystem>;
