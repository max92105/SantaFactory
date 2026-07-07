/**
 * Hiring packages tuning — used by ShopSystem (buying) and the shop UI.
 *
 * A "producer" is a hire package: it adds elves to the unassigned pool.
 * Cost formula: baseCost * costGrowth^(currentElves / elvesProvided) — the
 * price follows the workforce you actually HAVE, so losing elves makes
 * hiring cheaper again (see helpers/costHelpers.ts).
 * Wages are per elf, uniform across packages: config/wagesConfig.ts.
 */

import type { UnlockRule } from "./unlockRules";

export type ProducerDef = {
  id: string;
  name: string;
  description: string;

  /** Price when you have zero elves. */
  baseCost: number;
  /** Exponential price growth per package-equivalent of elves employed. */
  costGrowth: number;

  /** How many elves this hire package provides. */
  elvesProvided: number;

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
    unlock: { type: "always" },
  },
  {
    id: "elf_team",
    name: "Elf Team",
    description: "Hire a coordinated team of 5 elves in one go.",
    baseCost: 200,
    costGrowth: 1.17,
    elvesProvided: 5,
    unlock: { type: "producer_owned", producerId: "elf_worker", count: 10 },
  },
];

export function getProducer(id: string): ProducerDef | undefined {
  return producers.find((p) => p.id === id);
}
