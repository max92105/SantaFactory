/**
 * Production pipeline — GENERATED from the toy catalog + toy categories.
 *
 * Each toy flows: craft → [its category's specialist steps] → Quality Control
 * → Packaging. The stages are wired so QC and Packaging stay SHARED and uniform
 * across every category:
 *
 *   craft:            null → (raw if no specialist steps, else wip1)
 *   specialist step i: wip{i} → (raw if last, else wip{i+1})
 *   quality control:  raw → assembled            (shared, all toys)
 *   packaging:        assembled → finished       (shared, all toys)
 *
 * Steps can be:
 *  - Craft (toyType set): only that toy's line.
 *  - Specialist (categoryId + requiredSpecialty set): a shared station that
 *    only processes one category's toys, staffable only by that specialty's elves.
 *  - Shared (toyType null, no categoryId): QC / Packaging — every toy.
 *
 * Add toys/categories in their configs; the steps below regenerate. Nothing here
 * is hand-authored per toy.
 */

import { toyTypes, toyCategoryId } from "./toyTypesConfig";
import { toyCategories } from "./toyCategoriesConfig";

/** Item stages a toy passes through. `wip1`/`wip2` are only used by categories
 *  with 1/2 specialist steps; `broken` is an inventory tally, not a flow stage. */
export type ProductionStage = "wip1" | "wip2" | "raw" | "assembled" | "finished";

/** Display metadata for each stage (single source for icons/labels in the UI). */
export const PRODUCTION_STAGES: { id: ProductionStage; label: string; icon: string }[] = [
  { id: "wip1", label: "Crafted", icon: "🔩" },
  { id: "wip2", label: "In progress", icon: "⚙️" },
  { id: "raw", label: "Ready", icon: "📦" },
  { id: "assembled", label: "Checked", icon: "🔍" },
  { id: "finished", label: "Finished", icon: "🎁" },
];

export type PipelineStepDef = {
  id: string;
  name: string;
  description: string;

  /** Which toy this craft step serves. null = shared (specialist / QC / packaging). */
  toyType: string | null;
  /** For a specialist step: the category whose toys it processes (else undefined). */
  categoryId?: string;
  /** For a specialist step: the elf specialty required to staff it (else undefined). */
  requiredSpecialty?: string;

  /** Stage this step consumes from. null = creates from nothing (craft). */
  inputStage: ProductionStage | null;
  /** Stage this step produces into. */
  outputStage: ProductionStage;

  /** Seconds for one elf to complete one item, before speed upgrades. */
  baseTime: number;

  /** Position in the pipeline UI (ascending). */
  order: number;
};

/** wip stage id for the i-th specialist step (0-based): wip1, wip2, … */
function wipStage(i: number): ProductionStage {
  return `wip${i + 1}` as ProductionStage;
}

/** Craft-step baseTime for the toy at catalog index i (≈ 2 × 1.05^i seconds). */
function craftTime(i: number): number {
  return Math.max(2, Math.round(2 * Math.pow(1.05, i)));
}

function buildPipelineSteps(): PipelineStepDef[] {
  const steps: PipelineStepDef[] = [];

  // 1. One craft step per toy — outputs to `raw` (basic) or `wip1` (has steps).
  toyTypes.forEach((toy, i) => {
    const cat = toyCategories.find((c) => c.id === toyCategoryId(toy));
    const hasSpecialist = (cat?.specialistSteps.length ?? 0) > 0;
    steps.push({
      id: `craft_${toy.id}`,
      name: `Craft ${toy.name}`,
      description: "",
      toyType: toy.id,
      inputStage: null,
      outputStage: hasSpecialist ? "wip1" : "raw",
      baseTime: craftTime(i),
      order: 1 + i * 0.001,
    });
  });

  // 2. Specialist stations — one shared, category-scoped step per specialist
  //    step. Flows wip1 → wip2 → … → raw (the last one feeds Quality Control).
  toyCategories.forEach((cat, ci) => {
    cat.specialistSteps.forEach((s, si) => {
      const last = si === cat.specialistSteps.length - 1;
      steps.push({
        id: s.id,
        name: s.id,
        description: "",
        toyType: null,
        categoryId: cat.id,
        requiredSpecialty: s.specialty,
        inputStage: wipStage(si),
        outputStage: last ? "raw" : wipStage(si + 1),
        baseTime: s.baseTime,
        order: 1.5 + ci * 0.01 + si * 0.001,
      });
    });
  });

  // 3. Shared finishing steps — every toy converges here.
  steps.push({
    id: "assembly",
    name: "Quality Control",
    description: "Freshly crafted toys are inspected and finished to gift standard.",
    toyType: null,
    inputStage: "raw",
    outputStage: "assembled",
    baseTime: 3,
    order: 2,
  });
  steps.push({
    id: "packaging",
    name: "Packaging",
    description: "Products are wrapped and packaged as finished gifts.",
    toyType: null,
    inputStage: "assembled",
    outputStage: "finished",
    baseTime: 2,
    order: 3,
  });

  return steps;
}

export const pipelineSteps: PipelineStepDef[] = buildPipelineSteps();

export function getPipelineStep(id: string): PipelineStepDef | undefined {
  return pipelineSteps.find((s) => s.id === id);
}

export function getOrderedSteps(): PipelineStepDef[] {
  return [...pipelineSteps].sort((a, b) => a.order - b.order);
}

/** True if this step is a category-scoped specialist station. */
export function isSpecialistStep(step: PipelineStepDef): boolean {
  return step.toyType === null && step.categoryId !== undefined;
}
