/**
 * Elf types — the workforce you hire and assign to pipeline steps.
 *
 * Replaces the old generic "producer" packages. Each elf type is one elf with
 * its own price, daily wage and — the key new stat — a mistakeChance: the odds
 * that any single item it works on is ruined (see systems/PipelineSystem.ts).
 *
 * Cheap elves fail a lot; expensive veterans almost never do. That trade-off
 * is the whole point: pay less up front and waste materials, or pay more for
 * reliable output.
 *
 * Cost scales per type: baseCost * costGrowth^(current count of that type),
 * so losing a type's elves makes rehiring them cheaper again.
 */

/** Elves are grouped into categories in the Hiring UI. */
export type ElfCategoryDef = {
  id: string;
  name: string;
  description: string;
};

export const elfCategories: ElfCategoryDef[] = [
  {
    id: "basic",
    name: "Basic Workers",
    description: "Cheap, general-purpose elves — the backbone of the workshop.",
  },
  {
    id: "maintenance",
    name: "Maintenance Crew",
    description: "Mechanics that automatically repair broken stations while on shift.",
  },
];

/**
 * "worker" elves staff production lines (craft/assembly/packaging).
 * "mechanic" elves staff the Maintenance line and auto-repair breakdowns —
 * they never touch production.
 */
export type ElfRole = "worker" | "mechanic";

export type ElfTypeDef = {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Which hiring category this elf belongs to (see elfCategories). */
  category: string;
  /** What this elf does: staff a line, or repair broken stations. */
  role: ElfRole;

  /** Price of the first elf of this type (before per-type growth). */
  baseCost: number;
  /** Exponential price growth per elf of this type already owned. */
  costGrowth: number;

  /** Daily wage per elf of this type (end-of-day payroll). */
  dailyWage: number;

  /** Chance (0..1) that a single item this elf works on is ruined. (workers) */
  mistakeChance: number;
  /** Chance (0..1) that a single item breaks the station. (workers) */
  breakChance: number;
  /** Seconds one mechanic takes to auto-repair one broken station. (mechanics) */
  repairTime?: number;

  /** How many of the day's 4 shift slots one elf of this type can cover. */
  maxShifts: number;
  /** Whether this elf will take the night slot (drunken elves won't). */
  canWorkNight: boolean;
};

export const elfTypes: ElfTypeDef[] = [
  {
    id: "drunken",
    name: "Drunken Elf",
    icon: "🍺",
    description: "Dirt cheap and always merry — but ruins a huge share of what they touch.",
    category: "basic",
    baseCost: 8,
    costGrowth: 1.12,
    dailyWage: 1,
    mistakeChance: 0.4,
    breakChance: 0.006,
    maxShifts: 2,
    canWorkNight: false,
    role: "worker",
  },
  {
    id: "clumsy",
    name: "Clumsy Elf",
    icon: "🤪",
    description: "Cheap and eager, but butterfingered — expect plenty of botched toys.",
    category: "basic",
    baseCost: 14,
    costGrowth: 1.13,
    dailyWage: 1.5,
    mistakeChance: 0.25,
    breakChance: 0.004,
    maxShifts: 2,
    canWorkNight: true,
    role: "worker",
  },
  {
    id: "coked",
    name: "Coked Elf",
    icon: "❄️",
    description: "Wired, tireless and a little twitchy on the tools.",
    category: "basic",
    baseCost: 45,
    costGrowth: 1.16,
    dailyWage: 4,
    mistakeChance: 0.12,
    breakChance: 0.003,
    maxShifts: 3,
    canWorkNight: true,
    role: "worker",
  },
  {
    id: "worker",
    name: "Worker Elf",
    icon: "🧝",
    description: "The dependable average worker. Occasional slip-ups, fair wages.",
    category: "basic",
    baseCost: 30,
    costGrowth: 1.15,
    dailyWage: 3,
    mistakeChance: 0.08,
    breakChance: 0.0015,
    maxShifts: 2,
    canWorkNight: true,
    role: "worker",
  },
  {
    id: "veteran",
    name: "Veteran Elf",
    icon: "🎖️",
    description: "Master craftself. Pricey and well-paid, but almost never fails.",
    category: "basic",
    baseCost: 150,
    costGrowth: 1.18,
    dailyWage: 9,
    mistakeChance: 0.015,
    breakChance: 0.0003,
    maxShifts: 2,
    canWorkNight: true,
    role: "worker",
  },

  // ─── Maintenance Crew — mechanics that auto-repair broken stations ───────
  // They don't produce (mistake/break = 0). repairTime = seconds to fix one
  // station. Slower is cheaper; faster costs more.
  {
    id: "apprentice_mech",
    name: "Apprentice Mechanic",
    icon: "🔧",
    description: "Slow but cheap — patches a broken station back up eventually.",
    category: "maintenance",
    role: "mechanic",
    baseCost: 500,
    costGrowth: 1.15,
    dailyWage: 3,
    mistakeChance: 0,
    breakChance: 0,
    repairTime: 20,
    maxShifts: 2,
    canWorkNight: true,
  },
  {
    id: "mechanic",
    name: "Mechanic",
    icon: "🔨",
    description: "A steady hand — fixes breakdowns at a good clip.",
    category: "maintenance",
    role: "mechanic",
    baseCost: 1500,
    costGrowth: 1.16,
    dailyWage: 5,
    mistakeChance: 0,
    breakChance: 0,
    repairTime: 10,
    maxShifts: 2,
    canWorkNight: true,
  },
  {
    id: "master_mech",
    name: "Master Mechanic",
    icon: "🛠️",
    description: "Lightning fast — a broken station is back online in seconds.",
    category: "maintenance",
    role: "mechanic",
    baseCost: 5000,
    costGrowth: 1.17,
    dailyWage: 9,
    mistakeChance: 0,
    breakChance: 0,
    repairTime: 5,
    maxShifts: 2,
    canWorkNight: true,
  },
];

export function getElfType(id: string): ElfTypeDef | undefined {
  return elfTypes.find((e) => e.id === id);
}
