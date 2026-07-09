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
  | { type: "sell_rate_mult"; amount: number }; // sell price xN

export type UpgradeDef = {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: UpgradeEffect;
  unlock: UnlockRule;
};

export const upgrades: UpgradeDef[] = [
  {
    id: "bigger_hammer",
    name: "Bigger Hammer",
    description: "+1 gift per click.",
    cost: 25,
    effect: { type: "gpc_flat", amount: 1 },
    unlock: { type: "always" },
  },
  {
    id: "double_gloves",
    name: "Double Gloves",
    description: "Clicking power x1.5.",
    cost: 80,
    effect: { type: "gpc_mult", amount: 1.5 },
    unlock: { type: "always" },
  },
  {
    id: "better_deals",
    name: "Better Deals",
    description: "Sell rate x1.25.",
    cost: 120,
    effect: { type: "sell_rate_mult", amount: 1.25 },
    unlock: { type: "always" },
  },
  {
    id: "training_manuals",
    name: "Training Manuals",
    description: "All elves output x1.2.",
    cost: 150,
    effect: { type: "producer_output_mult", amount: 1.2 },
    unlock: { type: "always" },
  },
  {
    id: "overclock_bells",
    name: "Overclock Bells",
    description: "All elves work faster (speed x1.15).",
    cost: 220,
    effect: { type: "producer_speed_mult", amount: 1.15 },
    unlock: { type: "always" },
  },
  {
    id: "contract_board",
    name: "Contract Board",
    description: "Sell rate x1.15 (stacks with Better Deals).",
    cost: 400,
    effect: { type: "sell_rate_mult", amount: 1.15 },
    unlock: { type: "always" },
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
  }
}
