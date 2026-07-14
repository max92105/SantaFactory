/**
 * Shared unlock-rule format used by producers and upgrades, plus the single
 * place that evaluates them (so shop visibility logic lives here).
 */
import type { GameState } from "../state/GameState";

export type UnlockRule =
  | { type: "always" }
  | { type: "producer_owned"; producerId: string; count: number }
  | { type: "toy_unlocked"; toyId: string };

/** Whether an unlock rule is currently satisfied (controls shop visibility). */
export function isUnlockRuleMet(state: GameState, rule: UnlockRule): boolean {
  switch (rule.type) {
    case "always":
      return true;
    case "toy_unlocked":
      return !!state.owned.toys[rule.toyId];
    case "producer_owned":
      return true; // not used yet — don't hide
    default:
      return true;
  }
}
