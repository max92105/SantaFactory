/**
 * SaveSystem — slot-based persistence to localStorage.
 * Storage keys: config/saveConfig.ts. Loading merges the save over a fresh
 * state so old saves keep working when new fields are added.
 */

import type { GameState } from "../state/GameState";
import { slotKey, LEGACY_SAVE_KEY, SLOT_COUNT } from "../config/saveConfig";
import { createInitialState } from "../state/GameState";
import { GRINCH_MIN_GAP_DAYS } from "../config/grinchConfig";
import { SECONDS_PER_GAME_DAY } from "../config/timeConfig";

/** Lightweight summary shown on the main-menu slot cards (no full load). */
export type SlotSummary = {
  exists: boolean;
  corrupt?: boolean;
  day?: number;
  money?: number;
  elves?: number;
  savedAt?: number | null;
};

export function createSaveSystem() {
  /** Write the state to a slot. Silent (no status text) — used by autosave too. */
  function save(state: GameState, slot: number): boolean {
    try {
      state.meta.lastSavedAt = Date.now();
      localStorage.setItem(slotKey(slot), JSON.stringify(state));
      return true;
    } catch {
      return false; // storage full / blocked (private mode, etc.)
    }
  }

  function load(slot: number): GameState | null {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    try {
      return hydrate(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  /** Read just enough from a slot to show a menu card, without a full load. */
  function peek(slot: number): SlotSummary {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return { exists: false };
    try {
      const p = JSON.parse(raw) as any;
      return {
        exists: true,
        day: typeof p?.time?.day === "number" ? p.time.day : 1,
        money: typeof p?.resources?.money === "number" ? p.resources.money : 0,
        elves: Array.isArray(p?.workforce?.elves) ? p.workforce.elves.length : 0,
        savedAt: typeof p?.meta?.lastSavedAt === "number" ? p.meta.lastSavedAt : null,
      };
    } catch {
      return { exists: true, corrupt: true };
    }
  }

  function clear(slot: number): void {
    localStorage.removeItem(slotKey(slot));
  }

  /** Move a pre-slots single save into slot 1 (once), so players keep progress. */
  function migrateLegacy(): void {
    const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
    if (!legacy) return;
    if (!localStorage.getItem(slotKey(1))) {
      localStorage.setItem(slotKey(1), legacy);
    }
    localStorage.removeItem(LEGACY_SAVE_KEY);
  }

  /** Merge a parsed save over a fresh state, running all field migrations. */
  function hydrate(parsed: any): GameState {
    const fresh = createInitialState();

    const state: GameState = {
        ...fresh,
        ...parsed,
        resources: { ...fresh.resources, ...(parsed.resources ?? {}) },
        stats: { ...fresh.stats, ...(parsed.stats ?? {}) },
        dayStats: { ...fresh.dayStats, ...(parsed.dayStats ?? {}) },
        time: { ...fresh.time, ...(parsed.time ?? {}) },
        workforce: migrateWorkforce(parsed.workforce),
        orders: migrateOrders(parsed.orders, fresh),
        grand: {
          current: parsed.grand?.current ?? null,
          seen: Array.isArray(parsed.grand?.seen) ? parsed.grand.seen : [],
        },
        // Older saves have no Christmas Order — ChristmasSystem.ensureInit
        // generates it on load, so mid-run saves get their endgame too.
        christmas: {
          lines: Array.isArray(parsed.christmas?.lines)
            ? parsed.christmas.lines.map((l: any) => ({
                toyType: String(l?.toyType ?? "plushy"),
                quantity: typeof l?.quantity === "number" ? l.quantity : 0,
                delivered: typeof l?.delivered === "number" ? l.delivered : 0,
              }))
            : [],
        },
        events: {
          pending: null, // never restore a mid-event freeze
          active: Array.isArray(parsed.events?.active) ? parsed.events.active : [],
          daysSince: typeof parsed.events?.daysSince === "number" ? parsed.events.daysSince : 0,
        },
        grinch: {
          // The heist resumes from its saved countdown (no dodging by reloading).
          active: parsed.grinch?.active ?? null,
          // New real-time cooldown; migrate old day-based saves (daysSince) into
          // the seconds still left on their warm-up.
          cooldownSeconds:
            typeof parsed.grinch?.cooldownSeconds === "number"
              ? parsed.grinch.cooldownSeconds
              : Math.max(0, (GRINCH_MIN_GAP_DAYS - (parsed.grinch?.daysSince ?? 0)) * SECONDS_PER_GAME_DAY),
        },
        pipeline: { queueModes: { ...(parsed.pipeline?.queueModes ?? {}) } },
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

      if (state.meta.runOutcome !== "won" && state.meta.runOutcome !== "lost") {
        state.meta.runOutcome = null;
      }

      // Runtime-only fields: never replay stale alerts; ensure stations exists.
      state.pendingAlerts = [];
      state.pendingCelebrations = [];
      state.meta.isPaused = false; // never load into a frozen event state
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

  /** Carry orders through; older saves without them start empty (regenerated). */
  function migrateOrders(o: any, fresh: GameState): GameState["orders"] {
    if (!o || typeof o !== "object") return fresh.orders;
    const list = (arr: any): GameState["orders"]["offers"] =>
      (Array.isArray(arr) ? arr : []).map(migrateOrder);
    return {
      offers: list(o.offers),
      active: list(o.active),
      lastRefreshDay: typeof o.lastRefreshDay === "number" ? o.lastRefreshDay : 0,
      seq: typeof o.seq === "number" ? o.seq : 1,
    };
  }

  /** Normalize one saved order into the multi-line shape (old orders had a
   *  single toyType/quantity/delivered — wrap those into one line). */
  function migrateOrder(o: any): GameState["orders"]["offers"][number] {
    const num = (v: any) => (typeof v === "number" ? v : 0);
    const lines = Array.isArray(o?.lines)
      ? o.lines.map((l: any) => ({
          toyType: String(l?.toyType ?? "plushy"),
          quantity: num(l?.quantity),
          delivered: num(l?.delivered),
        }))
      : [{ toyType: String(o?.toyType ?? "plushy"), quantity: num(o?.quantity), delivered: num(o?.delivered) }];
    return {
      id: num(o?.id),
      templateId: String(o?.templateId ?? "small"),
      lines,
      reward: num(o?.reward),
      daysLeft: num(o?.daysLeft),
      rush: !!o?.rush,
      ...(typeof o?.secondsLeft === "number" ? { secondsLeft: o.secondsLeft } : {}),
    };
  }

  return { save, load, peek, clear, migrateLegacy, SLOT_COUNT };
}

export type SaveSystem = ReturnType<typeof createSaveSystem>;
