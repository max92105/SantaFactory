/**
 * PipelineSystem — automatic multi-step production driven by assigned elves.
 * Items flow raw → assembled → finished through the steps in config/pipelineConfig.ts.
 */

import type { GameState } from "../state/GameState";
import { addToStage, getStageCount, removeFromStage } from "../helpers/inventoryHelpers";
import { pipelineSteps, type PipelineStepDef, type ProductionStage } from "../config/pipelineConfig";
import { toyTypes } from "../config/toyTypesConfig";
import { isToyUnlocked } from "../helpers/unlockHelpers";
import { pluralizeElves } from "../helpers/textHelpers";
import type { Modifiers } from "./ModifierSystem";

export type StepProgress = {
  stepId: string;
  progress: number; // 0..1
  elvesAssigned: number;
  outputPerSecond: number;
  isBottlenecked: boolean;
};

export type PipelineView = {
  steps: StepProgress[];
};

export function createPipelineSystem() {
  /** Fractional work-in-progress per step (not saved — resets on reload). */
  const progressAccum: Record<string, number> = {};

  /**
   * Check if a step has any input to process.
   * Type-specific: check that type's inputStage.
   * Shared: check if ANY type has items in inputStage.
   */
  function hasInput(state: GameState, step: PipelineStepDef): boolean {
    if (!step.inputStage) return true; // creates from nothing

    if (step.toyType) {
      return getStageCount(state, step.toyType, step.inputStage) >= 1;
    }
    // Shared: any type with items
    return toyTypes.some((t) => getStageCount(state, t.id, step.inputStage!) >= 1);
  }

  /** For a shared step, find a toy type that has items in the input stage. */
  function findAvailableType(state: GameState, inputStage: ProductionStage): string | null {
    for (const t of toyTypes) {
      if (getStageCount(state, t.id, inputStage) >= 1) return t.id;
    }
    return null;
  }

  function getStepOutputPerSecond(state: GameState, step: PipelineStepDef, mods: Modifiers): number {
    const elves = state.workforce.assignments[step.id] ?? 0;
    if (elves <= 0) return 0;
    const effectiveTime = step.baseTime / mods.producerSpeedMult;
    return (elves / effectiveTime) * mods.producerOutputMult;
  }

  function update(state: GameState, mods: Modifiers, dtSeconds: number): void {
    if (state.meta.isRunOver || state.meta.isPaused) return;

    for (const step of pipelineSteps) {
      // Craft steps for toys the player hasn't unlocked yet don't run
      if (step.toyType && !isToyUnlocked(state, step.toyType)) continue;

      const elves = state.workforce.assignments[step.id] ?? 0;
      if (elves <= 0) continue;
      if (!hasInput(state, step)) continue;

      const effectiveTime = step.baseTime / mods.producerSpeedMult;
      const rawProduction = (elves / effectiveTime) * dtSeconds * mods.producerOutputMult;

      progressAccum[step.id] = (progressAccum[step.id] ?? 0) + rawProduction;

      while (progressAccum[step.id] >= 1) {
        // Determine which toy type to process
        let targetType: string | null = null;

        if (step.toyType) {
          // Type-specific step
          if (step.inputStage && getStageCount(state, step.toyType, step.inputStage) < 1) break;
          targetType = step.toyType;
        } else {
          // Shared step — find any type with input
          if (!step.inputStage) break; // shared step must have input
          targetType = findAvailableType(state, step.inputStage);
          if (!targetType) break;
        }

        // Consume input
        if (step.inputStage) {
          if (!removeFromStage(state, targetType, step.inputStage, 1)) break;
        }

        // Produce output
        addToStage(state, targetType, step.outputStage, 1);
        progressAccum[step.id] -= 1;
      }
    }
  }

  function assignElves(state: GameState, stepId: string, count: number): boolean {
    if (count <= 0 || state.workforce.unassigned < count) return false;
    const step = pipelineSteps.find((s) => s.id === stepId);
    if (!step) return false;

    state.workforce.assignments[stepId] = (state.workforce.assignments[stepId] ?? 0) + count;
    state.workforce.unassigned -= count;
    state.meta.statusText = `Assigned ${count} ${pluralizeElves(count)} to ${step.name}.`;
    return true;
  }

  function unassignElves(state: GameState, stepId: string, count: number): boolean {
    if (count <= 0) return false;
    const current = state.workforce.assignments[stepId] ?? 0;
    if (current < count) return false;
    const step = pipelineSteps.find((s) => s.id === stepId);
    if (!step) return false;

    state.workforce.assignments[stepId] = current - count;
    state.workforce.unassigned += count;
    state.meta.statusText = `Unassigned ${count} ${pluralizeElves(count)} from ${step.name}.`;
    return true;
  }

  function getView(state: GameState, mods: Modifiers): PipelineView {
    const steps: StepProgress[] = pipelineSteps.map((step) => {
      const elvesAssigned = state.workforce.assignments[step.id] ?? 0;
      const progress = elvesAssigned > 0 ? (progressAccum[step.id] ?? 0) : 0;

      return {
        stepId: step.id,
        progress: Math.min(1, progress),
        elvesAssigned,
        outputPerSecond: getStepOutputPerSecond(state, step, mods),
        isBottlenecked: !hasInput(state, step) && elvesAssigned > 0,
      };
    });

    return { steps };
  }

  return { update, assignElves, unassignElves, getView, getStepOutputPerSecond };
}

export type PipelineSystem = ReturnType<typeof createPipelineSystem>;
