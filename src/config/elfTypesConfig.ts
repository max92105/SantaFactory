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
  /** If set, this crew can't be hired until the given upgrade is owned. */
  unlockUpgrade?: string;
};

export const elfCategories: ElfCategoryDef[] = [
  {
    id: "basic",
    name: "Basic Workers",
    description: "Cheap, general-purpose elves — the backbone of the workshop.",
  },
  {
    id: "special",
    name: "Specialist Elves",
    description: "Quirky hires with their own work rules — read the fine print.",
  },
  {
    id: "maintenance",
    name: "Maintenance Crew",
    description: "Mechanics that automatically repair broken stations while on shift.",
    unlockUpgrade: "hire_mechanics",
  },
  {
    id: "mending",
    name: "Repair Crew",
    description: "Menders that refurbish ruined toys back into finished gifts while on shift.",
    unlockUpgrade: "hire_menders",
  },
];

/**
 * "worker" elves staff production lines (craft/quality-control/packaging).
 * "mechanic" elves staff the Maintenance line and auto-repair breakdowns.
 * "mender" elves staff the Repair Bench and turn broken toys back into finished.
 * Neither mechanics nor menders touch production.
 */
export type ElfRole = "worker" | "mechanic" | "mender";

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
  /** Seconds one mender takes to refurbish one broken toy into finished. (menders) */
  refurbishTime?: number;

  /** How many of the day's 4 shift slots one elf of this type can cover. */
  maxShifts: number;
  /**
   * Shift slots this elf REFUSES to work (ids from shiftsConfig, e.g.
   * ["night"] or ["afternoon", "evening"]). Omitted/empty = works any slot.
   * Lets you make elves tied to specific shifts.
   */
  blockedSlots?: string[];

  // ── Specialist quirks (see workforceHelpers.slotRestriction + PipelineSystem) ──
  /**
   * MANAGER: doesn't build toys itself — everyone else on its station+shift
   * works this much faster (×1.25). Only ONE manager per station per shift.
   */
  managerMult?: number;
  /** SHY: will only share a station+shift with other shy elves. */
  shy?: boolean;
  /** Chance (0..1) each morning that this elf takes the whole day off. */
  dayOffChance?: number;
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
    blockedSlots: ["night"], // too busy getting drunk
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
    role: "worker",
  },

  // ─── Specialist Elves — quirky hires with unique work rules ──────────────
  {
    id: "shy",
    name: "Shy Elf",
    icon: "🙈",
    description: "A fine worker — but only alongside other Shy Elves. Strangers freeze them up.",
    category: "special",
    role: "worker",
    baseCost: 20,
    costGrowth: 1.13,
    dailyWage: 1.5,
    mistakeChance: 0.12,
    breakChance: 0.002,
    maxShifts: 2,
    shy: true,
  },
  {
    id: "antisocial",
    name: "Antisocial Elf",
    icon: "🌙",
    description: "Refuses daylight — only takes the evening and night shifts.",
    category: "special",
    role: "worker",
    baseCost: 40,
    costGrowth: 1.14,
    dailyWage: 2.5,
    mistakeChance: 0.07,
    breakChance: 0.0012,
    maxShifts: 2,
    blockedSlots: ["morning", "afternoon"],
  },
  {
    id: "retired",
    name: "Almost-Retired Elf",
    icon: "👴",
    description: "Decades of craftsmanship, one shift of energy per day.",
    category: "special",
    role: "worker",
    baseCost: 60,
    costGrowth: 1.14,
    dailyWage: 2,
    mistakeChance: 0.03,
    breakChance: 0.0005,
    maxShifts: 1,
  },
  {
    id: "workaholic",
    name: "Workaholic Elf",
    icon: "☕",
    description: "Works all four shifts — except the days they burn out and don't show up at all.",
    category: "special",
    role: "worker",
    baseCost: 150,
    costGrowth: 1.16,
    dailyWage: 7,
    mistakeChance: 0.1,
    breakChance: 0.002,
    maxShifts: 4,
    dayOffChance: 0.25,
  },
  {
    id: "perfectionist",
    name: "Perfectionist Elf",
    icon: "🧐",
    description: "Measured, meticulous — has never ruined a toy in their life.",
    category: "special",
    role: "worker",
    baseCost: 400,
    costGrowth: 1.18,
    dailyWage: 12,
    mistakeChance: 0,
    breakChance: 0.0002,
    maxShifts: 2,
  },
  {
    id: "manager",
    name: "Manager Elf",
    icon: "👔",
    description: "Builds nothing — but the whole crew on their shift works 25% faster. One per station per shift.",
    category: "special",
    role: "worker",
    baseCost: 1200,
    costGrowth: 1.2,
    dailyWage: 15,
    mistakeChance: 0,
    breakChance: 0,
    maxShifts: 2,
    managerMult: 1.25,
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
  },

  // ─── Repair Crew — menders that turn broken toys back into finished ───────
  // They don't produce new toys; they refurbish ruined ones. refurbishTime =
  // seconds to mend one broken toy. Slower is cheaper; faster costs more.
  {
    id: "tinker",
    name: "Tinker Elf",
    icon: "🔩",
    description: "Patient and cheap — slowly mends ruined toys back to sellable shape.",
    category: "mending",
    role: "mender",
    baseCost: 130,
    costGrowth: 1.15,
    dailyWage: 3,
    mistakeChance: 0,
    breakChance: 0,
    refurbishTime: 8,
    maxShifts: 2,
  },
  {
    id: "mender",
    name: "Mender Elf",
    icon: "🧵",
    description: "A deft hand — refurbishes broken toys at a brisk clip.",
    category: "mending",
    role: "mender",
    baseCost: 420,
    costGrowth: 1.16,
    dailyWage: 6,
    mistakeChance: 0,
    breakChance: 0,
    refurbishTime: 4,
    maxShifts: 2,
  },
];

export function getElfType(id: string): ElfTypeDef | undefined {
  return elfTypes.find((e) => e.id === id);
}
