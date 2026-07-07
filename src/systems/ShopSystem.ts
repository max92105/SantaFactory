/**
 * ShopSystem — purchase logic for hire packages and upgrades.
 * Pure state changes only; the shop UI lives in ui/pages/shop/shopPage.ts.
 * Prices/definitions: config/producersConfig.ts and config/upgradesConfig.ts.
 */

import type { GameState } from "../state/GameState";
import { getProducer } from "../config/producersConfig";
import { getUpgrade } from "../config/upgradesConfig";
import { getProducerCost } from "../helpers/costHelpers";
import { pluralizeElves } from "../helpers/textHelpers";

export function createShopSystem() {
  function buyProducer(state: GameState, producerId: string): boolean {
    const def = getProducer(producerId);
    if (!def) return false;

    const owned = state.owned.producers[producerId] ?? 0;
    const cost = getProducerCost(def, owned);

    if (state.resources.money < cost) {
      state.meta.statusText = `Not enough money to buy ${def.name}.`;
      return false;
    }

    state.resources.money -= cost;
    state.owned.producers[producerId] = owned + 1;

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

  return { buyProducer, buyUpgrade };
}

export type ShopSystem = ReturnType<typeof createShopSystem>;
