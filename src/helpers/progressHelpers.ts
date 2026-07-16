/**
 * Progress scaling — one place to measure "how far along" the player is, so
 * flat rewards/fines/tolls can grow with the run instead of becoming pocket
 * change ($1,500 matters on day 3, not on day 60).
 */

import type { GameState } from "../state/GameState";
import { getToyType } from "../config/toyTypesConfig";
import { getUnlockedToyTypes } from "./unlockHelpers";
import { getSellableStock } from "./inventoryHelpers";

/** Cash + finished stock at base sell prices — the run's wealth right now. */
export function netWorth(state: GameState): number {
  let total = state.resources.money;
  for (const toy of getUnlockedToyTypes(state)) {
    total += getSellableStock(state, toy.id) * (getToyType(toy.id)?.baseSellValue ?? 1);
  }
  return total;
}

/** Average gifts made per day over the whole run (lifetime / days played). */
export function avgDailyGifts(state: GameState): number {
  return state.resources.lifetimeGifts / Math.max(1, state.time.day);
}

/** A money amount that keeps up with wealth: at least `base`, at least `pct` of net worth. */
export function scaledMoney(state: GameState, base: number, pct: number): number {
  return Math.max(base, Math.round(netWorth(state) * pct));
}

/** A gift count that keeps up with output: at least `base`, at least `daysWorth` days of production. */
export function scaledGifts(state: GameState, base: number, daysWorth: number): number {
  return Math.max(base, Math.round(avgDailyGifts(state) * daysWorth));
}
