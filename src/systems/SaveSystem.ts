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
        dayStats: { ...fresh.dayStats, ...(parsed.dayStats ?? {}) },
        time: { ...fresh.time, ...(parsed.time ?? {}) },
        workforce: migrateWorkforce(parsed.workforce),
        owned: {
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
      if (typeof state.stats.lifetimeRuined !== "number") {
        state.stats.lifetimeRuined = 0;
      }

      if (typeof state.meta.lastWageResult !== "string") {
        state.meta.lastWageResult = "—";
      }

      // Runtime-only fields: never replay stale alerts; ensure stations exists.
      state.pendingAlerts = [];
      if (typeof state.stations !== "object" || state.stations === null) {
        state.stations = {};
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

  /**
   * Normalize a saved workforce into individual elves:
   *   { elves: ElfInstance[], nextId }
   *
   * Older count-based saves are migrated to that many IDLE elves (schedules are
   * dropped — the player re-assigns shifts), so nobody loses their headcount.
   */
  function migrateWorkforce(wf: any): GameState["workforce"] {
    const elves: GameState["workforce"]["elves"] = [];
    let nextId = 1;
    const addN = (type: string, n: number) => {
      for (let i = 0; i < Math.max(0, n | 0); i++) {
        elves.push({ id: nextId++, type, step: null, slots: [], spent: false });
      }
    };

    if (!wf || typeof wf !== "object") return { elves, nextId };

    // Current shape: individual elves
    if (Array.isArray(wf.elves)) {
      for (const e of wf.elves) {
        const id = typeof e?.id === "number" ? e.id : nextId;
        elves.push({
          id,
          type: String(e?.type ?? "worker"),
          step: typeof e?.step === "string" ? e.step : null,
          slots: Array.isArray(e?.slots) ? e.slots.map(String) : [],
          spent: !!e?.spent,
        });
        nextId = Math.max(nextId, id + 1);
      }
      if (typeof wf.nextId === "number") nextId = Math.max(nextId, wf.nextId);
      return { elves, nextId };
    }

    // Shift shape: hired{type}=count (schedules dropped)
    if (wf.hired && typeof wf.hired === "object") {
      for (const type of Object.keys(wf.hired)) addN(type, wf.hired[type] ?? 0);
      return { elves, nextId };
    }

    // Typed shape: unassigned{type} + assignments{step}{type}=count
    if (wf.unassigned && typeof wf.unassigned === "object") {
      const counts: Record<string, number> = {};
      for (const type of Object.keys(wf.unassigned)) counts[type] = (counts[type] ?? 0) + (wf.unassigned[type] ?? 0);
      for (const step of Object.keys(wf.assignments ?? {})) {
        for (const type of Object.keys(wf.assignments[step] ?? {})) {
          const v = wf.assignments[step][type];
          if (typeof v === "number") counts[type] = (counts[type] ?? 0) + v;
        }
      }
      for (const type of Object.keys(counts)) addN(type, counts[type]);
      return { elves, nextId };
    }

    // Legacy shape: unassigned as number, assignments{step}=number
    let worker = typeof wf.unassigned === "number" ? wf.unassigned : 0;
    for (const step of Object.keys(wf.assignments ?? {})) {
      const c = wf.assignments[step];
      if (typeof c === "number") worker += c;
    }
    addN("worker", worker);
    return { elves, nextId };
  }

  function clear() {
    localStorage.removeItem(SAVE_KEY);
  }

  return { save, load, clear };
}

export type SaveSystem = ReturnType<typeof createSaveSystem>;
