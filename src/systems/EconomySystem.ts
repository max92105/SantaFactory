import type { GameState } from "../state/GameState";
import { ensureInventory } from "../state/GameState";
import { toyTypes, getToyType } from "../data/toyTypes";
import type { Modifiers } from "./ModifierSystem";

// Sellable types are toy type IDs (only finished items can be sold)
export type SellableType = string;

export type SellRateEntry = { toyType: string; name: string; icon: string; rate: number };

export type EconomyView = {
  sellRates: SellRateEntry[];
};

export function createEconomySystem() {
  function getSellRate(toyTypeId: string, mods: Modifiers): number {
    const def = getToyType(toyTypeId);
    return (def?.baseSellValue ?? 1) * mods.sellRateMult;
  }

  function getSellRates(mods: Modifiers): SellRateEntry[] {
    return toyTypes.map((t) => ({
      toyType: t.id,
      name: t.name,
      icon: t.icon,
      rate: t.baseSellValue * mods.sellRateMult,
    }));
  }

  function getFinishedStock(state: GameState, toyTypeId: string): number {
    return Math.max(0, Math.floor(ensureInventory(state, toyTypeId).finished));
  }

  function sellItems(state: GameState, mods: Modifiers, toyTypeId: string, amount: number): number {
    const inv = ensureInventory(state, toyTypeId);
    const sellable = Math.max(0, Math.min(amount, Math.floor(inv.finished)));
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
    state.meta.statusText = `Sold ${sellable} ${label}${sellable > 1 ? "s" : ""} for $${earned.toFixed(2)}.`;
    return earned;
  }

  function getView(_state: GameState, mods: Modifiers): EconomyView {
    return { sellRates: getSellRates(mods) };
  }

  return { sellItems, getView, getSellRate, getSellRates, getFinishedStock };
}