/**
 * Upgrades tuning — used by ShopSystem (buying) and ModifierSystem (effects).
 *
 * To add a new upgrade:
 *   1. Add an entry to `upgrades` below.
 *   2. If it needs a new effect type, extend `UpgradeEffect`, then follow the
 *      compiler errors: ModifierSystem's switch and `describeUpgradeEffect`
 *      are both exhaustive and will flag the missing cases.
 */

import type { UnlockRule } from "./unlockRules";

export type UpgradeEffect =
  | { type: "gpc_flat"; amount: number } // +N gifts per click
  | { type: "gpc_mult"; amount: number } // gifts per click xN
  | { type: "gps_mult"; amount: number } // global production xN (reserved)
  | { type: "producer_output_mult"; amount: number } // pipeline output xN
  | { type: "producer_speed_mult"; amount: number } // pipeline speed xN
  | { type: "sell_rate_mult"; amount: number } // sell price xN
  | { type: "unlock" }; // pure gate — owning it enables a feature (no modifier)

export type UpgradeDef = {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: UpgradeEffect;
  unlock: UnlockRule;
};

// NOTE: progression-buff upgrades (click power, sell rate, elf speed…) were
// removed for now to test the base progression. The hooks (effect types +
// ModifierSystem) are kept so they can be reintroduced and tuned later.
export const upgrades: UpgradeDef[] = [
  {
    id: "hire_mechanics",
    name: "Maintenance Contract",
    description: "Unlocks hiring the Maintenance Crew — mechanics that auto-repair broken stations.",
    cost: 600,
    effect: { type: "unlock" },
    unlock: { type: "always" },
  },
  {
    id: "hire_menders",
    name: "Repair Workshop",
    description: "Unlocks hiring the Repair Crew — menders that refurbish broken toys.",
    cost: 400,
    effect: { type: "unlock" },
    unlock: { type: "always" },
  },
  {
    id: "bike_handbuild",
    name: "Bicycle Hand-Building",
    description: "Learn to hand-build bikes so you can craft them with the click button.",
    cost: 3000,
    effect: { type: "unlock" },
    unlock: { type: "toy_unlocked", toyId: "bike" },
  },
];

export function getUpgrade(id: string): UpgradeDef | undefined {
  return upgrades.find((u) => u.id === id);
}

/** Short human-readable summary of an effect, shown in the shop. */
export function describeUpgradeEffect(effect: UpgradeEffect): string {
  switch (effect.type) {
    case "gpc_flat":
      return `+${effect.amount} GPC`;
    case "gpc_mult":
      return `x${effect.amount} GPC`;
    case "sell_rate_mult":
      return `x${effect.amount} Sell Rate`;
    case "producer_output_mult":
      return `x${effect.amount} Producer Output`;
    case "producer_speed_mult":
      return `x${effect.amount} Producer Speed`;
    case "gps_mult":
      return `x${effect.amount} Global GPS`;
    case "unlock":
      return "Unlocks a feature";
  }
}
