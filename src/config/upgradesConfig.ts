/**
 * Upgrades tuning — used by ShopSystem (buying) and ModifierSystem (effects).
 *
 * Most upgrades are hand-authored below. Two families are GENERATED so the toy
 * catalog + categories stay the single source of truth:
 *   - category unlocks   — one per non-basic category (unlocks its toys,
 *                          specialist elves and station together).
 *   - hand-build upgrades — one per non-basic toy (gates hand-clicking it).
 * Their display names/descriptions are templated in i18n (see localize.ts), so
 * adding a toy/category needs zero new upgrade strings.
 *
 * To add a plain upgrade:
 *   1. Add an entry to `handAuthored` below.
 *   2. If it needs a new effect type, extend `UpgradeEffect`, then follow the
 *      compiler errors: ModifierSystem's switch and `describeUpgradeEffect`
 *      are both exhaustive and will flag the missing cases.
 */

import type { UnlockRule } from "./unlockRules";
import { toyTypes, toyCategoryId } from "./toyTypesConfig";
import { toyCategories } from "./toyCategoriesConfig";

export type UpgradeEffect =
  | { type: "gpc_flat"; amount: number } // +N gifts per click
  | { type: "gpc_mult"; amount: number } // gifts per click xN
  | { type: "gps_mult"; amount: number } // global production xN (reserved)
  | { type: "producer_output_mult"; amount: number } // pipeline output xN
  | { type: "producer_speed_mult"; amount: number } // pipeline speed xN
  | { type: "sell_rate_mult"; amount: number } // sell price xN
  | { type: "click_button_scale"; amount: number } // click button size xN
  | { type: "unlock" }; // pure gate — owning it enables a feature (no modifier)

export type UpgradeDef = {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: UpgradeEffect;
  unlock: UnlockRule;
};

/** Hand-build upgrade price = toy sell value × this (tunable). */
export const HANDBUILD_COST_MULT = 20;

// ── Hand-authored upgrades ──────────────────────────────────────────────────
const handAuthored: UpgradeDef[] = [
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

  // ── Click upgrades (later tiers reveal once the previous is owned) ──
  {
    id: "click_power_1",
    name: "Bigger Hammer",
    description: "Each click makes +1 gift.",
    cost: 40,
    effect: { type: "gpc_flat", amount: 1 },
    unlock: { type: "always" },
  },
  {
    id: "click_power_2",
    name: "Power Gloves",
    description: "Doubles gifts per click.",
    cost: 600,
    effect: { type: "gpc_mult", amount: 2 },
    unlock: { type: "upgrade_owned", upgradeId: "click_power_1" },
  },
  {
    id: "click_power_3",
    name: "Sugar Rush",
    description: "Triples gifts per click.",
    cost: 20000,
    effect: { type: "gpc_mult", amount: 3 },
    unlock: { type: "upgrade_owned", upgradeId: "click_power_2" },
  },
  {
    id: "click_bigger_1",
    name: "Bigger Button",
    description: "Grows the click button by 40% — an easier target.",
    cost: 150,
    effect: { type: "click_button_scale", amount: 1.4 },
    unlock: { type: "always" },
  },
  {
    id: "click_bigger_2",
    name: "Huge Button",
    description: "Grows the click button by another 40%.",
    cost: 4000,
    effect: { type: "click_button_scale", amount: 1.4 },
    unlock: { type: "upgrade_owned", upgradeId: "click_bigger_1" },
  },
  {
    id: "click_second_button",
    name: "Second Hand",
    description: "Adds a second permanent click button. Overlap them to trigger both at once!",
    cost: 2500,
    effect: { type: "unlock" },
    unlock: { type: "always" },
  },
  {
    id: "click_combo",
    name: "Combo Training",
    description: "Rapid clicks build a combo that multiplies gifts — keep the streak alive!",
    cost: 9000,
    effect: { type: "unlock" },
    unlock: { type: "always" },
  },
  {
    id: "click_golden",
    name: "Golden Gifts",
    description: "A golden button appears now and then — click it fast for a huge burst!",
    cost: 40000,
    effect: { type: "unlock" },
    unlock: { type: "always" },
  },
];

// ── Generated: one unlock per non-basic category ────────────────────────────
const categoryUnlocks: UpgradeDef[] = toyCategories
  .filter((c) => c.unlockUpgrade)
  .map((c) => ({
    id: c.unlockUpgrade!,
    name: `Unlock ${c.name}`,
    description: `Unlock the ${c.name} category: buy its toys, hire its specialist elves, and open its station.`,
    cost: c.unlockCost ?? 0,
    effect: { type: "unlock" as const },
    unlock: { type: "always" as const },
  }));

// ── Generated: one hand-build gate per non-basic toy (visible once unlocked) ─
const handbuilds: UpgradeDef[] = toyTypes
  .filter((t) => toyCategoryId(t) !== "basic")
  .map((t) => ({
    id: `handbuild_${t.id}`,
    name: `Hand-build ${t.name}`,
    description: `Learn to hand-build ${t.name} so you can craft it with the click button.`,
    cost: Math.max(1, Math.round(t.baseSellValue * HANDBUILD_COST_MULT)),
    effect: { type: "unlock" as const },
    unlock: { type: "toy_unlocked" as const, toyId: t.id },
  }));

export const upgrades: UpgradeDef[] = [...categoryUnlocks, ...handAuthored, ...handbuilds];

export function getUpgrade(id: string): UpgradeDef | undefined {
  return upgrades.find((u) => u.id === id);
}

/** Set of the generated category-unlock upgrade ids (for shop/localize logic). */
export const CATEGORY_UNLOCK_IDS = new Set(categoryUnlocks.map((u) => u.id));

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
    case "click_button_scale":
      return `x${effect.amount} Button Size`;
    case "unlock":
      return "Unlocks a feature";
  }
}
