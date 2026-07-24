/**
 * PipelineSystem — automatic multi-step production driven by scheduled elves.
 * Items flow raw → assembled → finished through the steps in config/pipelineConfig.ts.
 *
 * Production is per shift slot: only elves scheduled for the CURRENT slot
 * (config/shiftsConfig.ts, derived from the day clock) work a step. Every
 * finished item can be ruined (weighted mistakeChance of that slot's elves) or
 * break the station (weighted breakChance). Broken stations halt until repaired.
 */

import type { GameState, QueueMode, QueueSetting } from "../state/GameState";
import {
  addToStage,
  getStageCount,
  removeFromStage,
  addBroken,
  getBrokenStock,
  removeBroken,
} from "../helpers/inventoryHelpers";
import { pipelineSteps, type PipelineStepDef, type ProductionStage } from "../config/pipelineConfig";
import { toyTypes, toyCategoryId, type ToyTypeDef } from "../config/toyTypesConfig";
import { currentShiftSlot } from "../config/shiftsConfig";
import { isToyUnlocked } from "../helpers/unlockHelpers";
import {
  assignElves as assignElvesToStep,
  removeElves as removeElvesFromState,
  activeOnStep,
  activeProducersOnStep,
  stepCrewSpeedMult,
  activeMechanics,
  activeMenders,
  slotMistakeChance,
  slotBreakChance,
} from "../helpers/workforceHelpers";
import { isStationBroken, setStationBroken, brokenStepIds } from "../helpers/stationHelpers";
import { MAINTENANCE_STEP, REPAIR_STEP } from "../config/stationsConfig";
import { getElfType } from "../config/elfTypesConfig";
import { t } from "../ui/i18n/i18n";
import { stepName, elfName, slotName } from "../ui/i18n/localize";
import { isNotifyEnabled } from "../ui/settings";
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
  /** Auto-repair progress per broken station, 0..1 (not saved). */
  const repairProgress: Record<string, number> = {};
  /** Refurbish progress per toy type (broken→finished), 0..1 (not saved). */
  const refurbishAccum: Record<string, number> = {};
  /** Round-robin cursor per shared step for "balanced" mode (not saved). */
  const rrCursor: Record<string, number> = {};

  /**
   * The toys a SHARED step may process: a specialist station handles only its
   * own category's toys (crucial — Tuning and Connect both consume `wip1`, so
   * Tuning must not grab an Electronics toy waiting to be connected); QC and
   * Packaging handle every toy.
   */
  function stepToys(step: PipelineStepDef): ToyTypeDef[] {
    if (!step.categoryId) return toyTypes;
    return toyTypes.filter((t) => toyCategoryId(t) === step.categoryId);
  }

  function hasInput(state: GameState, step: PipelineStepDef): boolean {
    if (!step.inputStage) return true; // creates from nothing
    if (step.toyType) return getStageCount(state, step.toyType, step.inputStage) >= 1;
    return stepToys(step).some((t) => getStageCount(state, t.id, step.inputStage!) >= 1);
  }

  /** "order" mode: first toy (config order) with input available. */
  function pickInOrder(state: GameState, step: PipelineStepDef, inputStage: ProductionStage): string | null {
    for (const t of stepToys(step)) {
      if (getStageCount(state, t.id, inputStage) >= 1) return t.id;
    }
    return null;
  }

  /** "balanced" mode: next toy with input, rotating so all queues advance. */
  function pickBalanced(state: GameState, step: PipelineStepDef, inputStage: ProductionStage): string | null {
    const toys = stepToys(step);
    const n = toys.length;
    const start = rrCursor[step.id] ?? 0;
    for (let i = 0; i < n; i++) {
      const idx = (start + i) % n;
      const t = toys[idx];
      if (getStageCount(state, t.id, inputStage) >= 1) {
        rrCursor[step.id] = (idx + 1) % n; // resume after this toy next time
        return t.id;
      }
    }
    return null;
  }

  /** Pick which toy a SHARED step works next, per its queue mode. */
  function pickTargetType(state: GameState, step: PipelineStepDef, inputStage: ProductionStage): string | null {
    const setting = getQueueMode(state, step.id);
    if (setting.mode === "balanced") return pickBalanced(state, step, inputStage);
    // "focus" only applies when the focused toy belongs to this step's toys.
    if (
      setting.mode === "focus" &&
      setting.focus &&
      stepToys(step).some((t) => t.id === setting.focus) &&
      getStageCount(state, setting.focus, inputStage) >= 1
    ) {
      return setting.focus; // focused toy first; falls through to order when empty
    }
    return pickInOrder(state, step, inputStage);
  }

  function getStepOutputPerSecond(state: GameState, step: PipelineStepDef, mods: Modifiers): number {
    if (isStationBroken(state, step.id)) return 0;
    const slot = currentShiftSlot(state.time.dayProgress);
    // Managers don't build — they multiply the speed of those who do.
    const producers = activeProducersOnStep(state, step.id, slot).length;
    if (producers <= 0) return 0;
    const effectiveTime = step.baseTime / (mods.producerSpeedMult * stepCrewSpeedMult(state, step.id, slot));
    const successRate = 1 - Math.min(1, slotMistakeChance(state, step.id, slot) * mods.mistakeMult);
    return (producers / effectiveTime) * mods.producerOutputMult * successRate;
  }

  function update(state: GameState, mods: Modifiers, dtSeconds: number): void {
    if (state.meta.isRunOver || state.meta.isPaused) return;

    const slot = currentShiftSlot(state.time.dayProgress);

    for (const step of pipelineSteps) {
      if (step.toyType && !isToyUnlocked(state, step.toyType)) continue;
      if (isStationBroken(state, step.id)) continue;

      const producers = activeProducersOnStep(state, step.id, slot).length;
      if (producers <= 0) continue;
      if (!hasInput(state, step)) continue;

      const effectiveTime = step.baseTime / (mods.producerSpeedMult * stepCrewSpeedMult(state, step.id, slot));
      const rawProduction = (producers / effectiveTime) * dtSeconds * mods.producerOutputMult;

      progressAccum[step.id] = (progressAccum[step.id] ?? 0) + rawProduction;

      const mistakeChance = Math.min(1, slotMistakeChance(state, step.id, slot) * mods.mistakeMult);
      const breakChance = slotBreakChance(state, step.id, slot);

      while (progressAccum[step.id] >= 1) {
        // Elf mistake breaks the station? Halt it and alert the player.
        if (Math.random() < breakChance) {
          setStationBroken(state, step.id, true);
          progressAccum[step.id] = 0;
          repairProgress[step.id] = 0;
          // The factory badge + broken banner already flag this; the toast is
          // the noisy part players can mute (☰ menu → Notifications).
          if (isNotifyEnabled("stationBroke")) {
            state.pendingAlerts.push(t("sys.stationBroke", { name: stepName(step.id) }));
          }
          break;
        }

        let targetType: string | null = null;
        if (step.toyType) {
          if (step.inputStage && getStageCount(state, step.toyType, step.inputStage) < 1) break;
          targetType = step.toyType;
        } else {
          if (!step.inputStage) break;
          targetType = pickTargetType(state, step, step.inputStage);
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

    autoRepair(state, slot, dtSeconds);
    autoRefurbish(state, slot, dtSeconds);
  }

  /**
   * Menders on the Repair Bench turn broken toys back into finished ones over
   * time. They spread across toys with breakage (round-robin); each contributes
   * 1/refurbishTime per second. A toy is mended when its progress reaches 1.
   */
  function autoRefurbish(state: GameState, slot: string, dtSeconds: number): void {
    const menders = activeMenders(state, slot);
    if (menders.length === 0) return;

    const brokenToys = toyTypes.filter((t) => getBrokenStock(state, t.id) >= 1).map((t) => t.id);
    if (brokenToys.length === 0) return;

    // Same queue modes as Quality Control/Packaging, but over the broken piles:
    //  order    → all menders pile on the first broken toy (config order),
    //  balanced → spread round-robin so every pile shrinks together,
    //  focus    → the chosen toy first, falling back to order when it's clear.
    const setting = getQueueMode(state, REPAIR_STEP);
    const focusHasBroken = setting.mode === "focus" && !!setting.focus && brokenToys.includes(setting.focus);

    for (let i = 0; i < menders.length; i++) {
      const target =
        setting.mode === "balanced"
          ? brokenToys[i % brokenToys.length]
          : focusHasBroken
          ? setting.focus!
          : brokenToys[0];
      const rt = getElfType(menders[i].type)?.refurbishTime ?? 0;
      if (rt > 0) refurbishAccum[target] = (refurbishAccum[target] ?? 0) + dtSeconds / rt;
    }

    for (const toyId of brokenToys) {
      let acc = refurbishAccum[toyId] ?? 0;
      while (acc >= 1 && getBrokenStock(state, toyId) >= 1) {
        removeBroken(state, toyId, 1);
        addToStage(state, toyId, "finished", 1); // recovered as a finished gift
        acc -= 1;
      }
      refurbishAccum[toyId] = acc;
    }
  }

  /** Refurbish progress (0..1) toward the next mended toy of a type — for UI. */
  function refurbishProgressOf(toyType: string): number {
    return Math.min(1, refurbishAccum[toyType] ?? 0);
  }

  /**
   * Mechanics on the Maintenance shift auto-repair broken stations over time.
   * They spread across broken stations (round-robin); each contributes
   * 1/repairTime per second. A station is fixed when its progress reaches 1.
   */
  function autoRepair(state: GameState, slot: string, dtSeconds: number): void {
    const broken = brokenStepIds(state);
    if (broken.length === 0) return;

    const mechanics = activeMechanics(state, slot);
    for (let i = 0; i < mechanics.length; i++) {
      const target = broken[i % broken.length];
      const rt = getElfType(mechanics[i].type)?.repairTime ?? 0;
      if (rt > 0) repairProgress[target] = (repairProgress[target] ?? 0) + dtSeconds / rt;
    }

    for (const stepId of broken) {
      if ((repairProgress[stepId] ?? 0) >= 1) {
        setStationBroken(state, stepId, false);
        repairProgress[stepId] = 0;
        state.meta.statusText = t("sys.mechRepaired", { name: stepName(stepId) });
      }
    }
  }

  /** Auto-repair progress (0..1) for a broken station — for the Maintenance UI. */
  function repairProgressOf(stepId: string): number {
    return Math.min(1, repairProgress[stepId] ?? 0);
  }

  /** Read a shared step's queue mode (defaults to "order"). */
  function getQueueMode(state: GameState, stepId: string): QueueSetting {
    return state.pipeline?.queueModes?.[stepId] ?? { mode: "order" };
  }

  /** Set a shared step's queue mode (and focused toy for "focus"). */
  function setQueueMode(state: GameState, stepId: string, mode: QueueMode, focus?: string): void {
    if (!state.pipeline) state.pipeline = { queueModes: {} };
    state.pipeline.queueModes[stepId] = mode === "focus" ? { mode, focus } : { mode };
    const modeLabel =
      mode === "focus" ? t("factory.queueFocus") : mode === "balanced" ? t("factory.queueBalanced") : t("factory.queueOrder");
    state.meta.statusText = t("sys.queueSet", { name: stepName(stepId), mode: modeLabel });
  }

  /** Repair a broken station (free — the player holds the repair button, or a
   *  mechanic finishes an auto-repair). Returns false if it wasn't broken. */
  function repairStation(state: GameState, stepId: string): boolean {
    if (!isStationBroken(state, stepId)) return false;
    setStationBroken(state, stepId, false);
    repairProgress[stepId] = 0;
    state.meta.statusText = t("sys.repaired", { name: stepName(stepId) });
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
    if (!step && stepId !== MAINTENANCE_STEP && stepId !== REPAIR_STEP) return 0;
    const n = assignElvesToStep(state, elfTypeId, stepId, slots, count);
    if (n <= 0) return 0;

    const where = step
      ? stepName(step.id)
      : stepId === REPAIR_STEP
      ? t("factory.repairBench")
      : t("factory.maintenance");
    const slotNames = slots.map((s) => slotName(s)).join(", ");
    state.meta.statusText = t("sys.scheduled", { n, name: elfName(elfTypeId), where, slots: slotNames });
    return n;
  }

  /** Send a batch of elves home (spent until tomorrow). */
  function removeElves(state: GameState, ids: number[]): number {
    const n = removeElvesFromState(state, ids);
    if (n > 0) state.meta.statusText = t("sys.sentHome", { n });
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
    repairProgressOf,
    refurbishProgressOf,
    getQueueMode,
    setQueueMode,
    getView,
    getStepOutputPerSecond,
  };
}

export type PipelineSystem = ReturnType<typeof createPipelineSystem>;
