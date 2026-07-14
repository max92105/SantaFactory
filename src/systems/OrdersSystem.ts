/**
 * OrdersSystem — delivery orders.
 *
 * Each new day a fresh set of offers is generated (only for UNLOCKED toys,
 * favouring the day's event's featured toy). Orders can request several
 * different toys at once, so fulfilment means keeping varied stock — not just
 * volume. Accept an offer to start filling it; complete every line before the
 * deadline for a reward that scales with the toys' value, amounts, template and
 * any active event. Rush orders (see update) pop up in real time.
 *
 * Tuning: config/ordersConfig.ts · Calendar: config/eventsConfig.ts
 */

import type { GameState, Order, OrderLine, GrandOrder } from "../state/GameState";
import {
  ORDER_OFFERS_PER_DAY,
  MAX_ACTIVE_ORDERS,
  RUSH_ORDER,
  orderTemplates,
  type OrderTemplate,
} from "../config/ordersConfig";
import {
  grandOrderDefs,
  GRAND_ANNOUNCE_DAYS_BEFORE,
  GRAND_PAY_MULT,
  GRAND_MIN_QTY,
  GRAND_MAX_QTY,
  GRAND_FEATURED_MULT,
  type GrandOrderDef,
} from "../config/grandOrdersConfig";
import { getActiveEvent, type GameEvent } from "../config/eventsConfig";
import { getToyType, type ToyTypeDef } from "../config/toyTypesConfig";
import { getUnlockedToyTypes } from "../helpers/unlockHelpers";
import { removeFromStage } from "../helpers/inventoryHelpers";
import { deliverableToLine, orderRemaining, isOrderComplete } from "../helpers/orderHelpers";

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

  /** Pick `count` DISTINCT unlocked toys, favouring the event's featured one. */
  function pickDistinctToys(unlocked: ToyTypeDef[], event: GameEvent | undefined, count: number): ToyTypeDef[] {
    const want = Math.max(1, Math.min(count, unlocked.length));
    const pool = [...unlocked];
    const chosen: ToyTypeDef[] = [];

    if (event?.featuredToy) {
      const fi = pool.findIndex((t) => t.id === event.featuredToy);
      if (fi >= 0 && Math.random() < 0.6) chosen.push(pool.splice(fi, 1)[0]);
    }
    while (chosen.length < want && pool.length > 0) {
      chosen.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
    }
    return chosen;
  }

  /** Build the toy lines for an order from a per-line quantity range. */
  function buildLines(toys: ToyTypeDef[], minQty: number, maxQty: number): OrderLine[] {
    return toys.map((toy) => ({ toyType: toy.id, quantity: randInt(minQty, maxQty), delivered: 0 }));
  }

  /** Reward for a set of lines: their total sell value, marked up. */
  function rewardFor(lines: OrderLine[], payMult: number, eventMult: number): number {
    const base = lines.reduce((s, l) => s + l.quantity * (getToyType(l.toyType)?.baseSellValue ?? 1), 0);
    return Math.max(1, Math.round(base * payMult * eventMult));
  }

  /** "20× Plushy, 15× Rubik's Cube" — for status text and alerts. */
  function linesText(order: { lines: OrderLine[] }): string {
    return order.lines.map((l) => `${l.quantity}× ${getToyType(l.toyType)?.name ?? "toy"}`).join(", ");
  }

  function makeOrder(state: GameState, tpl: OrderTemplate, unlocked: ToyTypeDef[], event: GameEvent | undefined): Order {
    const toys = pickDistinctToys(unlocked, event, randInt(tpl.minLines, tpl.maxLines));
    const lines = buildLines(toys, tpl.minQty, tpl.maxQty);
    return {
      id: state.orders.seq++,
      templateId: tpl.id,
      lines,
      reward: rewardFor(lines, tpl.payMult, event ? event.orderPayMult : 1),
      daysLeft: randInt(tpl.minDays, tpl.maxDays),
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
      offers.push(makeOrder(state, pickWeighted(orderTemplates), unlocked, event));
    }
    return offers;
  }

  /** Build a one-off rush order (real-time deadline set by the caller). */
  function makeRushOrder(state: GameState, unlocked: ToyTypeDef[], event: GameEvent | undefined): Order {
    const toys = pickDistinctToys(unlocked, event, randInt(RUSH_ORDER.minLines, RUSH_ORDER.maxLines));
    const lines = buildLines(toys, RUSH_ORDER.minQty, RUSH_ORDER.maxQty);
    return {
      id: state.orders.seq++,
      templateId: "rush",
      lines,
      reward: rewardFor(lines, RUSH_ORDER.payMult, event ? event.orderPayMult : 1),
      daysLeft: 0, // unused for rush — secondsLeft drives the deadline
      rush: true,
      secondsLeft: RUSH_ORDER.minSeconds, // overwritten by the caller
    };
  }

  /** Build a giant holiday order: every unlocked toy, huge quantities. */
  function makeGrandOrder(state: GameState, def: GrandOrderDef): GrandOrder | null {
    const unlocked = getUnlockedToyTypes(state);
    if (unlocked.length === 0) return null;

    const lines: OrderLine[] = unlocked.map((toy) => {
      let quantity = randInt(GRAND_MIN_QTY, GRAND_MAX_QTY);
      if (def.featuredToy === toy.id) quantity = Math.round(quantity * GRAND_FEATURED_MULT);
      return { toyType: toy.id, quantity, delivered: 0 };
    });
    const reward = Math.max(
      1,
      Math.round(lines.reduce((s, l) => s + l.quantity * (getToyType(l.toyType)?.baseSellValue ?? 1), 0) * GRAND_PAY_MULT)
    );
    return {
      id: state.orders.seq++,
      defId: def.id,
      name: def.name,
      icon: def.icon,
      flavor: def.flavor,
      lines,
      reward,
      deadlineDay: def.day,
      announcedDay: state.time.day,
    };
  }

  /**
   * Day-change hook for grand orders: lapse an unfinished one past its deadline,
   * then announce the next holiday whose warning window has opened.
   */
  function updateGrandOrder(state: GameState): void {
    const g = state.grand.current;
    if (g && state.time.day > g.deadlineDay) {
      state.grand.current = null;
      state.meta.statusText = `${g.icon} ${g.name} grand order missed — the stores took their business elsewhere.`;
      state.pendingAlerts.push(`${g.icon} ${g.name} grand order missed — no reward this time.`);
    }

    if (state.grand.current) return; // one at a time

    const def = grandOrderDefs.find(
      (d) =>
        !state.grand.seen.includes(d.id) &&
        state.time.day >= d.day - GRAND_ANNOUNCE_DAYS_BEFORE &&
        state.time.day <= d.day
    );
    if (!def) return;

    const order = makeGrandOrder(state, def);
    if (!order) return;

    state.grand.current = order;
    state.grand.seen.push(def.id);
    const daysLeft = def.day - state.time.day;
    state.pendingAlerts.push(
      `${def.icon} ${def.name} is coming! Stores worldwide placed a GIANT order — ${daysLeft} day${
        daysLeft === 1 ? "" : "s"
      } to prepare. Reward: $${order.reward}`
    );
    state.meta.statusText = `${def.icon} Grand order: ${def.name} — deliver everything by day ${def.day} for +$${order.reward}!`;
  }

  /**
   * Real-time tick (call every frame): counts down rush orders and expires the
   * lapsed ones, and rolls the chance to spawn a fresh rush pop-up. Returns true
   * if the offer/active lists changed (so the caller can rebuild the UI).
   */
  function update(state: GameState, dt: number): boolean {
    let changed = false;

    const tick = (list: Order[], kind: "offer" | "active"): Order[] => {
      const survivors: Order[] = [];
      for (const o of list) {
        if (o.secondsLeft == null) {
          survivors.push(o);
          continue;
        }
        o.secondsLeft -= dt;
        if (o.secondsLeft <= 0 && !isOrderComplete(o)) {
          changed = true;
          if (kind === "active") {
            state.meta.statusText = `⚡ Rush order expired — ${orderRemaining(o)} undelivered.`;
          }
          continue; // expired → drop it
        }
        survivors.push(o);
      }
      return survivors;
    };

    state.orders.offers = tick(state.orders.offers, "offer");
    state.orders.active = tick(state.orders.active, "active");

    // Maybe spawn a new rush offer — any time of day, on its own real-time
    // clock (so it can land late and be finished the next morning).
    const rushWaiting = state.orders.offers.reduce((n, o) => n + (o.rush ? 1 : 0), 0);
    if (rushWaiting < RUSH_ORDER.maxPending && Math.random() < RUSH_ORDER.chancePerSecond * dt) {
      const unlocked = getUnlockedToyTypes(state);
      if (unlocked.length > 0) {
        const event = currentEvent(state);
        const order = makeRushOrder(state, unlocked, event);
        order.secondsLeft = randInt(RUSH_ORDER.minSeconds, RUSH_ORDER.maxSeconds);
        state.orders.offers.push(order);

        const summary = linesText(order);
        state.pendingAlerts.push(
          `⚡ Rush order! ${summary} — ${Math.round(order.secondsLeft)}s, pays $${order.reward}`
        );
        state.meta.statusText = `⚡ Rush order in! ${summary} — deliver fast.`;
        changed = true;
      }
    }

    return changed;
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
        if (o.secondsLeft != null) return true; // rush orders age in real time, not days
        o.daysLeft -= 1;
        if (o.daysLeft <= 0 && !isOrderComplete(o)) {
          expired += 1;
          return false;
        }
        return true;
      });
      if (expired > 0) {
        state.meta.statusText = `${expired} order${expired > 1 ? "s" : ""} expired undelivered.`;
      }
    }

    // Keep any live rush pop-ups (real-time clock — they may span midnight) and
    // refresh only the daily board around them.
    const rushOffers = state.orders.offers.filter((o) => o.rush);
    state.orders.offers = [...rushOffers, ...generateOffers(state)];
    state.orders.lastRefreshDay = state.time.day;

    // Holiday grand orders are day-driven — announce/lapse on the day change.
    updateGrandOrder(state);
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

    state.meta.statusText = `Accepted order: ${linesText(order)} for $${order.reward}.`;
    return true;
  }

  /** Common tail for a delivery: pay + clear if complete, else report progress. */
  function settleDelivery(state: GameState, order: Order, gave: number): boolean {
    if (gave <= 0) {
      state.meta.statusText = `Nothing delivered — pick an amount you have in stock.`;
      return false;
    }
    if (isOrderComplete(order)) {
      state.resources.money += order.reward;
      state.dayStats.moneyEarned += order.reward;
      state.stats.ordersCompleted += 1;
      state.orders.active = state.orders.active.filter((o) => o.id !== order.id);
      state.meta.statusText = `Order complete! ${linesText(order)} for +$${order.reward}.`;
    } else {
      const linesLeft = order.lines.filter((l) => l.delivered < l.quantity).length;
      state.meta.statusText = `Delivered ${gave} — ${orderRemaining(order)} to go across ${linesLeft} toy${
        linesLeft === 1 ? "" : "s"
      }.`;
    }
    return true;
  }

  /** Ship as many finished toys as possible toward every line; pay on completion. */
  function deliverToOrder(state: GameState, orderId: number): boolean {
    const order = state.orders.active.find((o) => o.id === orderId);
    if (!order) return false;

    let gave = 0;
    for (const line of order.lines) {
      const give = deliverableToLine(state, line);
      if (give > 0) {
        removeFromStage(state, line.toyType, "finished", give);
        line.delivered += give;
        gave += give;
      }
    }
    return settleDelivery(state, order, gave);
  }

  /**
   * Ship the player-chosen amount of each toy (keyed by toyType). Each is capped
   * to what's owed and what's in stock, so bad numbers can't over-deliver.
   */
  function deliverAmounts(state: GameState, orderId: number, amounts: Record<string, number>): boolean {
    const order = state.orders.active.find((o) => o.id === orderId);
    if (!order) return false;

    let gave = 0;
    for (const line of order.lines) {
      const want = Math.max(0, Math.floor(amounts[line.toyType] ?? 0));
      const give = Math.min(want, deliverableToLine(state, line));
      if (give > 0) {
        removeFromStage(state, line.toyType, "finished", give);
        line.delivered += give;
        gave += give;
      }
    }
    return settleDelivery(state, order, gave);
  }

  /** Ship chosen amounts toward the pinned grand order; huge payout on completion. */
  function deliverToGrand(state: GameState, amounts: Record<string, number>): boolean {
    const g = state.grand.current;
    if (!g) return false;

    let gave = 0;
    for (const line of g.lines) {
      const want = Math.max(0, Math.floor(amounts[line.toyType] ?? 0));
      const give = Math.min(want, deliverableToLine(state, line));
      if (give > 0) {
        removeFromStage(state, line.toyType, "finished", give);
        line.delivered += give;
        gave += give;
      }
    }

    if (gave <= 0) {
      state.meta.statusText = `Nothing delivered — pick an amount you have in stock.`;
      return false;
    }

    if (isOrderComplete(g)) {
      state.resources.money += g.reward;
      state.dayStats.moneyEarned += g.reward;
      state.stats.ordersCompleted += 1;
      state.grand.current = null;
      state.meta.statusText = `🎉 ${g.name} grand order COMPLETE! Huge payday: +$${g.reward}.`;
      state.pendingAlerts.push(`🎉 ${g.icon} ${g.name} complete! +$${g.reward}`);
    } else {
      const linesLeft = g.lines.filter((l) => l.delivered < l.quantity).length;
      state.meta.statusText = `Grand order: delivered ${gave} — ${orderRemaining(g)} to go across ${linesLeft} toy${
        linesLeft === 1 ? "" : "s"
      }.`;
    }
    return true;
  }

  return {
    ensureDay,
    update,
    acceptOrder,
    deliverToOrder,
    deliverAmounts,
    deliverToGrand,
    currentEvent,
    generateOffers,
  };
}

export type OrdersSystem = ReturnType<typeof createOrdersSystem>;
