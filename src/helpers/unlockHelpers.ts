/**
 * Toy unlock helpers — the ONLY place that answers "is this toy available?".
 *
 * Three gates stack:
 *   1. category unlock — a non-basic toy's line can't be BOUGHT until its
 *      category's unlock upgrade is owned.
 *   2. line unlock     — bought in the New Toys shop (ShopSystem.buyToyUnlock),
 *      stored in state.owned.toys; a line must be unlocked to produce/sell it.
 *   3. hand-build      — a non-basic toy can't be hand-CLICKED until its
 *      per-toy hand-build upgrade is owned (basic toys click freely).
 */

import type { GameState } from "../state/GameState";
import {
  toyTypes,
  getToyType,
  toyCategoryId,
  toyHandbuildUpgrade,
  type ToyTypeDef,
} from "../config/toyTypesConfig";
import { getToyCategory } from "../config/toyCategoriesConfig";

/** Is a CATEGORY unlocked? (basic is always; others need their upgrade.) */
export function isCategoryUnlocked(state: GameState, categoryId: string): boolean {
  const cat = getToyCategory(categoryId);
  if (!cat?.unlockUpgrade) return true; // basic / no gate
  return !!state.owned.upgrades[cat.unlockUpgrade];
}

/** Is the toy's category unlocked? (convenience wrapper keyed by toy id.) */
export function isToyCategoryUnlocked(state: GameState, toyTypeId: string): boolean {
  const toy = getToyType(toyTypeId);
  if (!toy) return false;
  return isCategoryUnlocked(state, toyCategoryId(toy));
}

/** Can the player BUY this toy's line right now? (category unlocked + not already owned). */
export function isToyLineBuyable(state: GameState, toyTypeId: string): boolean {
  return isToyCategoryUnlocked(state, toyTypeId) && !isToyUnlocked(state, toyTypeId);
}

export function isToyUnlocked(state: GameState, toyTypeId: string): boolean {
  return !!state.owned.toys[toyTypeId];
}

/** All toy types the player can currently produce/sell, in catalog order. */
export function getUnlockedToyTypes(state: GameState): ToyTypeDef[] {
  return toyTypes.filter((t) => isToyUnlocked(state, t.id));
}

/** Unlocked toys of a given category, in catalog order. */
export function getUnlockedToysInCategory(state: GameState, categoryId: string): ToyTypeDef[] {
  return toyTypes.filter((t) => toyCategoryId(t) === categoryId && isToyUnlocked(state, t.id));
}

/** Is any toy of this category unlocked? (drives showing its specialist station.) */
export function isCategoryActive(state: GameState, categoryId: string): boolean {
  return toyTypes.some((t) => toyCategoryId(t) === categoryId && isToyUnlocked(state, t.id));
}

/**
 * Can this toy be hand-crafted with the click button? Requires its line unlocked
 * and — for a non-basic toy — its hand-build upgrade owned. Basic toys are
 * clickable the moment their line is unlocked.
 */
export function isToyClickable(state: GameState, toyTypeId: string): boolean {
  if (!isToyUnlocked(state, toyTypeId)) return false;
  const gate = toyHandbuildUpgrade(toyTypeId);
  return !gate || !!state.owned.upgrades[gate];
}

/** Toys the player can hand-click right now, in catalog order. */
export function getClickableToyTypes(state: GameState): ToyTypeDef[] {
  return toyTypes.filter((t) => isToyClickable(state, t.id));
}
