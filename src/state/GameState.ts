/**
 * The single mutable game state — everything that gets saved lives here.
 *
 * Rules:
 *  - Only systems (src/systems) mutate state; UI reads it and calls systems.
 *  - Inventory read/write goes through helpers/inventoryHelpers.ts.
 */

import { BASE_GIFTS_PER_CLICK } from "../config/productionConfig";
import { toyTypes } from "../config/toyTypesConfig";

/**
 * Per-toy-type item counts. `raw`/`assembled`/`finished` are the production
 * stages; `broken` holds items ruined by elf mistakes (kept, not a stage —
 * may be sellable-for-less or repairable later).
 */
export type ToyInventory = { raw: number; assembled: number; finished: number; broken: number };

/**
 * One physical elf. The elf is the unit of assignment: when scheduled it works
 * ONE step and covers a fixed set of shift slots (all chosen at assignment).
 * Pulling it clears its whole schedule and marks it `spent` — idle until tomorrow.
 *
 *  - idle:     step === null, slots === [], spent === false  (assignable)
 *  - on shift: step set,      slots set,    spent === false
 *  - spent:    step === null, slots === [], spent === true   (until day reset)
 */
export type ElfInstance = {
  id: number;
  type: string;
  step: string | null;
  slots: string[];
  spent: boolean;
};

/** A delivery order: fill it with `quantity` finished `toyType` before the deadline. */
export type Order = {
  id: number;
  templateId: string;
  toyType: string;
  quantity: number;
  delivered: number;
  reward: number;
  /** Days remaining to complete it (decrements each day; expires at 0).
   *  Ignored for rush orders, which use `secondsLeft` instead. */
  daysLeft: number;
  rush: boolean;
  /** Rush orders only: real-time seconds left before it expires (ticks each
   *  frame in OrdersSystem.update). Undefined for normal day-based orders. */
  secondsLeft?: number;
};

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
    /** Every physical elf is tracked individually (see ElfInstance). */
    elves: ElfInstance[];
    /** Monotonic id source for new elves. */
    nextId: number;
  };

  /** Per-step (station) runtime state — currently just breakdowns. */
  stations: Record<string, { broken: boolean }>;

  /** Transient notification queue drained by the UI each frame (toasts). */
  pendingAlerts: string[];

  stats: {
    lifetimeSoldGifts: number;
    /** Items ruined by elf mistakes over the whole run. */
    lifetimeRuined: number;
    /** Delivery orders completed over the whole run. */
    ordersCompleted: number;
  };

  /** Daily delivery orders (offers refresh each day; active are in progress). */
  orders: {
    offers: Order[];
    active: Order[];
    /** Day the offers were last generated (drives the daily refresh). */
    lastRefreshDay: number;
    /** Id source for new orders. */
    seq: number;
  };

  /** Stats that reset every day (debug + balancing). */
  dayStats: {
    giftsMade: number;
    giftsSold: number;
    moneyEarned: number;
    /** Items ruined by elf mistakes today. */
    ruined: number;

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
    inventory[t.id] = { raw: 0, assembled: 0, finished: 0, broken: 0 };
    toys[t.id] = t.unlockCost <= 0; // free toys start unlocked
  }

  return {
    resources: {
      money: 0,
      lifetimeGifts: 0,
    },

    inventory,

    workforce: {
      elves: [],
      nextId: 1,
    },

    stations: {},
    pendingAlerts: [],

    stats: {
      lifetimeSoldGifts: 0,
      lifetimeRuined: 0,
      ordersCompleted: 0,
    },

    orders: {
      offers: [],
      active: [],
      lastRefreshDay: 0,
      seq: 1,
    },

    dayStats: {
      giftsMade: 0,
      giftsSold: 0,
      moneyEarned: 0,
      ruined: 0,
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
