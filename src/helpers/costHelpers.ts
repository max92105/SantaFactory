/** Shared price formulas — keep every cost calculation here, never inline. */

import type { ProducerDef } from "../config/producersConfig";
import type { GameState } from "../state/GameState";

/**
 * Price of the NEXT unit of a hire package, based on the CURRENT workforce
 * (not purchase history). Losing elves — e.g. after missing payroll — makes
 * hiring cheaper again. The workforce is measured in package-equivalents:
 * baseCost * costGrowth^(currentElves / elvesProvided).
 */
export function getProducerCost(def: ProducerDef, currentElves: number): number {
  const packageEquivalents = Math.max(0, currentElves) / def.elvesProvided;
  return def.baseCost * Math.pow(def.costGrowth, packageEquivalents);
}

/** Convenience: producer cost for the state's current elf count. */
export function getProducerCostForState(def: ProducerDef, state: GameState): number {
  return getProducerCost(def, state.workforce.totalElves);
}
