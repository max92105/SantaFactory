/**
 * ProductionSystem — hand-crafting via the big click button.
 * Automatic production is handled by PipelineSystem.
 * Tuning: config/productionConfig.ts
 */

import type { GameState } from "../state/GameState";
import { addToStage } from "../helpers/inventoryHelpers";
import { freeSpace } from "../helpers/storageHelpers";
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

  /**
   * Click produces finished items of the selected toy type. `mult` folds in the
   * click combo (and, for a golden burst, the golden multiplier) — the caller
   * computes it so the base gifts-per-click stays a clean, displayable number.
   *
   * A hand-made gift needs a shelf like any other, so the warehouse caps it: a
   * click that only partly fits delivers what fits, and one that doesn't fit at
   * all makes nothing. Returns how many were actually made.
   */
  function makeClick(state: GameState, mods: Modifiers, mult = 1): number {
    const toyType = state.selectedClickToyType || "plushy";
    if (!isToyClickable(state, toyType)) {
      state.meta.statusText = t("click.status.locked", { name: toyName(toyType) });
      return 0;
    }
    const room = freeSpace(state, mods);
    if (room <= 0) {
      state.meta.statusText = t("click.status.storageFull");
      return 0;
    }
    const amount = Math.min(room, Math.max(1, Math.floor(getGiftsPerClick(state, mods) * mult)));
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
