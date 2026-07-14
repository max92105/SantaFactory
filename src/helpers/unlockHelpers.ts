/**
 * Toy unlock helpers — the ONLY place that answers "is this toy available?".
 * Unlocks are bought in the New Toys section (ShopSystem.buyToyUnlock) and
 * stored in state.owned.toys.
 */

import type { GameState } from "../state/GameState";
import { toyTypes, getToyType, type ToyTypeDef } from "../config/toyTypesConfig";

export function isToyUnlocked(state: GameState, toyTypeId: string): boolean {
  return !!state.owned.toys[toyTypeId];
}

/** All toy types the player can currently produce/sell, in catalog order. */
export function getUnlockedToyTypes(state: GameState): ToyTypeDef[] {
  return toyTypes.filter((t) => isToyUnlocked(state, t.id));
}

/**
 * Can this toy be hand-crafted with the click button? Requires it to be
 * unlocked, and — if it gates clicking behind an upgrade (e.g. the bike) —
 * that upgrade to be owned. Toys without the gate are always clickable.
 */
export function isToyClickable(state: GameState, toyTypeId: string): boolean {
  if (!isToyUnlocked(state, toyTypeId)) return false;
  const gate = getToyType(toyTypeId)?.clickUnlockUpgrade;
  return !gate || !!state.owned.upgrades[gate];
}

/** Toys the player can hand-click right now, in catalog order. */
export function getClickableToyTypes(state: GameState): ToyTypeDef[] {
  return toyTypes.filter((t) => isToyClickable(state, t.id));
}
