/**
 * Toy catalog — every toy type the factory can produce.
 *
 * To add a new toy:
 *   1. Add an entry here (id, name, icon, baseSellValue, unlockCost, category).
 *   2. Its craft step + full production route are GENERATED from its category
 *      (see config/toyCategoriesConfig.ts + config/pipelineConfig.ts).
 * Everything else (inventory, selectors, selling, HUD, the New Toys shop
 * section, unlock/click gating) picks it up automatically.
 *
 * unlockCost: 0 = available from the start; > 0 = must be bought in the
 * "New Toys" section — and, for a non-"basic" category, only AFTER that
 * category's unlock upgrade is owned (see helpers/unlockHelpers).
 *
 * category: omit for "basic" (one craft step, hand-clickable once unlocked).
 * A non-basic category adds specialist steps to the route and requires a
 * per-toy hand-build upgrade before the toy can be hand-clicked.
 */

export type ToyTypeDef = {
  id: string;
  name: string;
  icon: string;
  /** Money earned per finished unit sold, before sell-rate upgrades. */
  baseSellValue: number;
  /** One-time cost to unlock this toy line (0 = starts unlocked). */
  unlockCost: number;
  /** Category id (config/toyCategoriesConfig.ts). Omit = "basic". */
  category?: string;
};

// Progression curve — a smooth geometric ramp: sell value ≈ 3 × 1.29^i, unlock
// cost ≈ value × 22 × 1.03^i, craft time ≈ 2 × 1.05^i seconds. Thematic toys are
// grouped into specialist categories (music/sports/animals/electronics/jewellery);
// the rest are "basic". Category-tagged toys gate behind their category unlock.
export const toyTypes: ToyTypeDef[] = [
  { id: "plushy", name: "Plushy", icon: "🧸", baseSellValue: 3.0, unlockCost: 0 },
  { id: "rubik", name: "Rubik's Cube", icon: "🟩", baseSellValue: 4.0, unlockCost: 91 },
  { id: "yoyo", name: "Yo-Yo", icon: "🪀", baseSellValue: 5.0, unlockCost: 115 },
  { id: "kite", name: "Kite", icon: "🪁", baseSellValue: 6.5, unlockCost: 155 },
  { id: "bouncy_ball", name: "Bouncy Ball", icon: "🏀", baseSellValue: 8.5, unlockCost: 210 },
  { id: "balloon", name: "Balloon", icon: "🎈", baseSellValue: 11.0, unlockCost: 280 },
  { id: "rubber_duck", name: "Rubber Duck", icon: "🦆", baseSellValue: 14.0, unlockCost: 370 },
  { id: "blocks", name: "Blocks", icon: "🧱", baseSellValue: 18.0, unlockCost: 485 },
  { id: "crayons", name: "Crayon Set", icon: "🖍️", baseSellValue: 23.0, unlockCost: 640 },
  { id: "train", name: "Wooden Train", icon: "🚂", baseSellValue: 30.0, unlockCost: 860 },
  { id: "rocking_horse", name: "Rocking Horse", icon: "🎠", baseSellValue: 38.0, unlockCost: 1100 },
  { id: "boat", name: "Toy Boat", icon: "⛵", baseSellValue: 49.0, unlockCost: 1500 },
  { id: "board_game", name: "Board Game", icon: "🎲", baseSellValue: 64.0, unlockCost: 2000 },
  { id: "puzzle", name: "Jigsaw Puzzle", icon: "🧩", baseSellValue: 82.0, unlockCost: 2650 },
  { id: "dollhouse", name: "Dollhouse", icon: "🏠", baseSellValue: 105.0, unlockCost: 3500 },
  { id: "xylophone", name: "Xylophone", icon: "🎼", baseSellValue: 135.0, unlockCost: 4650, category: "music" },
  { id: "toy_car", name: "Toy Car", icon: "🚗", baseSellValue: 175.0, unlockCost: 6200 },
  { id: "dolls", name: "Dolls", icon: "🪆", baseSellValue: 230.0, unlockCost: 8350 },
  { id: "robot", name: "Tin Robot", icon: "🤖", baseSellValue: 295.0, unlockCost: 11000 },
  { id: "plane", name: "Toy Plane", icon: "✈️", baseSellValue: 380.0, unlockCost: 14500 },
  { id: "fire_truck", name: "Fire Truck", icon: "🚒", baseSellValue: 490.0, unlockCost: 19500 },
  { id: "piano", name: "Toy Piano", icon: "🎹", baseSellValue: 630.0, unlockCost: 26000, category: "music" },
  { id: "drum", name: "Toy Drum", icon: "🥁", baseSellValue: 815.0, unlockCost: 34500, category: "music" },
  { id: "rocket", name: "Model Rocket", icon: "🚀", baseSellValue: 1050.0, unlockCost: 45500 },
  { id: "bike", name: "Bicycle", icon: "🚲", baseSellValue: 1350.0, unlockCost: 60500 },
  { id: "scooter", name: "Scooter", icon: "🛴", baseSellValue: 1750.0, unlockCost: 80500 },
  { id: "skateboard", name: "Skateboard", icon: "🛹", baseSellValue: 2250.0, unlockCost: 105000, category: "sports" },
  { id: "roller_skates", name: "Roller Skates", icon: "🛼", baseSellValue: 2900.0, unlockCost: 140000, category: "sports" },
  { id: "ice_skates", name: "Ice Skates", icon: "⛸️", baseSellValue: 3750.0, unlockCost: 190000, category: "sports" },
  { id: "sports", name: "Sport Equipment", icon: "🏅", baseSellValue: 4850.0, unlockCost: 250000, category: "sports" },
  { id: "console", name: "Game Console", icon: "🎮", baseSellValue: 6250.0, unlockCost: 335000, category: "electronics" },
  { id: "camera", name: "Toy Camera", icon: "📷", baseSellValue: 8050.0, unlockCost: 445000, category: "electronics" },
  { id: "karaoke", name: "Karaoke Mic", icon: "🎤", baseSellValue: 10500.0, unlockCost: 595000, category: "music" },
  { id: "telescope", name: "Telescope", icon: "🔭", baseSellValue: 13500.0, unlockCost: 790000 },
  { id: "microscope", name: "Microscope", icon: "🔬", baseSellValue: 17500.0, unlockCost: 1050000 },
  { id: "walkie", name: "Walkie-Talkies", icon: "📻", baseSellValue: 22500.0, unlockCost: 1400000, category: "electronics" },
  { id: "rc_car", name: "RC Car", icon: "🏎️", baseSellValue: 28500.0, unlockCost: 1800000, category: "electronics" },
  { id: "drone", name: "Drone", icon: "🛸", baseSellValue: 37000.0, unlockCost: 2450000, category: "electronics" },
  { id: "trampoline", name: "Trampoline", icon: "🤸", baseSellValue: 48000.0, unlockCost: 3250000, category: "sports" },
  { id: "bouncy_castle", name: "Bouncy Castle", icon: "🏰", baseSellValue: 61500.0, unlockCost: 4300000 },
  { id: "vr", name: "VR Headset", icon: "🥽", baseSellValue: 79500.0, unlockCost: 5700000, category: "electronics" },
  { id: "blaster", name: "Foam Blaster", icon: "🔫", baseSellValue: 105000.0, unlockCost: 7750000 },
  { id: "robot_companion", name: "Robot Companion", icon: "🦾", baseSellValue: 130000.0, unlockCost: 9900000, category: "electronics" },
  { id: "puppy", name: "Puppy", icon: "🐶", baseSellValue: 170000.0, unlockCost: 13350000, category: "animals" },
  { id: "kitten", name: "Kitten", icon: "🐱", baseSellValue: 220000.0, unlockCost: 17750000, category: "animals" },
  { id: "pony", name: "Pony", icon: "🐴", baseSellValue: 285000.0, unlockCost: 23700000, category: "animals" },
  { id: "wand", name: "Magic Wand", icon: "🪄", baseSellValue: 365000.0, unlockCost: 31300000, category: "jewellery" },
  { id: "spaceship", name: "Toy Spaceship", icon: "🛰️", baseSellValue: 475000.0, unlockCost: 41900000 },
  { id: "tiara", name: "Diamond Tiara", icon: "👑", baseSellValue: 610000.0, unlockCost: 55450000, category: "jewellery" },
  { id: "crystal_ball", name: "Crystal Ball", icon: "🔮", baseSellValue: 785000.0, unlockCost: 73500000, category: "jewellery" },
];

export function getToyType(id: string): ToyTypeDef | undefined {
  return toyTypes.find((t) => t.id === id);
}

/** A toy's category id ("basic" when untagged). */
export function toyCategoryId(toy: ToyTypeDef): string {
  return toy.category ?? "basic";
}

/** The hand-build upgrade id gating a toy's click, or undefined for basic toys
 *  (which are hand-clickable the moment their line is unlocked). */
export function toyHandbuildUpgrade(toyId: string): string | undefined {
  const toy = getToyType(toyId);
  if (!toy || toyCategoryId(toy) === "basic") return undefined;
  return `handbuild_${toyId}`;
}
