/**
 * ProductionSystem — hand-crafting via the big click button.
 * Automatic production is handled by PipelineSystem.
 * Tuning: config/productionConfig.ts
 */

import type { GameState } from "../state/GameState";
import { addToStage } from "../helpers/inventoryHelpers";
import { isToyClickable } from "../helpers/unlockHelpers";
import { t } from "../ui/i18n/i18n";
import { toyName } from "../ui/i18n/localize";
import type { Modifiers } from "./ModifierSystem";

export type ProductionView = {
  giftsPerClick: number;
};

export function createProductionSystem() {
  function getGiftsPerClick(state: GameState, mods: Modifiers): number {
    const raw = (state.derived.baseGpc + mods.gpcFlat) * mods.gpcMult;
    return Math.max(1, Math.floor(raw));
  }

  /** Click produces finished items of the selected toy type (bootstrap mechanism). */
  function makeClick(state: GameState, mods: Modifiers): number {
    const toyType = state.selectedClickToyType || "plushy";
    if (!isToyClickable(state, toyType)) {
      state.meta.statusText = t("click.status.locked", { name: toyName(toyType) });
      return 0;
    }
    const amount = getGiftsPerClick(state, mods);
    // addToStage with "finished" auto-increments lifetimeGifts + dayStats.giftsMade
    addToStage(state, toyType, "finished", amount);
    state.meta.statusText = t("click.status.made", { n: amount });
    return amount;
  }

  function getView(state: GameState, mods: Modifiers): ProductionView {
    return { giftsPerClick: getGiftsPerClick(state, mods) };
  }

  return { makeClick, getView, getGiftsPerClick };
}

export type ProductionSystem = ReturnType<typeof createProductionSystem>;
