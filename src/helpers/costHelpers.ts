/** Shared price formulas — keep every cost calculation here, never inline. */

import type { ElfTypeDef } from "../config/elfTypesConfig";

/**
 * Price of the NEXT elf of a type, based on how many of that type you already
 * have (pool + assigned): baseCost * costGrowth^currentCount. Losing elves of a
 * type — e.g. after missing payroll — makes rehiring that type cheaper again.
 */
export function getElfCost(def: ElfTypeDef, currentCountOfType: number): number {
  return def.baseCost * Math.pow(def.costGrowth, Math.max(0, currentCountOfType));
}
