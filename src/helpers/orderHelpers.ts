/** Shared order calculations — keep derived order math here, not in the UI. */

import type { GameState, Order } from "../state/GameState";
import { getSellableStock } from "./inventoryHelpers";

export function remainingOf(order: Order): number {
  return Math.max(0, order.quantity - order.delivered);
}

/** How many units can be delivered to an order right now (stock vs remaining). */
export function deliverableTo(state: GameState, order: Order): number {
  return Math.min(remainingOf(order), getSellableStock(state, order.toyType));
}

export function progressOf(order: Order): number {
  return order.quantity > 0 ? order.delivered / order.quantity : 0;
}
