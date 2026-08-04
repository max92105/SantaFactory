/**
 * Workforce access helpers — the ONLY place that touches state.workforce.
 *
 * Elves are tracked individually (state.workforce.elves). An elf is the unit of
 * assignment: scheduling it commits ONE elf to ONE step, covering a fixed set of
 * shift slots chosen at assignment. Pulling it clears its whole schedule and
 * marks it spent (idle only from tomorrow). So an elf's shifts move together,
 * and reshuffling has a cost.
 *
 * The RULES about who may work where live in helpers/elfRules.ts (pure, no
 * state). This file supplies the roster lookups those rules need and re-exports
 * them, so callers have one import and there's no cycle.
 */

import type { GameState, ElfInstance } from "../state/GameState";
import { elfTypes, getElfType, type ElfTypeDef } from "../config/elfTypesConfig";
import { shiftSlots } from "../config/shiftsConfig";
import { MAINTENANCE_STEP, REPAIR_STEP } from "../config/stationsConfig";
import { canElfTypeWorkStep, slotRestrictionFor, type SlotRestriction } from "./elfRules";

// Rule helpers are re-exported so existing call sites keep one import path.
export {
  elfRules,
  stepRole,
  stepRequiredSpecialty,
  canElfTypeWorkStep,
  canWorkSlot,
  allowedSlots,
  requiredShifts,
  type ElfRule,
  type ElfRuleKind,
  type ElfRuleTone,
  type SlotRestriction,
} from "./elfRules";

// ── Reads ────────────────────────────────────────────────────────────────
export function allElves(state: GameState): ElfInstance[] {
  return state.workforce.elves;
}

export function totalElves(state: GameState): number {
  return state.workforce.elves.length;
}

export function countOfType(state: GameState, typeId: string): number {
  return state.workforce.elves.reduce((n, e) => n + (e.type === typeId ? 1 : 0), 0);
}

export function ownedElfTypes(state: GameState): ElfTypeDef[] {
  return elfTypes.filter((t) => countOfType(state, t.id) > 0);
}

export function isIdle(elf: ElfInstance): boolean {
  return elf.step === null && !elf.spent;
}

export function idleOfType(state: GameState, typeId: string): number {
  return state.workforce.elves.reduce((n, e) => n + (e.type === typeId && isIdle(e) ? 1 : 0), 0);
}

export function totalIdle(state: GameState): number {
  return state.workforce.elves.reduce((n, e) => n + (isIdle(e) ? 1 : 0), 0);
}

export function spentCount(state: GameState): number {
  return state.workforce.elves.reduce((n, e) => n + (e.spent ? 1 : 0), 0);
}

/** Elves currently scheduled on a step (any slot). */
export function elvesOnStep(state: GameState, stepId: string): ElfInstance[] {
  return state.workforce.elves.filter((e) => e.step === stepId);
}

export function scheduledOnStep(state: GameState, stepId: string): number {
  return elvesOnStep(state, stepId).length;
}

/** Elves working a step during a specific slot (day-off elves don't work). */
export function activeElvesOnStep(state: GameState, stepId: string, slotId: string): ElfInstance[] {
  return state.workforce.elves.filter((e) => e.step === stepId && e.slots.includes(slotId) && !e.dayOff);
}

export function activeOnStep(state: GameState, stepId: string, slotId: string): number {
  return activeElvesOnStep(state, stepId, slotId).length;
}

/**
 * Elves actually PRODUCING on a step this slot — managers are excluded (they
 * boost the crew but build nothing themselves).
 */
export function activeProducersOnStep(state: GameState, stepId: string, slotId: string): ElfInstance[] {
  return activeElvesOnStep(state, stepId, slotId).filter((e) => !getElfType(e.type)?.managerMult);
}

/** Crew speed multiplier from a manager on this station+shift (1 = none). */
export function stepCrewSpeedMult(state: GameState, stepId: string, slotId: string): number {
  for (const e of activeElvesOnStep(state, stepId, slotId)) {
    const mult = getElfType(e.type)?.managerMult;
    if (mult) return mult; // only one manager per station+shift can exist
  }
  return 1;
}

/** Total elves on shift across all steps during a slot. */
export function onShiftCount(state: GameState, slotId: string): number {
  return state.workforce.elves.reduce(
    (n, e) => n + (e.step !== null && e.slots.includes(slotId) && !e.dayOff ? 1 : 0),
    0
  );
}

/** Mechanics scheduled to Maintenance and working this slot (auto-repair crew). */
export function activeMechanics(state: GameState, slotId: string): ElfInstance[] {
  return state.workforce.elves.filter(
    (e) =>
      e.step === MAINTENANCE_STEP &&
      e.slots.includes(slotId) &&
      !e.dayOff &&
      getElfType(e.type)?.role === "mechanic"
  );
}

/** Menders scheduled to the Repair Bench and working this slot (refurbish crew). */
export function activeMenders(state: GameState, slotId: string): ElfInstance[] {
  return state.workforce.elves.filter(
    (e) =>
      e.step === REPAIR_STEP &&
      e.slots.includes(slotId) &&
      !e.dayOff &&
      getElfType(e.type)?.role === "mender"
  );
}

// ── Step / shift eligibility (rules live in elfRules.ts) ──────────────────
/** Owned elf types that are allowed to staff this step (by role + specialty). */
export function eligibleElfTypesForStep(state: GameState, stepId: string): ElfTypeDef[] {
  return ownedElfTypes(state).filter((d) => canElfTypeWorkStep(d, stepId));
}

/** Elf types scheduled on a station during a slot — the crew a rule looks at. */
function crewTypesOnSlot(state: GameState, stepId: string, slotId: string): string[] {
  return elvesOnStep(state, stepId)
    .filter((e) => e.slots.includes(slotId))
    .map((e) => e.type);
}

/** Why can't this elf type take this slot on this step? (null = it can.)
 *  The rule itself is elfRules.slotRestrictionFor — this just feeds it the crew. */
export function slotRestriction(
  state: GameState,
  typeId: string,
  stepId: string,
  slotId: string
): SlotRestriction | null {
  return slotRestrictionFor(typeId, slotId, crewTypesOnSlot(state, stepId, slotId));
}

/** Per-slot availability for a type on a station — what the assign UI renders.
 *  One call gives every slot's verdict, so no screen re-derives the rules. */
export type SlotAvailability = { slotId: string; restriction: SlotRestriction | null };

export function slotAvailability(state: GameState, typeId: string, stepId: string): SlotAvailability[] {
  return shiftSlots.map((s) => ({ slotId: s.id, restriction: slotRestriction(state, typeId, stepId, s.id) }));
}

/** Slots this type could actually take on this station right now. */
export function openSlotsFor(state: GameState, typeId: string, stepId: string): string[] {
  return slotAvailability(state, typeId, stepId)
    .filter((a) => a.restriction === null)
    .map((a) => a.slotId);
}

/**
 * A new morning: every elf with a dayOffChance rolls whether they show up.
 * Day-off elves KEEP their schedule — they just don't work until tomorrow.
 * Returns how many are off today (for the morning alert).
 */
export function rollDayOffs(state: GameState): number {
  let off = 0;
  for (const e of state.workforce.elves) {
    const chance = getElfType(e.type)?.dayOffChance ?? 0;
    e.dayOff = chance > 0 && Math.random() < chance;
    if (e.dayOff) off += 1;
  }
  return off;
}

// ── Mutations ──────────────────────────────────────────────────────────────
export function addElf(state: GameState, typeId: string): ElfInstance {
  const elf: ElfInstance = { id: state.workforce.nextId++, type: typeId, step: null, slots: [], spent: false };
  state.workforce.elves.push(elf);
  return elf;
}

/**
 * Schedule one idle elf of a type onto a step, covering `slots`. Returns the
 * assigned elf, or null if none idle. Slots that violate a restriction
 * (blocked shift, manager already there, shy/non-shy mixing) are dropped —
 * the UI surfaces these same rules up front via slotRestriction.
 */
export function assignElf(state: GameState, typeId: string, stepId: string, slots: string[]): ElfInstance | null {
  if (!canElfTypeWorkStep(getElfType(typeId), stepId)) return null; // wrong role/specialty for this station
  const valid = slots.filter((s) => slotRestriction(state, typeId, stepId, s) === null);
  if (valid.length === 0) return null;
  const elf = state.workforce.elves.find((e) => e.type === typeId && isIdle(e));
  if (!elf) return null;
  elf.step = stepId;
  elf.slots = [...new Set(valid)];
  return elf;
}

/** Assign up to `count` idle elves of a type to a step with the same slots. */
export function assignElves(
  state: GameState,
  typeId: string,
  stepId: string,
  slots: string[],
  count: number
): number {
  let done = 0;
  for (let i = 0; i < count; i++) {
    if (assignElf(state, typeId, stepId, slots)) done += 1;
    else break;
  }
  return done;
}

/** Pull an elf off its shifts. It loses its whole schedule and is spent today. */
export function removeElfById(state: GameState, id: number): ElfInstance | null {
  const elf = state.workforce.elves.find((e) => e.id === id);
  if (!elf || elf.step === null) return null;
  elf.step = null;
  elf.slots = [];
  elf.spent = true;
  return elf;
}

/** Send a batch of elves home by id. Returns how many were removed. */
export function removeElves(state: GameState, ids: number[]): number {
  let done = 0;
  for (const id of ids) if (removeElfById(state, id)) done += 1;
  return done;
}

/** A set of elves on one line that share the exact same schedule (type + slots). */
export type CrewGroup = { type: string; slots: string[]; ids: number[] };

function slotOrder(slotId: string): number {
  const i = shiftSlots.findIndex((s) => s.id === slotId);
  return i < 0 ? 99 : i;
}

/**
 * The station's roster as a type × slot matrix — what the Manage Crew window
 * renders. One row per elf type present, `perSlot` counting how many of that
 * type work each shift. Rows keep config order so the table is stable.
 */
export type CrewRow = {
  type: string;
  /** Every elf of this type on the station (across all slots). */
  total: number;
  /** How many of them are off sick today (dayOff). */
  dayOff: number;
  /** slotId → how many of this type cover that slot. */
  perSlot: Record<string, number>;
};

export function crewMatrix(state: GameState, stepId: string): CrewRow[] {
  const rows = new Map<string, CrewRow>();
  for (const e of elvesOnStep(state, stepId)) {
    let row = rows.get(e.type);
    if (!row) {
      row = { type: e.type, total: 0, dayOff: 0, perSlot: {} };
      for (const s of shiftSlots) row.perSlot[s.id] = 0;
      rows.set(e.type, row);
    }
    row.total += 1;
    if (e.dayOff) row.dayOff += 1;
    for (const slotId of e.slots) {
      if (slotId in row.perSlot) row.perSlot[slotId] += 1;
    }
  }
  // Config order keeps the table from reshuffling as crews change.
  return elfTypes.filter((d) => rows.has(d.id)).map((d) => rows.get(d.id)!);
}

/** How many elves of a type are on a station covering a given slot. */
export function countOnStepSlot(state: GameState, stepId: string, typeId: string, slotId: string): number {
  return elvesOnStep(state, stepId).reduce(
    (n, e) => n + (e.type === typeId && e.slots.includes(slotId) ? 1 : 0),
    0
  );
}

/** Ids of elves of a type on a station covering a slot — for targeted removal. */
export function elfIdsOnStepSlot(state: GameState, stepId: string, typeId: string, slotId: string): number[] {
  return elvesOnStep(state, stepId)
    .filter((e) => e.type === typeId && e.slots.includes(slotId))
    .map((e) => e.id);
}

/** Elves sent home today, by type — "at home, back tomorrow". */
export function spentOfType(state: GameState, typeId: string): number {
  return state.workforce.elves.reduce((n, e) => n + (e.type === typeId && e.spent ? 1 : 0), 0);
}

/** Total elves covering a slot on ONE station (all types). */
export function stepSlotCoverage(state: GameState, stepId: string, slotId: string): number {
  return elvesOnStep(state, stepId).reduce((n, e) => n + (e.slots.includes(slotId) ? 1 : 0), 0);
}

/** Crew on a step grouped by identical schedule (type + slot set) — for batch UI. */
export function crewGroups(state: GameState, stepId: string): CrewGroup[] {
  const map = new Map<string, CrewGroup>();
  for (const e of elvesOnStep(state, stepId)) {
    const slots = [...e.slots].sort((a, b) => slotOrder(a) - slotOrder(b));
    const key = `${e.type}|${slots.join(",")}`;
    let g = map.get(key);
    if (!g) {
      g = { type: e.type, slots, ids: [] };
      map.set(key, g);
    }
    g.ids.push(e.id);
  }
  return [...map.values()];
}

/** A new day: spent elves are available again. */
export function resetSpentShifts(state: GameState): void {
  for (const e of state.workforce.elves) e.spent = false;
}

/** Remove one elf of a type entirely (payroll penalty — they quit). */
export function removeOneOfType(state: GameState, typeId: string): boolean {
  const i = state.workforce.elves.findIndex((e) => e.type === typeId);
  if (i < 0) return false;
  state.workforce.elves.splice(i, 1);
  return true;
}

// ── Per-slot mistake / break chance (weighted by PRODUCING elves that slot —
//    managers oversee, they don't touch the toys) ──────────────────────────
function weightedChance(
  state: GameState,
  stepId: string,
  slotId: string,
  pick: (def: ElfTypeDef) => number
): number {
  const on = activeProducersOnStep(state, stepId, slotId);
  if (on.length === 0) return 0;
  let sum = 0;
  for (const e of on) sum += pick(getElfType(e.type) ?? ({} as ElfTypeDef));
  return sum / on.length;
}

export function slotMistakeChance(state: GameState, stepId: string, slotId: string): number {
  return weightedChance(state, stepId, slotId, (d) => d.mistakeChance ?? 0);
}

export function slotBreakChance(state: GameState, stepId: string, slotId: string): number {
  return weightedChance(state, stepId, slotId, (d) => d.breakChance ?? 0);
}
