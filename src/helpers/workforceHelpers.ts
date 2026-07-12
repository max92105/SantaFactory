/**
 * Workforce access helpers — the ONLY place that touches state.workforce.
 *
 * Elves are tracked individually (state.workforce.elves). An elf is the unit of
 * assignment: scheduling it commits ONE elf to ONE step, covering a fixed set of
 * shift slots chosen at assignment. Pulling it clears its whole schedule and
 * marks it spent (idle only from tomorrow). So an elf's shifts move together,
 * and reshuffling has a cost.
 */

import type { GameState, ElfInstance } from "../state/GameState";
import { elfTypes, getElfType, type ElfTypeDef } from "../config/elfTypesConfig";
import { shiftSlots, NIGHT_SLOT } from "../config/shiftsConfig";

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

/** Elves working a step during a specific slot. */
export function activeElvesOnStep(state: GameState, stepId: string, slotId: string): ElfInstance[] {
  return state.workforce.elves.filter((e) => e.step === stepId && e.slots.includes(slotId));
}

export function activeOnStep(state: GameState, stepId: string, slotId: string): number {
  return activeElvesOnStep(state, stepId, slotId).length;
}

/** Total elves on shift across all steps during a slot. */
export function onShiftCount(state: GameState, slotId: string): number {
  return state.workforce.elves.reduce(
    (n, e) => n + (e.step !== null && e.slots.includes(slotId) ? 1 : 0),
    0
  );
}

// ── Shift eligibility ─────────────────────────────────────────────────────
export function canWorkSlot(typeId: string, slotId: string): boolean {
  if (slotId !== NIGHT_SLOT) return true;
  return getElfType(typeId)?.canWorkNight !== false;
}

/** Slots an elf type is allowed to work at all (drunken skips night). */
export function allowedSlots(typeId: string): string[] {
  return shiftSlots.filter((s) => canWorkSlot(typeId, s.id)).map((s) => s.id);
}

/** How many shift slots one elf of this type works (capped by allowed slots). */
export function requiredShifts(typeId: string): number {
  const max = getElfType(typeId)?.maxShifts ?? 0;
  return Math.min(max, allowedSlots(typeId).length);
}

// ── Mutations ──────────────────────────────────────────────────────────────
export function addElf(state: GameState, typeId: string): ElfInstance {
  const elf: ElfInstance = { id: state.workforce.nextId++, type: typeId, step: null, slots: [], spent: false };
  state.workforce.elves.push(elf);
  return elf;
}

/**
 * Schedule one idle elf of a type onto a step, covering `slots`. Returns the
 * assigned elf, or null if none idle. `slots` should be a valid selection
 * (respecting allowedSlots / requiredShifts — the UI enforces this).
 */
export function assignElf(state: GameState, typeId: string, stepId: string, slots: string[]): ElfInstance | null {
  const valid = slots.filter((s) => canWorkSlot(typeId, s));
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

// ── Per-slot mistake / break chance (weighted by elves working that slot) ──
function weightedChance(
  state: GameState,
  stepId: string,
  slotId: string,
  pick: (def: ElfTypeDef) => number
): number {
  const on = activeElvesOnStep(state, stepId, slotId);
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
