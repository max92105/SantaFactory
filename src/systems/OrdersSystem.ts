/**
 * OrdersSystem — daily delivery orders.
 *
 * Each new day a fresh set of offers is generated (only for UNLOCKED toys,
 * favouring the day's event's featured toy). Accept an offer to start filling
 * it with finished toys; complete it before the deadline for a reward that
 * scales with the toys' value, the amount, the template and any active event.
 *
 * Tuning: config/ordersConfig.ts · Calendar: config/eventsConfig.ts
 */

import type { GameState, Order } from "../state/GameState";
import {
  ORDER_OFFERS_PER_DAY,
  MAX_ACTIVE_ORDERS,
  orderTemplates,
  type OrderTemplate,
} from "../config/ordersConfig";
import { getActiveEvent, type GameEvent } from "../config/eventsConfig";
import { getToyType, type ToyTypeDef } from "../config/toyTypesConfig";
import { getUnlockedToyTypes } from "../helpers/unlockHelpers";
import { removeFromStage } from "../helpers/inventoryHelpers";
import { deliverableTo, remainingOf } from "../helpers/orderHelpers";
import { pluralize } from "../helpers/textHelpers";

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

export function createOrdersSystem() {
  function currentEvent(state: GameState): GameEvent | undefined {
    return getActiveEvent(state.time.day);
  }

  function pickToy(unlocked: ToyTypeDef[], event: GameEvent | undefined): ToyTypeDef {
    if (event?.featuredToy) {
      const featured = unlocked.find((t) => t.id === event.featuredToy);
      if (featured && Math.random() < 0.5) return featured;
    }
    return unlocked[randInt(0, unlocked.length - 1)];
  }

  function makeOrder(state: GameState, tpl: OrderTemplate, toy: ToyTypeDef, event: GameEvent | undefined): Order {
    const quantity = randInt(tpl.minQty, tpl.maxQty);
    const daysLeft = randInt(tpl.minDays, tpl.maxDays);
    const eventMult = event ? event.orderPayMult : 1;
    const reward = Math.max(1, Math.round(quantity * toy.baseSellValue * tpl.payMult * eventMult));
    return {
      id: state.orders.seq++,
      templateId: tpl.id,
      toyType: toy.id,
      quantity,
      delivered: 0,
      reward,
      daysLeft,
      rush: tpl.rush,
    };
  }

  function generateOffers(state: GameState): Order[] {
    const unlocked = getUnlockedToyTypes(state);
    if (unlocked.length === 0) return [];

    const event = currentEvent(state);
    const count = ORDER_OFFERS_PER_DAY + (event?.extraOffers ?? 0);

    const offers: Order[] = [];
    for (let i = 0; i < count; i++) {
      const tpl = pickWeighted(orderTemplates);
      offers.push(makeOrder(state, tpl, pickToy(unlocked, event), event));
    }
    return offers;
  }

  /**
   * Make sure offers exist for the current day; on a day change, age active
   * orders (expire overdue ones) and roll fresh offers. Returns true if it
   * changed anything (so the caller can refresh the UI).
   */
  function ensureDay(state: GameState): boolean {
    if (state.orders.lastRefreshDay === state.time.day) return false;

    const firstInit = state.orders.lastRefreshDay === 0;
    if (!firstInit) {
      let expired = 0;
      state.orders.active = state.orders.active.filter((o) => {
        o.daysLeft -= 1;
        if (o.daysLeft <= 0 && o.delivered < o.quantity) {
          expired += 1;
          return false;
        }
        return true;
      });
      if (expired > 0) {
        state.meta.statusText = `${expired} order${expired > 1 ? "s" : ""} expired undelivered.`;
      }
    }

    state.orders.offers = generateOffers(state);
    state.orders.lastRefreshDay = state.time.day;
    return true;
  }

  /** Accept an offered order (moves it to active), if under the active cap. */
  function acceptOrder(state: GameState, orderId: number): boolean {
    if (state.orders.active.length >= MAX_ACTIVE_ORDERS) {
      state.meta.statusText = `You can't take on more than ${MAX_ACTIVE_ORDERS} orders at once.`;
      return false;
    }
    const idx = state.orders.offers.findIndex((o) => o.id === orderId);
    if (idx < 0) return false;

    const [order] = state.orders.offers.splice(idx, 1);
    state.orders.active.push(order);

    const name = getToyType(order.toyType)?.name ?? "toy";
    state.meta.statusText = `Accepted order: ${order.quantity} ${pluralize(order.quantity, name)} for $${order.reward}.`;
    return true;
  }

  /** Ship as many finished toys as possible toward an order; pay on completion. */
  function deliverToOrder(state: GameState, orderId: number): boolean {
    const order = state.orders.active.find((o) => o.id === orderId);
    if (!order) return false;

    const give = deliverableTo(state, order);
    const name = getToyType(order.toyType)?.name ?? "toy";
    if (give <= 0) {
      state.meta.statusText = `No finished ${name} in stock to deliver.`;
      return false;
    }

    removeFromStage(state, order.toyType, "finished", give);
    order.delivered += give;

    if (order.delivered >= order.quantity) {
      state.resources.money += order.reward;
      state.dayStats.moneyEarned += order.reward;
      state.stats.ordersCompleted += 1;
      state.orders.active = state.orders.active.filter((o) => o.id !== order.id);
      state.meta.statusText = `Order complete! Delivered ${order.quantity} ${pluralize(
        order.quantity,
        name
      )} for +$${order.reward}.`;
    } else {
      state.meta.statusText = `Delivered ${give} ${name}. ${remainingOf(order)} to go.`;
    }
    return true;
  }

  return { ensureDay, acceptOrder, deliverToOrder, currentEvent, generateOffers };
}

export type OrdersSystem = ReturnType<typeof createOrdersSystem>;
