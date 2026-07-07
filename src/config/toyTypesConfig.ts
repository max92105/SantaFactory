/**
 * Toy catalog — every toy type the factory can produce.
 *
 * To add a new toy:
 *   1. Add an entry here (id, name, icon, baseSellValue).
 *   2. Add a crafting step for it in pipelineConfig.ts (inputStage: null).
 * Everything else (inventory, selectors, selling, HUD) picks it up automatically.
 */

export type ToyTypeDef = {
  id: string;
  name: string;
  icon: string;
  /** Money earned per finished unit sold, before sell-rate upgrades. */
  baseSellValue: number;
};

export const toyTypes: ToyTypeDef[] = [
  { id: "plushy", name: "Plushy", icon: "🧸", baseSellValue: 3.0 },
  { id: "rubik", name: "Rubik's Cube", icon: "🟩", baseSellValue: 8.0 },
];

export function getToyType(id: string): ToyTypeDef | undefined {
  return toyTypes.find((t) => t.id === id);
}
