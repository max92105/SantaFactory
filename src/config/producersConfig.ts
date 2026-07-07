/**
 * Hiring packages tuning — used by ShopSystem (buying) and WageSystem (payroll).
 *
 * A "producer" is a hire package: it adds elves to the unassigned pool.
 * Cost formula: baseCost * costGrowth^owned (see helpers/costHelpers.ts).
 */

import type { UnlockRule } from "./unlockRules";

export type ProducerDef = {
  id: string;
  name: string;
  description: string;

  /** Price of the first purchase. */
  baseCost: number;
  /** Exponential price growth per unit already owned. */
  costGrowth: number;

  /** How many elves this hire package provides. */
  elvesProvided: number;

  /** Daily wage per elf from this package. */
  dailyWagePerElf: number;

  unlock: UnlockRule;
};

export const producers: ProducerDef[] = [
  {
    id: "elf_worker",
    name: "Elf Worker",
    description: "Hire a single hardworking elf. Assign them to a pipeline step.",
    baseCost: 10,
    costGrowth: 1.15,
    elvesProvided: 1,
    dailyWagePerElf: 2,
    unlock: { type: "always" },
  },
  {
    id: "elf_team",
    name: "Elf Team",
    description: "Hire a coordinated team of 5 elves. Higher efficiency, bigger wage bill.",
    baseCost: 200,
    costGrowth: 1.17,
    elvesProvided: 5,
    dailyWagePerElf: 3,
    unlock: { type: "producer_owned", producerId: "elf_worker", count: 10 },
  },
];

export function getProducer(id: string): ProducerDef | undefined {
  return producers.find((p) => p.id === id);
}
