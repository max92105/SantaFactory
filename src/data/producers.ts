export type UnlockRule =
  | { type: "always" }
  | { type: "producer_owned"; producerId: string; count: number };

export type ProducerDef = {
  id: string;
  name: string;
  description: string;

  // Economy
  baseCost: number;
  costGrowth: number;

  // Workforce - how many elves this hire package provides
  elvesProvided: number;

  // Wages - daily wage per elf from this package
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