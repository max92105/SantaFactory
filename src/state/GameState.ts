/**
 * The single mutable game state — everything that gets saved lives here.
 *
 * Rules:
 *  - Only systems (src/systems) mutate state; UI reads it and calls systems.
 *  - Inventory read/write goes through helpers/inventoryHelpers.ts.
 */

import { BASE_GIFTS_PER_CLICK } from "../config/productionConfig";
import { toyTypes } from "../config/toyTypesConfig";

/** Per-toy-type item counts at each production stage. */
export type ToyInventory = { raw: number; assembled: number; finished: number };

/** End-of-day recap data (produced by DailySummarySystem — not wired into the loop yet). */
export type DaySummary = {
  dayNumber: number;

  giftsMade: number;
  giftsSold: number;

  moneyEarned: number;
  wagesDue: number;
  wagesPaid: number;

  moneyStart: number;
  moneyEnd: number;
  netChange: number;

  note: string;
};

export type GameState = {
  resources: {
    money: number;
    lifetimeGifts: number;
  };

  /** Per toy type inventory: { plushy: { raw: 5, assembled: 3, finished: 10 }, ... } */
  inventory: Record<string, ToyInventory>;

  workforce: {
    totalElves: number;
    /** How many elves are assigned to each pipeline step (stepId -> count). */
    assignments: Record<string, number>;
    /** Elves available to assign. */
    unassigned: number;
  };

  stats: {
    lifetimeSoldGifts: number;
  };

  /** Stats that reset every day (debug + balancing). */
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
    dayProgress: number; // 0..1
  };

  owned: {
    /** Purchase history per hire package (drives unlock rules, not prices). */
    producers: Record<string, number>;
    upgrades: Record<string, boolean>;
    /** Toy lines the player has unlocked (see helpers/unlockHelpers.ts). */
    toys: Record<string, boolean>;
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

  /** Which toy type the player clicks to produce. */
  selectedClickToyType: string;

  derived: {
    baseGpc: number;
  };
};

export function createInitialState(): GameState {
  const inventory: Record<string, ToyInventory> = {};
  const toys: Record<string, boolean> = {};
  for (const t of toyTypes) {
    inventory[t.id] = { raw: 0, assembled: 0, finished: 0 };
    toys[t.id] = t.unlockCost <= 0; // free toys start unlocked
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
      toys,
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
