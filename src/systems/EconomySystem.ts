/**
 * EconomySystem — selling finished toys for money.
 * Sell values per toy live in config/toyTypesConfig.ts.
 */

import type { GameState } from "../state/GameState";
import { ensureInventory, getSellableStock } from "../helpers/inventoryHelpers";
import { toyTypes, getToyType } from "../config/toyTypesConfig";
import { pluralize } from "../helpers/textHelpers";
import type { Modifiers } from "./ModifierSystem";

export type SellRateEntry = { toyType: string; name: string; icon: string; rate: number };

export type EconomyView = {
  sellRates: SellRateEntry[];
};

export function createEconomySystem() {
  /** Current sell price for one finished unit of a toy type (upgrades included). */
  function getSellRate(toyTypeId: string, mods: Modifiers): number {
    const def = getToyType(toyTypeId);
    return (def?.baseSellValue ?? 1) * mods.sellRateMult;
  }

  function getSellRates(mods: Modifiers): SellRateEntry[] {
    return toyTypes.map((t) => ({
      toyType: t.id,
      name: t.name,
      icon: t.icon,
      rate: getSellRate(t.id, mods),
    }));
  }

  /** Sell up to `amount` finished units. Returns money earned (0 if nothing sold). */
  function sellItems(state: GameState, mods: Modifiers, toyTypeId: string, amount: number): number {
    const inv = ensureInventory(state, toyTypeId);
    const sellable = Math.max(0, Math.min(amount, getSellableStock(state, toyTypeId)));
    if (sellable <= 0) return 0;

    const rate = getSellRate(toyTypeId, mods);
    const earned = sellable * rate;

    inv.finished -= sellable;
    state.resources.money += earned;

    state.stats.lifetimeSoldGifts += sellable;
    state.dayStats.giftsSold += sellable;
    state.dayStats.moneyEarned += earned;

    const def = getToyType(toyTypeId);
    const label = def?.name ?? toyTypeId;
    state.meta.statusText = `Sold ${sellable} ${pluralize(sellable, label)} for $${earned.toFixed(2)}.`;
    return earned;
  }

  function getView(_state: GameState, mods: Modifiers): EconomyView {
    return { sellRates: getSellRates(mods) };
  }

  return { sellItems, getView, getSellRate, getSellRates };
}

export type EconomySystem = ReturnType<typeof createEconomySystem>;
