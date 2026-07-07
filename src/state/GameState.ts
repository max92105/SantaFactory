import { BASE_GIFTS_PER_CLICK } from "./defaults";
import { toyTypes } from "../data/toyTypes";
import type { DaySummary } from "../systems/DailySummarySystem.ts";

export type ToyInventory = { raw: number; assembled: number; finished: number };

export type GameState = {
  resources: {
    money: number;
    lifetimeGifts: number;
  };

  // Per toy type inventory: { plushy: { raw: 5, assembled: 3, finished: 10 }, ... }
  inventory: Record<string, ToyInventory>;

  // Workforce management
  workforce: {
    totalElves: number;
    // How many elves are assigned to each pipeline step
    assignments: Record<string, number>; // stepId -> elf count
    // Unassigned elves (available to assign)
    unassigned: number;
  };

  stats: {
    lifetimeSoldGifts: number;
  };

  // Stats that reset every day (debug + balancing)
  dayStats: {
    giftsMade: number;
    giftsSold: number;
    moneyEarned: number;

    wagesDue: number;
    wagesPaid: number;

    moneyStart: number;
    moneyEnd: number;
  };

  time: {
    day: number;
    dayProgress: number;
  };

  owned: {
    producers: Record<string, number>;
    upgrades: Record<string, boolean>;
  };

  meta: {
    lastSavedAt: number | null;
    statusText: string;
    isRunOver: boolean;

    lastWageResult: string;

    isPaused: boolean;
    showDaySummary: boolean;
    lastDaySummary: DaySummary | null;
  };

  // Which toy type the player clicks to produce
  selectedClickToyType: string;

  derived: {
    baseGpc: number;
  };
};

export function createInitialState(): GameState {
  const inventory: Record<string, ToyInventory> = {};
  for (const t of toyTypes) {
    inventory[t.id] = { raw: 0, assembled: 0, finished: 0 };
  }

  return {
    resources: {
      money: 0,
      lifetimeGifts: 0,
    },

    inventory,

    workforce: {
      totalElves: 0,
      assignments: {},
      unassigned: 0,
    },

    stats: {
      lifetimeSoldGifts: 0,
    },

    dayStats: {
      giftsMade: 0,
      giftsSold: 0,
      moneyEarned: 0,
      wagesDue: 0,
      wagesPaid: 0,
      moneyStart: 0,
      moneyEnd: 0,
    },

    time: {
      day: 1,
      dayProgress: 0,
    },

    owned: {
      producers: {},
      upgrades: {},
    },

    meta: {
      lastSavedAt: null,
      statusText: "Ready.",
      isRunOver: false,
      lastWageResult: "—",
      isPaused: false,
      showDaySummary: false,
      lastDaySummary: null,
    },

    selectedClickToyType: toyTypes[0]?.id ?? "plushy",

    derived: {
      baseGpc: BASE_GIFTS_PER_CLICK,
    },
  };
}

// ── Inventory helpers ──────────────────────────────────────────────────

import type { ProductionStage } from "../data/pipeline";

export function ensureInventory(state: GameState, toyType: string): ToyInventory {
  if (!state.inventory[toyType]) {
    state.inventory[toyType] = { raw: 0, assembled: 0, finished: 0 };
  }
  return state.inventory[toyType];
}

export function getStageCount(state: GameState, toyType: string, stage: ProductionStage): number {
  return ensureInventory(state, toyType)[stage];
}

export function addToStage(state: GameState, toyType: string, stage: ProductionStage, amount: number): void {
  const inv = ensureInventory(state, toyType);
  inv[stage] += amount;
  if (stage === "finished") {
    state.resources.lifetimeGifts += amount;
    state.dayStats.giftsMade += amount;
  }
}

export function removeFromStage(state: GameState, toyType: string, stage: ProductionStage, amount: number): boolean {
  const inv = ensureInventory(state, toyType);
  if (inv[stage] < amount) return false;
  inv[stage] -= amount;
  return true;
}

export function getTotalFinished(state: GameState): number {
  let total = 0;
  for (const inv of Object.values(state.inventory)) {
    total += inv.finished;
  }
  return total;
}