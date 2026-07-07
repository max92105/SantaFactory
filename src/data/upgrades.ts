export type UnlockRule =
  | { type: "always" }
  | { type: "producer_owned"; producerId: string; count: number };

export type UpgradeEffect =
  | { type: "gpc_flat"; amount: number }
  | { type: "gpc_mult"; amount: number }
  | { type: "gps_mult"; amount: number }
  | { type: "producer_output_mult"; amount: number }
  | { type: "producer_speed_mult"; amount: number }
  | { type: "sell_rate_mult"; amount: number };

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
    unlock: { type: "producer_owned", producerId: "elf_worker", count: 3 },
  },
  {
    id: "better_deals",
    name: "Better Deals",
    description: "Sell rate x1.25.",
    cost: 120,
    effect: { type: "sell_rate_mult", amount: 1.25 },
    unlock: { type: "producer_owned", producerId: "elf_worker", count: 5 },
  },
  {
    id: "training_manuals",
    name: "Training Manuals",
    description: "All producers output x1.2.",
    cost: 150,
    effect: { type: "producer_output_mult", amount: 1.2 },
    unlock: { type: "producer_owned", producerId: "elf_worker", count: 8 },
  },
  {
    id: "overclock_bells",
    name: "Overclock Bells",
    description: "All producers work faster (speed x1.15).",
    cost: 220,
    effect: { type: "producer_speed_mult", amount: 1.15 },
    unlock: { type: "producer_owned", producerId: "elf_worker", count: 10 },
  },
  {
    id: "contract_board",
    name: "Contract Board",
    description: "Sell rate x1.15 (stacks with Better Deals).",
    cost: 400,
    effect: { type: "sell_rate_mult", amount: 1.15 },
    unlock: { type: "producer_owned", producerId: "elf_team", count: 1 },
  },
];