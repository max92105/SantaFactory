/**
 * Toy unlock helpers — the ONLY place that answers "is this toy available?".
 * Unlocks are bought in the New Toys section (ShopSystem.buyToyUnlock) and
 * stored in state.owned.toys.
 */

import type { GameState } from "../state/GameState";
import { toyTypes, type ToyTypeDef } from "../config/toyTypesConfig";

export function isToyUnlocked(state: GameState, toyTypeId: string): boolean {
  return !!state.owned.toys[toyTypeId];
}

/** All toy types the player can currently produce/sell, in catalog order. */
export function getUnlockedToyTypes(state: GameState): ToyTypeDef[] {
  return toyTypes.filter((t) => isToyUnlocked(state, t.id));
}
