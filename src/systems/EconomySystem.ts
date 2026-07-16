/**
 * EconomySystem — selling finished toys for money.
 * Sell values per toy live in config/toyTypesConfig.ts.
 */

import type { GameState } from "../state/GameState";
import { ensureInventory, getSellableStock, getBrokenStock, removeBroken } from "../helpers/inventoryHelpers";
import { toyTypes, getToyType } from "../config/toyTypesConfig";
import { BROKEN_SALVAGE_RATE } from "../config/stationsConfig";
import { t } from "../ui/i18n/i18n";
import { toyName } from "../ui/i18n/localize";
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

    state.meta.statusText = t("sys.sold", {
      n: sellable,
      name: toyName(toyTypeId),
      money: `$${earned.toFixed(2)}`,
    });
    return earned;
  }

  /** Salvage value for one broken unit (a fraction of the normal sell price). */
  function getSalvageRate(toyTypeId: string, mods: Modifiers): number {
    return getSellRate(toyTypeId, mods) * BROKEN_SALVAGE_RATE;
  }

  /** Sell up to `amount` broken units for salvage. Returns money earned. */
  function salvageBroken(state: GameState, mods: Modifiers, toyTypeId: string, amount: number): number {
    const n = Math.max(0, Math.min(Math.floor(amount), getBrokenStock(state, toyTypeId)));
    if (n <= 0) return 0;

    const earned = n * getSalvageRate(toyTypeId, mods);
    removeBroken(state, toyTypeId, n);
    state.resources.money += earned;
    state.dayStats.moneyEarned += earned;

    state.meta.statusText = t("sys.salvaged", {
      n,
      name: toyName(toyTypeId),
      money: `$${earned.toFixed(2)}`,
    });
    return earned;
  }

  function getView(_state: GameState, mods: Modifiers): EconomyView {
    return { sellRates: getSellRates(mods) };
  }

  return { sellItems, salvageBroken, getSalvageRate, getView, getSellRate, getSellRates };
}

export type EconomySystem = ReturnType<typeof createEconomySystem>;
