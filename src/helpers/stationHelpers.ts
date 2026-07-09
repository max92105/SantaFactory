/**
 * Station (pipeline step) breakdown helpers — the ONLY place that touches
 * state.stations. A broken station halts until repaired (see PipelineSystem).
 */

import type { GameState } from "../state/GameState";

export function isStationBroken(state: GameState, stepId: string): boolean {
  return state.stations[stepId]?.broken === true;
}

export function setStationBroken(state: GameState, stepId: string, broken: boolean): void {
  (state.stations[stepId] ??= { broken: false }).broken = broken;
}

export function brokenStepIds(state: GameState): string[] {
  return Object.keys(state.stations).filter((id) => state.stations[id].broken);
}

export function brokenStationCount(state: GameState): number {
  return brokenStepIds(state).length;
}
