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

export const pipelineSteps: PipelineStepDef[] = [
  {
    id: "craft_plushy",
    name: "Craft Plushy",
    description: "Elves craft soft plushies from magical materials.",
    toyType: "plushy",
    inputStage: null,
    outputStage: "raw",
    baseTime: 2,
    order: 1,
  },
  {
    id: "craft_rubik",
    name: "Craft Rubik's Cube",
    description: "Elves carefully align and assemble colorful cube puzzles.",
    toyType: "rubik",
    inputStage: null,
    outputStage: "raw",
    baseTime: 5,
    order: 1.5,
  },
  {
    id: "craft_train",
    name: "Craft Wooden Train",
    description: "Elves carve and paint little wooden locomotives.",
    toyType: "train",
    inputStage: null,
    outputStage: "raw",
    baseTime: 8,
    order: 1.6,
  },
  {
    id: "craft_robot",
    name: "Craft Tin Robot",
    description: "Elves rivet and wind up clockwork tin robots.",
    toyType: "robot",
    inputStage: null,
    outputStage: "raw",
    baseTime: 12,
    order: 1.7,
  },
  {
    id: "craft_bike_frame",
    name: "Weld Bike Frame",
    description: "Elves weld and paint sturdy bicycle frames from raw metal.",
    toyType: "bike",
    inputStage: null,
    outputStage: "parts",
    baseTime: 14,
    order: 1.8,
  },
  {
    id: "assemble_bike",
    name: "Assemble Bike",
    description: "Wheels, chain and seat are fitted onto the welded frame.",
    toyType: "bike",
    inputStage: "parts",
    outputStage: "raw",
    baseTime: 16,
    order: 1.85,
  },
  {
    id: "assembly",
    name: "Quality Control",
    description: "Freshly crafted toys are inspected and finished to gift standard.",
    toyType: null,
    inputStage: "raw",
    outputStage: "assembled",
    baseTime: 3,
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
