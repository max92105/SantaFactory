/** Shared price formulas — keep every cost calculation here, never inline. */

import type { ProducerDef } from "../config/producersConfig";

/** Price of the NEXT unit of a hire package: baseCost * costGrowth^owned. */
export function getProducerCost(def: ProducerDef, ownedCount: number): number {
  return def.baseCost * Math.pow(def.costGrowth, ownedCount);
}
