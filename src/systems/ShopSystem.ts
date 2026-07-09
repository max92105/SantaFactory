/**
 * ShopSystem — purchase logic for toy unlocks, elf hires and upgrades.
 * Pure state changes only; the UI lives in ui/pages/shop/shopPage.ts.
 * Prices/definitions: config/toyTypesConfig.ts, config/elfTypesConfig.ts
 * and config/upgradesConfig.ts.
 */

import type { GameState } from "../state/GameState";
import { getElfType } from "../config/elfTypesConfig";
import { getUpgrade } from "../config/upgradesConfig";
import { getToyType } from "../config/toyTypesConfig";
import { getElfCost } from "../helpers/costHelpers";
import { addElf, countOfType } from "../helpers/workforceHelpers";
import { isToyUnlocked } from "../helpers/unlockHelpers";

export function createShopSystem() {
  /** Hire one elf of the given type into the unassigned pool. */
  function buyElf(state: GameState, elfTypeId: string): boolean {
    const def = getElfType(elfTypeId);
    if (!def) return false;

    const cost = getElfCost(def, countOfType(state, elfTypeId));
    if (state.resources.money < cost) {
      state.meta.statusText = `Not enough money to hire a ${def.name}.`;
      return false;
    }

    state.resources.money -= cost;
    addElf(state, elfTypeId);
    state.meta.statusText = `Hired a ${def.name}. Schedule their shifts in the Factory.`;
    return true;
  }

  function buyUpgrade(state: GameState, upgradeId: string): boolean {
    const def = getUpgrade(upgradeId);
    if (!def) return false;
    if (state.owned.upgrades[upgradeId]) return false;

    if (state.resources.money < def.cost) {
      state.meta.statusText = `Not enough money to buy ${def.name}.`;
      return false;
    }

    state.resources.money -= def.cost;
    state.owned.upgrades[upgradeId] = true;
    state.meta.statusText = `Purchased upgrade: ${def.name}.`;
    return true;
  }

  /** One-time unlock of a new toy line (New Toys section). */
  function buyToyUnlock(state: GameState, toyTypeId: string): boolean {
    const def = getToyType(toyTypeId);
    if (!def) return false;
    if (isToyUnlocked(state, toyTypeId)) return false;

    if (state.resources.money < def.unlockCost) {
      state.meta.statusText = `Not enough money to unlock ${def.name}.`;
      return false;
    }

    state.resources.money -= def.unlockCost;
    state.owned.toys[toyTypeId] = true;
    state.meta.statusText = `New toy unlocked: ${def.icon} ${def.name}!`;
    return true;
  }

  return { buyElf, buyUpgrade, buyToyUnlock };
}

export type ShopSystem = ReturnType<typeof createShopSystem>;
