/** Shared order calculations — keep derived order math here, not in the UI. */

import type { GameState, OrderLine } from "../state/GameState";
import { getSellableStock } from "./inventoryHelpers";

/** Anything fillable with toy lines: a daily Order OR a GrandOrder. */
type Fillable = { lines: OrderLine[] };

export function remainingOfLine(line: OrderLine): number {
  return Math.max(0, line.quantity - line.delivered);
}

/** Units still owed across every line of the order. */
export function orderRemaining(order: Fillable): number {
  return order.lines.reduce((s, l) => s + remainingOfLine(l), 0);
}

/** Total units the order asks for (all lines). */
export function orderQuantity(order: Fillable): number {
  return order.lines.reduce((s, l) => s + l.quantity, 0);
}

/** Total units delivered so far (all lines). */
export function orderDelivered(order: Fillable): number {
  return order.lines.reduce((s, l) => s + l.delivered, 0);
}

/** How many units of one line can ship right now (stock vs remaining). */
export function deliverableToLine(state: GameState, line: OrderLine): number {
  return Math.min(remainingOfLine(line), getSellableStock(state, line.toyType));
}

/** How many units can be delivered to the whole order right now (all lines). */
export function deliverableTo(state: GameState, order: Fillable): number {
  return order.lines.reduce((s, l) => s + deliverableToLine(state, l), 0);
}

export function isOrderComplete(order: Fillable): boolean {
  return order.lines.every((l) => l.delivered >= l.quantity);
}

export function progressOf(order: Fillable): number {
  const q = orderQuantity(order);
  return q > 0 ? orderDelivered(order) / q : 0;
}
