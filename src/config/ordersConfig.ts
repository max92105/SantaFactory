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

  /** Quantity requested (inclusive random range). */
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

export const orderTemplates: OrderTemplate[] = [
  {
    id: "small",
    name: "Small Order",
    weight: 4,
    minQty: 5,
    maxQty: 15,
    minDays: 2,
    maxDays: 3,
    payMult: 1.3,
    rush: false,
  },
  {
    id: "standard",
    name: "Standard Order",
    weight: 3,
    minQty: 20,
    maxQty: 45,
    minDays: 3,
    maxDays: 5,
    payMult: 1.5,
    rush: false,
  },
  {
    id: "bulk",
    name: "Bulk Order",
    weight: 2,
    minQty: 70,
    maxQty: 150,
    minDays: 5,
    maxDays: 7,
    payMult: 1.8,
    rush: false,
  },
  {
    id: "rush",
    name: "Rush Order",
    weight: 1,
    minQty: 25,
    maxQty: 50,
    minDays: 1,
    maxDays: 1,
    payMult: 2.4,
    rush: true,
  },
];

export function getOrderTemplate(id: string): OrderTemplate | undefined {
  return orderTemplates.find((t) => t.id === id);
}
