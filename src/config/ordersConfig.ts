/**
 * Orders / deliveries tuning — used by OrdersSystem.
 *
 * Every day a fresh set of order OFFERS appears. Accept one and it becomes an
 * ACTIVE order you fill with finished toys; completing it before its deadline
 * pays out. Reward scales with how "complex" the order is:
 *
 *   reward ≈ quantity × toy.baseSellValue × template.payMult × eventPayMult
 *
 * so pricier toys and bigger orders pay more (see systems/OrdersSystem.ts).
 *
 * To add a new kind of order, add an OrderTemplate below. Everything else
 * (spawning, the UI, deadlines) picks it up automatically.
 */

export type OrderTemplate = {
  id: string;
  name: string;
  /** Relative spawn weight among templates. */
  weight: number;

  /** How many DIFFERENT toys the order asks for (inclusive range, capped by how
   *  many toys are unlocked). >1 means you need varied stock, not just volume. */
  minLines: number;
  maxLines: number;

  /** Quantity requested PER toy line (inclusive random range). */
  minQty: number;
  maxQty: number;

  /** Days allowed to complete it (inclusive random range). 1 = same-day rush. */
  minDays: number;
  maxDays: number;

  /** Reward multiplier over the toys' base sell value. >1 beats plain selling. */
  payMult: number;

  /** Flagged as an urgent rush job (shown with a badge). */
  rush: boolean;
};

/** How many order offers appear each day (before event bonuses). */
export const ORDER_OFFERS_PER_DAY = 4;

/** Most orders you can have accepted (in progress) at once. */
export const MAX_ACTIVE_ORDERS = 6;

// Quantities are deliberately steep: casual clicking shouldn't clear a day's
// orders. Real fulfilment means running production lines and stockpiling — and
// multi-toy orders force you to keep several toys in stock at once.
export const orderTemplates: OrderTemplate[] = [
  {
    id: "small",
    name: "Small Order",
    weight: 4,
    minLines: 1,
    maxLines: 2,
    minQty: 25,
    maxQty: 50,
    minDays: 2,
    maxDays: 3,
    payMult: 1.3,
    rush: false,
  },
  {
    id: "standard",
    name: "Standard Order",
    weight: 3,
    minLines: 2,
    maxLines: 3,
    minQty: 60,
    maxQty: 130,
    minDays: 3,
    maxDays: 5,
    payMult: 1.55,
    rush: false,
  },
  {
    id: "bulk",
    name: "Bulk Order",
    weight: 2,
    minLines: 3,
    maxLines: 4,
    minQty: 150,
    maxQty: 320,
    minDays: 6,
    maxDays: 8,
    payMult: 1.85,
    rush: false,
  },
];

export function getOrderTemplate(id: string): OrderTemplate | undefined {
  return orderTemplates.find((t) => t.id === id);
}

/**
 * RUSH ORDERS — dynamic, time-pressured pop-ups. Unlike the daily board above,
 * these appear at random *during* the day (see OrdersSystem.update): a toast
 * fires, the Orders tab flashes a badge, and a live countdown ticks in real
 * seconds. Rules that keep them fair:
 *   • only spawn while there's at least a quarter-day of daylight left, so the
 *     player always gets ≥ `minSeconds` to react and deliver;
 *   • they must be filled before night (`nightStartsAt`);
 *   • it's fine if you can't always fill them — that's the tension.
 * Everything here is tunable; timings are in REAL seconds (day = SECONDS_PER_GAME_DAY).
 */
export const RUSH_ORDER = {
  /** Per-second chance a rush pops up while eligible (~1 per day at 300s/day). */
  chancePerSecond: 0.008,
  /** Never leave more than this many rush offers waiting at once. */
  maxPending: 2,
  /** How many different toys a rush asks for (capped by unlocked count). A
   *  2-toy rush can't be click-farmed in the window — you need stock ready. */
  minLines: 1,
  maxLines: 2,
  /** Quantity requested PER toy line (inclusive random range). Big enough that
   *  filling from clicks alone in the short window is often impossible. */
  minQty: 50,
  maxQty: 140,
  /** Reward multiplier — rush pays a premium for the pressure. */
  payMult: 2.6,
  /** Guaranteed minimum lifetime in real seconds (a "quarter day" at 300s/day).
   *  Also the eligibility gate: no rush spawns unless this much daylight remains. */
  minSeconds: 75,
  /** Longest lifetime in real seconds — a snappy ~1.5 min. */
  maxSeconds: 90,
  /** Day-progress (0..1) at which night begins; rush must be done before it. */
  nightStartsAt: 0.75,
};
