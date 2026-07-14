/**
 * Toy catalog — every toy type the factory can produce.
 *
 * To add a new toy:
 *   1. Add an entry here (id, name, icon, baseSellValue, unlockCost).
 *   2. Add a crafting step for it in pipelineConfig.ts (inputStage: null).
 * Everything else (inventory, selectors, selling, HUD, the New Toys shop
 * section) picks it up automatically.
 *
 * unlockCost: 0 = available from the start; > 0 = must be bought in the
 * "New Toys" section of the Upgrades tab.
 */

export type ToyTypeDef = {
  id: string;
  name: string;
  icon: string;
  /** Money earned per finished unit sold, before sell-rate upgrades. */
  baseSellValue: number;
  /** One-time cost to unlock this toy line (0 = starts unlocked). */
  unlockCost: number;
  /**
   * If set, this toy can't be hand-clicked until the given upgrade is owned —
   * it must be built on its production line. (See helpers/unlockHelpers.)
   */
  clickUnlockUpgrade?: string;
};

// Progression curve — each toy is worth ~2.3× the previous and unlocks for
// roughly 4–5× more, while taking longer to craft (see pipelineConfig baseTime).
// Higher toys pay more per craft-second, so unlocking them is an upgrade.
export const toyTypes: ToyTypeDef[] = [
  { id: "plushy", name: "Plushy", icon: "🧸", baseSellValue: 3.0, unlockCost: 0 },
  { id: "rubik", name: "Rubik's Cube", icon: "🟩", baseSellValue: 8.0, unlockCost: 150 },
  { id: "train", name: "Wooden Train", icon: "🚂", baseSellValue: 18.0, unlockCost: 750 },
  { id: "robot", name: "Tin Robot", icon: "🤖", baseSellValue: 42.0, unlockCost: 4000 },
  // The bike has a longer line (two steps before Quality Control) and can't be
  // hand-clicked until you buy its hand-build upgrade.
  {
    id: "bike",
    name: "Bicycle",
    icon: "🚲",
    baseSellValue: 100.0,
    unlockCost: 12000,
    clickUnlockUpgrade: "bike_handbuild",
  },
];

export function getToyType(id: string): ToyTypeDef | undefined {
  return toyTypes.find((t) => t.id === id);
}
