/**
 * Production pipeline tuning — used by PipelineSystem.
 *
 * Each toy flows through stages: raw → assembled → finished.
 *
 * Steps can be:
 *  - Type-specific (toyType set): only processes that toy type.
 *  - Shared (toyType null): processes ALL toy types (e.g. packaging).
 *
 * Shared steps appear once in the UI but handle items from every type.
 */

export type ProductionStage = "parts" | "raw" | "assembled" | "finished";

/** Display metadata for each stage (single source for icons/labels in the UI). */
export const PRODUCTION_STAGES: { id: ProductionStage; label: string; icon: string }[] = [
  // "parts" is only used by toys with a multi-step line (e.g. the bike); most
  // toys craft straight to "raw".
  { id: "parts", label: "Parts", icon: "🔩" },
  { id: "raw", label: "Raw", icon: "📦" },
  { id: "assembled", label: "Checked", icon: "🔍" },
  { id: "finished", label: "Finished", icon: "🎁" },
];

export type PipelineStepDef = {
  id: string;
  name: string;
  description: string;

  /** Which toy type this step serves. null = shared (processes all types). */
  toyType: string | null;

  /** Stage this step consumes from. null = creates from nothing (first step). */
  inputStage: ProductionStage | null;

  /** Stage this step produces into. */
  outputStage: ProductionStage;

  /** Seconds for one elf to complete one item, before speed upgrades. */
  baseTime: number;

  /** Position in the pipeline UI (ascending). */
  order: number;
};

// One craft step per toy (see toyTypesConfig for the matching value curve).
// baseTime ≈ 2 × 1.05^i seconds. Names/descriptions here are English fallbacks;
// the localized strings live in messages.ts (step.<id>.name / .desc). The two
// shared steps (Quality Control, Packaging) process every toy type.
export const pipelineSteps: PipelineStepDef[] = [
  { id: "craft_plushy", name: "Craft Plushy", description: "Elves craft soft plushies from magical materials.", toyType: "plushy", inputStage: null, outputStage: "raw", baseTime: 2, order: 1.0 },
  { id: "craft_rubik", name: "Craft Rubik's Cube", description: "Elves carefully align and assemble colorful cube puzzles.", toyType: "rubik", inputStage: null, outputStage: "raw", baseTime: 2, order: 1.01 },
  { id: "craft_yoyo", name: "Craft Yo-Yo", description: "Elves string and balance spinning yo-yos.", toyType: "yoyo", inputStage: null, outputStage: "raw", baseTime: 2, order: 1.02 },
  { id: "craft_kite", name: "Craft Kite", description: "Elves stretch bright fabric over light kite frames.", toyType: "kite", inputStage: null, outputStage: "raw", baseTime: 2, order: 1.03 },
  { id: "craft_bouncy_ball", name: "Craft Bouncy Ball", description: "Elves mold and cure super-bouncy rubber balls.", toyType: "bouncy_ball", inputStage: null, outputStage: "raw", baseTime: 2, order: 1.04 },
  { id: "craft_balloon", name: "Craft Balloon", description: "Elves twist and knot colorful balloon animals.", toyType: "balloon", inputStage: null, outputStage: "raw", baseTime: 3, order: 1.05 },
  { id: "craft_rubber_duck", name: "Craft Rubber Duck", description: "Elves cast and paint cheerful rubber ducks.", toyType: "rubber_duck", inputStage: null, outputStage: "raw", baseTime: 3, order: 1.06 },
  { id: "craft_blocks", name: "Craft Blocks", description: "Elves sand and stack sets of building blocks.", toyType: "blocks", inputStage: null, outputStage: "raw", baseTime: 3, order: 1.07 },
  { id: "craft_crayons", name: "Craft Crayon Set", description: "Elves pour and wrap boxes of wax crayons.", toyType: "crayons", inputStage: null, outputStage: "raw", baseTime: 3, order: 1.08 },
  { id: "craft_train", name: "Craft Wooden Train", description: "Elves carve and paint little wooden locomotives.", toyType: "train", inputStage: null, outputStage: "raw", baseTime: 3, order: 1.09 },
  { id: "craft_rocking_horse", name: "Craft Rocking Horse", description: "Elves carve and mount gentle rocking horses.", toyType: "rocking_horse", inputStage: null, outputStage: "raw", baseTime: 3, order: 1.1 },
  { id: "craft_boat", name: "Craft Toy Boat", description: "Elves seal and rig little floating toy boats.", toyType: "boat", inputStage: null, outputStage: "raw", baseTime: 3, order: 1.11 },
  { id: "craft_board_game", name: "Craft Board Game", description: "Elves print boards and punch out game pieces.", toyType: "board_game", inputStage: null, outputStage: "raw", baseTime: 4, order: 1.12 },
  { id: "craft_puzzle", name: "Craft Jigsaw Puzzle", description: "Elves cut and box interlocking jigsaw puzzles.", toyType: "puzzle", inputStage: null, outputStage: "raw", baseTime: 4, order: 1.13 },
  { id: "craft_dollhouse", name: "Craft Dollhouse", description: "Elves build and furnish miniature dollhouses.", toyType: "dollhouse", inputStage: null, outputStage: "raw", baseTime: 4, order: 1.14 },
  { id: "craft_xylophone", name: "Craft Xylophone", description: "Elves tune and mount colorful xylophone bars.", toyType: "xylophone", inputStage: null, outputStage: "raw", baseTime: 4, order: 1.15 },
  { id: "craft_toy_car", name: "Craft Toy Car", description: "Elves cast and polish little die-cast cars.", toyType: "toy_car", inputStage: null, outputStage: "raw", baseTime: 4, order: 1.16 },
  { id: "craft_dolls", name: "Craft Dolls", description: "Elves stitch and dress friendly little dolls.", toyType: "dolls", inputStage: null, outputStage: "raw", baseTime: 5, order: 1.17 },
  { id: "craft_robot", name: "Craft Tin Robot", description: "Elves rivet and wind up clockwork tin robots.", toyType: "robot", inputStage: null, outputStage: "raw", baseTime: 5, order: 1.18 },
  { id: "craft_plane", name: "Craft Toy Plane", description: "Elves rivet wings onto zippy toy planes.", toyType: "plane", inputStage: null, outputStage: "raw", baseTime: 5, order: 1.19 },
  { id: "craft_fire_truck", name: "Craft Fire Truck", description: "Elves paint and ladder up bright fire trucks.", toyType: "fire_truck", inputStage: null, outputStage: "raw", baseTime: 5, order: 1.2 },
  { id: "craft_piano", name: "Craft Toy Piano", description: "Elves tune the keys of tiny toy pianos.", toyType: "piano", inputStage: null, outputStage: "raw", baseTime: 6, order: 1.21 },
  { id: "craft_drum", name: "Craft Toy Drum", description: "Elves stretch skins over colorful toy drums.", toyType: "drum", inputStage: null, outputStage: "raw", baseTime: 6, order: 1.22 },
  { id: "craft_rocket", name: "Craft Model Rocket", description: "Elves fold fins onto whistling model rockets.", toyType: "rocket", inputStage: null, outputStage: "raw", baseTime: 6, order: 1.23 },
  { id: "craft_bike_frame", name: "Weld Bike Frame", description: "Elves weld and paint sturdy bicycle frames from raw metal.", toyType: "bike", inputStage: null, outputStage: "parts", baseTime: 14, order: 1.24 },
  { id: "assemble_bike", name: "Assemble Bike", description: "Wheels, chain and seat are fitted onto the welded frame.", toyType: "bike", inputStage: "parts", outputStage: "raw", baseTime: 16, order: 1.245 },
  { id: "craft_scooter", name: "Craft Scooter", description: "Elves bolt wheels onto zippy kick scooters.", toyType: "scooter", inputStage: null, outputStage: "raw", baseTime: 7, order: 1.25 },
  { id: "craft_skateboard", name: "Craft Skateboard", description: "Elves press decks and mount skateboard trucks.", toyType: "skateboard", inputStage: null, outputStage: "raw", baseTime: 7, order: 1.26 },
  { id: "craft_roller_skates", name: "Craft Roller Skates", description: "Elves lace and wheel up roller skates.", toyType: "roller_skates", inputStage: null, outputStage: "raw", baseTime: 7, order: 1.27 },
  { id: "craft_ice_skates", name: "Craft Ice Skates", description: "Elves sharpen and fit gleaming ice skates.", toyType: "ice_skates", inputStage: null, outputStage: "raw", baseTime: 8, order: 1.28 },
  { id: "craft_sports", name: "Craft Sport Equipment", description: "Elves stitch balls and bundle sports gear.", toyType: "sports", inputStage: null, outputStage: "raw", baseTime: 8, order: 1.29 },
  { id: "craft_console", name: "Craft Game Console", description: "Elves solder chips into sleek game consoles.", toyType: "console", inputStage: null, outputStage: "raw", baseTime: 9, order: 1.3 },
  { id: "craft_camera", name: "Craft Toy Camera", description: "Elves fit lenses into snappy toy cameras.", toyType: "camera", inputStage: null, outputStage: "raw", baseTime: 9, order: 1.31 },
  { id: "craft_karaoke", name: "Craft Karaoke Mic", description: "Elves wire up sparkly karaoke microphones.", toyType: "karaoke", inputStage: null, outputStage: "raw", baseTime: 10, order: 1.32 },
  { id: "craft_telescope", name: "Craft Telescope", description: "Elves grind and align telescope lenses.", toyType: "telescope", inputStage: null, outputStage: "raw", baseTime: 10, order: 1.33 },
  { id: "craft_microscope", name: "Craft Microscope", description: "Elves calibrate tiny classroom microscopes.", toyType: "microscope", inputStage: null, outputStage: "raw", baseTime: 11, order: 1.34 },
  { id: "craft_walkie", name: "Craft Walkie-Talkies", description: "Elves pair and test crackly walkie-talkies.", toyType: "walkie", inputStage: null, outputStage: "raw", baseTime: 11, order: 1.35 },
  { id: "craft_rc_car", name: "Craft RC Car", description: "Elves wire motors into speedy RC cars.", toyType: "rc_car", inputStage: null, outputStage: "raw", baseTime: 12, order: 1.36 },
  { id: "craft_drone", name: "Craft Drone", description: "Elves balance rotors on buzzing toy drones.", toyType: "drone", inputStage: null, outputStage: "raw", baseTime: 12, order: 1.37 },
  { id: "craft_trampoline", name: "Craft Trampoline", description: "Elves spring and stitch bouncy trampolines.", toyType: "trampoline", inputStage: null, outputStage: "raw", baseTime: 13, order: 1.38 },
  { id: "craft_bouncy_castle", name: "Craft Bouncy Castle", description: "Elves stitch and seal giant bouncy castles.", toyType: "bouncy_castle", inputStage: null, outputStage: "raw", baseTime: 13, order: 1.39 },
  { id: "craft_vr", name: "Craft VR Headset", description: "Elves fit lenses into immersive VR headsets.", toyType: "vr", inputStage: null, outputStage: "raw", baseTime: 14, order: 1.4 },
  { id: "craft_blaster", name: "Craft Foam Blaster", description: "Elves spring-load foam-dart blasters.", toyType: "blaster", inputStage: null, outputStage: "raw", baseTime: 15, order: 1.41 },
  { id: "craft_robot_companion", name: "Craft Robot Companion", description: "Elves program friendly robot companions.", toyType: "robot_companion", inputStage: null, outputStage: "raw", baseTime: 16, order: 1.42 },
  { id: "craft_puppy", name: "Craft Puppy", description: "Elves raise and train wriggly little puppies.", toyType: "puppy", inputStage: null, outputStage: "raw", baseTime: 16, order: 1.43 },
  { id: "craft_kitten", name: "Craft Kitten", description: "Elves raise and cuddle tiny playful kittens.", toyType: "kitten", inputStage: null, outputStage: "raw", baseTime: 17, order: 1.44 },
  { id: "craft_pony", name: "Craft Pony", description: "Elves groom and saddle gentle little ponies.", toyType: "pony", inputStage: null, outputStage: "raw", baseTime: 18, order: 1.45 },
  { id: "craft_wand", name: "Craft Magic Wand", description: "Elves enchant and polish sparkling magic wands.", toyType: "wand", inputStage: null, outputStage: "raw", baseTime: 19, order: 1.46 },
  { id: "craft_spaceship", name: "Craft Toy Spaceship", description: "Elves rivet hulls onto gleaming toy spaceships.", toyType: "spaceship", inputStage: null, outputStage: "raw", baseTime: 20, order: 1.47 },
  { id: "craft_tiara", name: "Craft Diamond Tiara", description: "Elves set glittering stones into diamond tiaras.", toyType: "tiara", inputStage: null, outputStage: "raw", baseTime: 21, order: 1.48 },
  { id: "craft_crystal_ball", name: "Craft Crystal Ball", description: "Elves polish and enchant swirling crystal balls.", toyType: "crystal_ball", inputStage: null, outputStage: "raw", baseTime: 22, order: 1.49 },
  {
    id: "assembly",
    name: "Quality Control",
    description: "Freshly crafted toys are inspected and finished to gift standard.",
    toyType: null,
    inputStage: "raw",
    outputStage: "assembled",
    baseTime: 1,
    order: 2,
  },
  {
    id: "packaging",
    name: "Packaging",
    description: "Products are wrapped and packaged as finished gifts.",
    toyType: null,
    inputStage: "assembled",
    outputStage: "finished",
    baseTime: 2,
    order: 3,
  },
];

export function getPipelineStep(id: string): PipelineStepDef | undefined {
  return pipelineSteps.find((s) => s.id === id);
}

export function getOrderedSteps(): PipelineStepDef[] {
  return [...pipelineSteps].sort((a, b) => a.order - b.order);
}
