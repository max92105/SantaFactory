import type { GameState } from "../state/GameState";
import { addToStage } from "../state/GameState";
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
    const amount = getGiftsPerClick(state, mods);
    const toyType = state.selectedClickToyType || "plushy";
    // addToStage with "finished" auto-increments lifetimeGifts + dayStats.giftsMade
    addToStage(state, toyType, "finished", amount);
    state.meta.statusText = `Made ${amount} gift${amount === 1 ? "" : "s"} by hand.`;
    return amount;
  }

  function update(_state: GameState, _mods: Modifiers, _dtSeconds: number) {
    // Automatic production handled by PipelineSystem
  }

  function getView(state: GameState, mods: Modifiers): ProductionView {
    return { giftsPerClick: getGiftsPerClick(state, mods) };
  }

  return { makeClick, update, getView, getGiftsPerClick };
}
