/**
 * The single mutable game state — everything that gets saved lives here.
 *
 * Rules:
 *  - Only systems (src/systems) mutate state; UI reads it and calls systems.
 *  - Inventory read/write goes through helpers/inventoryHelpers.ts.
 */

import { BASE_GIFTS_PER_CLICK } from "../config/productionConfig";
import { toyTypes } from "../config/toyTypesConfig";
import { GRINCH_MIN_GAP_DAYS } from "../config/grinchConfig";
import { SECONDS_PER_GAME_DAY } from "../config/timeConfig";

/**
 * Per-toy-type item counts. `wip1`/`wip2`/`raw`/`assembled`/`finished` are the
 * production stages (wip1/wip2 only used by categories with specialist steps);
 * `broken` holds items ruined by elf mistakes (kept, not a flow stage — may be
 * sellable-for-less or repairable later). See config/pipelineConfig.ts.
 */
export type ToyInventory = {
  wip1: number;
  wip2: number;
  raw: number;
  assembled: number;
  finished: number;
  broken: number;
};

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
  /** Skipping today entirely (workaholics burn out — rolled each morning).
   *  Keeps its schedule; just doesn't work until tomorrow. */
  dayOff?: boolean;
};

/** One toy line within an order: deliver `quantity` finished `toyType`. */
export type OrderLine = {
  toyType: string;
  quantity: number;
  delivered: number;
};

/**
 * A delivery order — fill every line with finished toys before the deadline for
 * the whole reward. Orders can request several different toys at once (see
 * OrdersSystem), so the difficulty is having varied stock ready, not just volume.
 */
export type Order = {
  id: number;
  templateId: string;
  lines: OrderLine[];
  reward: number;
  /** Days remaining to complete it (decrements each day; expires at 0).
   *  Ignored for rush orders, which use `secondsLeft` instead. */
  daysLeft: number;
  rush: boolean;
  /** Rush orders only: real-time seconds left before it expires (ticks each
   *  frame in OrdersSystem.update). Undefined for normal day-based orders. */
  secondsLeft?: number;
};

/**
 * A temporary modifier bundle applied by a random event, active while the
 * current day is <= `expiresDay`. Missing fields mean "no change" (×1).
 */
export type TimedMod = Partial<{
  speed: number; // producer speed ×
  output: number; // producer output ×
  sell: number; // sell rate ×
  gpc: number; // gifts-per-click ×
  mistake: number; // mistake chance × (>1 worse, <1 better, 0 none)
  wage: number; // daily wage × (0 = free day)
}>;

export type ActiveMod = { id: string; icon: string; label: string; expiresDay: number; mod: TimedMod };

/**
 * The Grinch's live heist threat. Two ways out, and you can pay toward EITHER in
 * chosen amounts (installments): pay the `toll` in cash (`tollPaid` accumulates),
 * or hand over `demandQty` of `demandToy` (`demandDelivered` accumulates). He
 * leaves the instant either is fully met; if `secondsLeft` hits 0 first he steals
 * `stealPct` of your finished stock.
 */
export type GrinchThreat = {
  toll: number;
  tollPaid: number;
  demandToy: string;
  demandQty: number;
  demandDelivered: number;
  stealPct: number;
  secondsLeft: number;
  taunt: string;
};

/** One of the three choices shown when a random event fires. `params` fills
 *  the desc's {amount}/{gifts} placeholders with the progress-scaled numbers
 *  the player will actually get. */
export type PendingChoice = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  params?: Record<string, string>;
};

/** A random event awaiting the player's choice (freezes the game). */
export type PendingEvent = { polarity: "good" | "bad"; choices: PendingChoice[] };

/**
 * How a SHARED step (Quality Control/Packaging, which handle every toy) chooses which
 * toy to work next:
 *  - order:    top-to-bottom — finish the first toy's queue before the next.
 *  - balanced: one of each toy in rotation, so all queues advance together.
 *  - focus:    always work `focus` toy first; others in order when it's empty.
 */
export type QueueMode = "order" | "balanced" | "focus";
export type QueueSetting = { mode: QueueMode; focus?: string };

/**
 * A GRAND ORDER — a rare, giant holiday order (config/grandOrdersConfig.ts).
 * Announced days ahead, pinned in the Orders tab, all-or-nothing: deliver every
 * line by `deadlineDay` for `reward`, or it lapses for nothing.
 */
export type GrandOrder = {
  id: number;
  defId: string;
  name: string;
  icon: string;
  flavor: string;
  lines: OrderLine[];
  reward: number;
  /** Deliver by the END of this day-of-run or it's lost. */
  deadlineDay: number;
  announcedDay: number;
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

  /** Per shared-step (Quality Control/Packaging) queue strategy. Empty = "order". */
  pipeline: {
    queueModes: Record<string, QueueSetting>;
  };

  /** Transient notification queue drained by the UI each frame (toasts). */
  pendingAlerts: string[];

  /** Transient payout celebrations (confetti + cash SFX) drained by the UI
   *  each frame. `grand` triggers the full-screen golden flash. */
  pendingCelebrations: { amount: number; grand?: boolean }[];

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

  /** The Grinch (config/grinchConfig.ts): a live heist threat + a real-time
   *  cooldown (in-game seconds until he can roll again). He can strike at any
   *  moment, so the cadence is tracked in seconds, not days. */
  grinch: {
    active: GrinchThreat | null;
    cooldownSeconds: number;
  };

  /** Random events (config/randomEventsConfig.ts): a pending choice + active timed mods. */
  events: {
    /** A choice awaiting the player — freezes the game while set. */
    pending: PendingEvent | null;
    /** Currently-active temporary modifiers from past event choices. */
    active: ActiveMod[];
    /** Days elapsed since the last event fired (drives cadence). */
    daysSince: number;
  };

  /** Rare holiday "grand orders" (config/grandOrdersConfig.ts). */
  grand: {
    /** The currently announced grand order, or null. */
    current: GrandOrder | null;
    /** defIds already announced this run (so each holiday fires once). */
    seen: string[];
  };

  /**
   * THE CHRISTMAS ORDER (config/christmasConfig.ts) — the endgame. One line per
   * toy type, quantities randomized per run (generated once by ChristmasSystem).
   * Complete every line before Christmas to win; miss it and the run is lost.
   */
  christmas: {
    lines: OrderLine[];
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
    /** Final result once the run ends: won (Christmas Order filled in time),
     *  lost (Christmas came first), or null while still playing. */
    runOutcome: "won" | "lost" | null;

    lastWageResult: string;

    isPaused: boolean;
    showDaySummary: boolean;
    lastDaySummary: DaySummary | null;
  };

  /** Which toy type the player clicks to produce. */
  selectedClickToyType: string;

  /** Click-arena persistence: where each persistent button sits, as a fraction
   *  (0..1) of the arena, so it lands in the same spot after a reload regardless
   *  of arena size. Missing id = centered. (config/clickConfig.ts) */
  clicker: {
    positions: Record<string, { x: number; y: number }>;
  };

  derived: {
    baseGpc: number;
  };
};

export function createInitialState(): GameState {
  const inventory: Record<string, ToyInventory> = {};
  const toys: Record<string, boolean> = {};
  for (const t of toyTypes) {
    inventory[t.id] = { wip1: 0, wip2: 0, raw: 0, assembled: 0, finished: 0, broken: 0 };
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
    pipeline: { queueModes: {} },
    pendingAlerts: [],
    pendingCelebrations: [],

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

    grinch: {
      active: null,
      cooldownSeconds: GRINCH_MIN_GAP_DAYS * SECONDS_PER_GAME_DAY, // initial warm-up
    },

    events: {
      pending: null,
      active: [],
      daysSince: 0,
    },

    grand: {
      current: null,
      seen: [],
    },

    christmas: {
      lines: [], // generated once by ChristmasSystem.ensureInit
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
      runOutcome: null,
      lastWageResult: "—",
      isPaused: false,
      showDaySummary: false,
      lastDaySummary: null,
    },

    selectedClickToyType: toyTypes[0]?.id ?? "plushy",

    clicker: { positions: {} },

    derived: {
      baseGpc: BASE_GIFTS_PER_CLICK,
    },
  };
}
