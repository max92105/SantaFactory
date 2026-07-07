/**
 * Multi-Step Production Pipeline
 *
 * Each toy type flows through stages: raw → assembled → finished
 *
 * Steps can be:
 * - Type-specific (toyType set): only processes that toy type
 * - Shared (toyType null): processes ALL toy types (e.g. packaging)
 *
 * Shared steps appear once in the UI but handle items from every type.
 */

export type ProductionStage = "raw" | "assembled" | "finished";

export type PipelineStepDef = {
  id: string;
  name: string;
  description: string;

  // Which toy type this step serves. null = shared (processes all types)
  toyType: string | null;

  // Which stage this consumes from (null = creates from nothing, i.e. first step)
  inputStage: ProductionStage | null;

  // Which stage this produces into
  outputStage: ProductionStage;

  // Base time to complete one production cycle (seconds)
  baseTime: number;

  // Order in the pipeline (for UI)
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
