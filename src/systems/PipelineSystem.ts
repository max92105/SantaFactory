/**
 * PipelineSystem — automatic multi-step production driven by scheduled elves.
 * Items flow raw → assembled → finished through the steps in config/pipelineConfig.ts.
 *
 * Production is per shift slot: only elves scheduled for the CURRENT slot
 * (config/shiftsConfig.ts, derived from the day clock) work a step. Every
 * finished item can be ruined (weighted mistakeChance of that slot's elves) or
 * break the station (weighted breakChance). Broken stations halt until repaired.
 */

import type { GameState } from "../state/GameState";
import { addToStage, getStageCount, removeFromStage, addBroken } from "../helpers/inventoryHelpers";
import { pipelineSteps, getPipelineStep, type PipelineStepDef, type ProductionStage } from "../config/pipelineConfig";
import { toyTypes } from "../config/toyTypesConfig";
import { currentShiftSlot, getShiftSlot } from "../config/shiftsConfig";
import { isToyUnlocked } from "../helpers/unlockHelpers";
import {
  assignElves as assignElvesToStep,
  removeElves as removeElvesFromState,
  activeOnStep,
  slotMistakeChance,
  slotBreakChance,
} from "../helpers/workforceHelpers";
import { pluralizeElves } from "../helpers/textHelpers";
import { isStationBroken, setStationBroken } from "../helpers/stationHelpers";
import { STATION_REPAIR_COST } from "../config/stationsConfig";
import { getElfType } from "../config/elfTypesConfig";
import type { Modifiers } from "./ModifierSystem";

export type StepProgress = {
  stepId: string;
  progress: number; // 0..1
  elvesAssigned: number; // active in the current slot
  outputPerSecond: number;
  mistakeChance: number;
  broken: boolean;
  isBottlenecked: boolean;
};

export type PipelineView = {
  activeSlot: string;
  steps: StepProgress[];
};

export function createPipelineSystem() {
  /** Fractional work-in-progress per step (not saved — resets on reload). */
  const progressAccum: Record<string, number> = {};

  function hasInput(state: GameState, step: PipelineStepDef): boolean {
    if (!step.inputStage) return true; // creates from nothing
    if (step.toyType) return getStageCount(state, step.toyType, step.inputStage) >= 1;
    return toyTypes.some((t) => getStageCount(state, t.id, step.inputStage!) >= 1);
  }

  function findAvailableType(state: GameState, inputStage: ProductionStage): string | null {
    for (const t of toyTypes) {
      if (getStageCount(state, t.id, inputStage) >= 1) return t.id;
    }
    return null;
  }

  function getStepOutputPerSecond(state: GameState, step: PipelineStepDef, mods: Modifiers): number {
    if (isStationBroken(state, step.id)) return 0;
    const slot = currentShiftSlot(state.time.dayProgress);
    const elves = activeOnStep(state, step.id, slot);
    if (elves <= 0) return 0;
    const effectiveTime = step.baseTime / mods.producerSpeedMult;
    const successRate = 1 - slotMistakeChance(state, step.id, slot);
    return (elves / effectiveTime) * mods.producerOutputMult * successRate;
  }

  function update(state: GameState, mods: Modifiers, dtSeconds: number): void {
    if (state.meta.isRunOver || state.meta.isPaused) return;

    const slot = currentShiftSlot(state.time.dayProgress);

    for (const step of pipelineSteps) {
      if (step.toyType && !isToyUnlocked(state, step.toyType)) continue;
      if (isStationBroken(state, step.id)) continue;

      const elves = activeOnStep(state, step.id, slot);
      if (elves <= 0) continue;
      if (!hasInput(state, step)) continue;

      const effectiveTime = step.baseTime / mods.producerSpeedMult;
      const rawProduction = (elves / effectiveTime) * dtSeconds * mods.producerOutputMult;

      progressAccum[step.id] = (progressAccum[step.id] ?? 0) + rawProduction;

      const mistakeChance = slotMistakeChance(state, step.id, slot);
      const breakChance = slotBreakChance(state, step.id, slot);

      while (progressAccum[step.id] >= 1) {
        // Elf mistake breaks the station? Halt it and alert the player.
        if (Math.random() < breakChance) {
          setStationBroken(state, step.id, true);
          progressAccum[step.id] = 0;
          state.pendingAlerts.push(`🔧 ${step.name} broke down! Repair it in the Factory.`);
          break;
        }

        let targetType: string | null = null;
        if (step.toyType) {
          if (step.inputStage && getStageCount(state, step.toyType, step.inputStage) < 1) break;
          targetType = step.toyType;
        } else {
          if (!step.inputStage) break;
          targetType = findAvailableType(state, step.inputStage);
          if (!targetType) break;
        }

        if (step.inputStage) {
          if (!removeFromStage(state, targetType, step.inputStage, 1)) break;
        }

        // Elf mistake? Ruin the item (kept in the broken tally) instead of output.
        if (Math.random() < mistakeChance) {
          addBroken(state, targetType, 1);
          state.dayStats.ruined += 1;
          state.stats.lifetimeRuined += 1;
        } else {
          addToStage(state, targetType, step.outputStage, 1);
        }

        progressAccum[step.id] -= 1;
      }
    }
  }

  /** Pay to repair a broken station. Returns false if not broken or unaffordable. */
  function repairStation(state: GameState, stepId: string): boolean {
    if (!isStationBroken(state, stepId)) return false;
    if (state.resources.money < STATION_REPAIR_COST) {
      state.meta.statusText = `Not enough money to repair (need $${STATION_REPAIR_COST}).`;
      return false;
    }
    state.resources.money -= STATION_REPAIR_COST;
    setStationBroken(state, stepId, false);
    const name = getPipelineStep(stepId)?.name ?? "Station";
    state.meta.statusText = `${name} repaired for $${STATION_REPAIR_COST}.`;
    return true;
  }

  /** Schedule up to `count` idle elves of a type onto a step with the same slots. */
  function assignElves(
    state: GameState,
    elfTypeId: string,
    stepId: string,
    slots: string[],
    count: number
  ): number {
    const step = pipelineSteps.find((s) => s.id === stepId);
    if (!step) return 0;
    const n = assignElvesToStep(state, elfTypeId, stepId, slots, count);
    if (n <= 0) return 0;

    const name = getElfType(elfTypeId)?.name ?? "elf";
    const slotNames = slots.map((s) => getShiftSlot(s)?.name ?? s).join(", ");
    state.meta.statusText = `Scheduled ${n} ${pluralizeElves(n)} (${name}) on ${step.name} (${slotNames}).`;
    return n;
  }

  /** Send a batch of elves home (spent until tomorrow). */
  function removeElves(state: GameState, ids: number[]): number {
    const n = removeElvesFromState(state, ids);
    if (n > 0) state.meta.statusText = `Sent ${n} ${pluralizeElves(n)} home — idle until tomorrow.`;
    return n;
  }

  function getView(state: GameState, mods: Modifiers): PipelineView {
    const slot = currentShiftSlot(state.time.dayProgress);
    const steps: StepProgress[] = pipelineSteps.map((step) => {
      const elvesAssigned = activeOnStep(state, step.id, slot);
      const broken = isStationBroken(state, step.id);
      const progress = elvesAssigned > 0 && !broken ? (progressAccum[step.id] ?? 0) : 0;

      return {
        stepId: step.id,
        progress: Math.min(1, progress),
        elvesAssigned,
        outputPerSecond: getStepOutputPerSecond(state, step, mods),
        mistakeChance: slotMistakeChance(state, step.id, slot),
        broken,
        isBottlenecked: !broken && !hasInput(state, step) && elvesAssigned > 0,
      };
    });

    return { activeSlot: slot, steps };
  }

  return {
    update,
    assignElves,
    removeElves,
    repairStation,
    getView,
    getStepOutputPerSecond,
  };
}

export type PipelineSystem = ReturnType<typeof createPipelineSystem>;
