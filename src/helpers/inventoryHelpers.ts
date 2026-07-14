/**
 * Inventory access helpers — the ONLY place that touches state.inventory.
 * Keeps stage math and lifetime/day counters consistent everywhere.
 */

import type { GameState, ToyInventory } from "../state/GameState";
import type { ProductionStage } from "../config/pipelineConfig";

/** Get a toy's inventory, creating an empty one if the toy is new. */
export function ensureInventory(state: GameState, toyType: string): ToyInventory {
  if (!state.inventory[toyType]) {
    state.inventory[toyType] = { parts: 0, raw: 0, assembled: 0, finished: 0, broken: 0 };
  }
  // Backfill fields added after a save was written (e.g. `broken`, `parts`)
  const inv = state.inventory[toyType];
  if (typeof inv.broken !== "number") inv.broken = 0;
  if (typeof inv.parts !== "number") inv.parts = 0;
  return inv;
}

/** Record a ruined item for a toy type (kept in the broken tally). */
export function addBroken(state: GameState, toyType: string, amount: number): void {
  ensureInventory(state, toyType).broken += amount;
}

/** Whole broken items of a toy type available to salvage or refurbish. */
export function getBrokenStock(state: GameState, toyType: string): number {
  return Math.max(0, Math.floor(ensureInventory(state, toyType).broken));
}

/** Remove broken items of a toy type. Returns false if there aren't enough. */
export function removeBroken(state: GameState, toyType: string, amount: number): boolean {
  const inv = ensureInventory(state, toyType);
  if (inv.broken < amount) return false;
  inv.broken -= amount;
  return true;
}

/** Total broken items held across all toy types. */
export function getTotalBroken(state: GameState): number {
  let total = 0;
  for (const inv of Object.values(state.inventory)) {
    total += inv.broken ?? 0;
  }
  return total;
}

export function getStageCount(state: GameState, toyType: string, stage: ProductionStage): number {
  return ensureInventory(state, toyType)[stage];
}

/** Add items to a stage. Adding to "finished" also counts toward lifetime/day gift totals. */
export function addToStage(state: GameState, toyType: string, stage: ProductionStage, amount: number): void {
  const inv = ensureInventory(state, toyType);
  inv[stage] += amount;
  if (stage === "finished") {
    state.resources.lifetimeGifts += amount;
    state.dayStats.giftsMade += amount;
  }
}

/** Remove items from a stage. Returns false (and removes nothing) if there aren't enough. */
export function removeFromStage(state: GameState, toyType: string, stage: ProductionStage, amount: number): boolean {
  const inv = ensureInventory(state, toyType);
  if (inv[stage] < amount) return false;
  inv[stage] -= amount;
  return true;
}

/** Total finished gifts across all toy types (the HUD "Gifts" number). */
export function getTotalFinished(state: GameState): number {
  let total = 0;
  for (const inv of Object.values(state.inventory)) {
    total += inv.finished;
  }
  return total;
}

/** How many finished units of a toy can actually be sold (whole items only). */
export function getSellableStock(state: GameState, toyType: string): number {
  return Math.max(0, Math.floor(ensureInventory(state, toyType).finished));
}
