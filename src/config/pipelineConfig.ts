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

export type ProductionStage = "raw" | "assembled" | "finished";

/** Display metadata for each stage (single source for icons/labels in the UI). */
export const PRODUCTION_STAGES: { id: ProductionStage; label: string; icon: string }[] = [
  { id: "raw", label: "Raw", icon: "📦" },
  { id: "assembled", label: "Assembled", icon: "🔧" },
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
    id: "assembly",
    name: "Assembly",
    description: "Raw toys are assembled into complete products.",
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
