/**
 * ShopSystem — purchase logic for toy unlocks, hire packages and upgrades.
 * Pure state changes only; the UI lives in ui/pages/shop/shopPage.ts.
 * Prices/definitions: config/toyTypesConfig.ts, config/producersConfig.ts
 * and config/upgradesConfig.ts.
 */

import type { GameState } from "../state/GameState";
import { getProducer } from "../config/producersConfig";
import { getUpgrade } from "../config/upgradesConfig";
import { getToyType } from "../config/toyTypesConfig";
import { getProducerCostForState } from "../helpers/costHelpers";
import { isToyUnlocked } from "../helpers/unlockHelpers";
import { pluralizeElves } from "../helpers/textHelpers";

export function createShopSystem() {
  function buyProducer(state: GameState, producerId: string): boolean {
    const def = getProducer(producerId);
    if (!def) return false;

    const cost = getProducerCostForState(def, state);

    if (state.resources.money < cost) {
      state.meta.statusText = `Not enough money to buy ${def.name}.`;
      return false;
    }

    state.resources.money -= cost;
    state.owned.producers[producerId] = (state.owned.producers[producerId] ?? 0) + 1;

    // New hires land in the unassigned pool
    state.workforce.totalElves += def.elvesProvided;
    state.workforce.unassigned += def.elvesProvided;

    state.meta.statusText = `Hired ${def.name} (+${def.elvesProvided} ${pluralizeElves(def.elvesProvided)}).`;
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

  return { buyProducer, buyUpgrade, buyToyUnlock };
}

export type ShopSystem = ReturnType<typeof createShopSystem>;
