/**
 * GrinchSystem — an occasional villain heist.
 *
 * On a day change (when nothing else has the game paused) the Grinch may show
 * up with a live countdown: pay his toll, or hand over his toy demand, before
 * time runs out — otherwise he steals a chunk of your finished stock. Runs in
 * real time (update ticks each frame) and is non-blocking, so you can scramble
 * to sell, produce, or pay.
 *
 * Tuning + taunts: config/grinchConfig.ts
 */

import type { GameState } from "../state/GameState";
import {
  GRINCH_MIN_GAP_DAYS,
  GRINCH_DAILY_CHANCE,
  GRINCH_SECONDS_MIN,
  GRINCH_SECONDS_MAX,
  GRINCH_STEAL_MIN,
  GRINCH_STEAL_MAX,
  GRINCH_TOLL_FACTOR,
  GRINCH_TOLL_FLOOR,
  GRINCH_DEMAND_MIN,
  GRINCH_DEMAND_MAX,
  grinchTaunts,
  grinchStealTaunts,
  grinchFoiledTaunts,
} from "../config/grinchConfig";
import { getToyType } from "../config/toyTypesConfig";
import { getUnlockedToyTypes } from "../helpers/unlockHelpers";
import { ensureInventory, getSellableStock, removeFromStage } from "../helpers/inventoryHelpers";
import { pluralize } from "../helpers/textHelpers";

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

export function createGrinchSystem() {
  /** Value of all finished stock at base sell prices (used to size the toll). */
  function finishedStockValue(state: GameState): number {
    let total = 0;
    for (const t of getUnlockedToyTypes(state)) {
      total += getSellableStock(state, t.id) * (getToyType(t.id)?.baseSellValue ?? 1);
    }
    return total;
  }

  /** On a day change: maybe start a heist. Returns true if one started. */
  function maybeTrigger(state: GameState): boolean {
    if (state.grinch.active) return false;
    state.grinch.daysSince += 1;
    if (state.grinch.daysSince < GRINCH_MIN_GAP_DAYS) return false;
    if (Math.random() >= GRINCH_DAILY_CHANCE) return false;

    const toys = getUnlockedToyTypes(state);
    if (toys.length === 0) return false;

    const stealPct = randRange(GRINCH_STEAL_MIN, GRINCH_STEAL_MAX);
    const toll = Math.max(GRINCH_TOLL_FLOOR, Math.round(finishedStockValue(state) * stealPct * GRINCH_TOLL_FACTOR));
    const demandToy = pick(toys).id;

    state.grinch.active = {
      toll,
      demandToy,
      demandQty: randInt(GRINCH_DEMAND_MIN, GRINCH_DEMAND_MAX),
      demandDelivered: 0,
      stealPct,
      secondsLeft: randInt(GRINCH_SECONDS_MIN, GRINCH_SECONDS_MAX),
      taunt: pick(grinchTaunts),
    };
    state.grinch.daysSince = 0;

    state.pendingAlerts.push(`😈 The Grinch is here! ${state.grinch.active.taunt}`);
    state.meta.statusText = "😈 The Grinch is shaking you down — pay up or hand over toys!";
    return true;
  }

  /** Real-time tick; on timeout he steals. Returns true if the threat changed. */
  function update(state: GameState, dt: number): boolean {
    const g = state.grinch.active;
    if (!g) return false;

    g.secondsLeft -= dt;
    if (g.secondsLeft > 0) return false;

    let stolen = 0;
    for (const t of getUnlockedToyTypes(state)) {
      const inv = ensureInventory(state, t.id);
      const take = Math.floor(inv.finished * g.stealPct);
      inv.finished -= take;
      stolen += take;
    }
    state.grinch.active = null;
    state.pendingAlerts.push(`😈 ${pick(grinchStealTaunts)} (−${stolen} gifts)`);
    state.meta.statusText = `The Grinch ran off with ${stolen} ${pluralize(stolen, "gift")}!`;
    return true;
  }

  /** Pay the toll to be rid of him. */
  function payToll(state: GameState): boolean {
    const g = state.grinch.active;
    if (!g) return false;
    if (state.resources.money < g.toll) {
      state.meta.statusText = `Not enough to pay the Grinch's $${g.toll} toll.`;
      return false;
    }
    state.resources.money -= g.toll;
    state.grinch.active = null;
    state.pendingAlerts.push(`💸 ${pick(grinchFoiledTaunts)}`);
    state.meta.statusText = `Paid the Grinch $${g.toll} to shove off.`;
    return true;
  }

  /** Hand over as much of his demanded toy as you have; foils him when met. */
  function deliverDemand(state: GameState): boolean {
    const g = state.grinch.active;
    if (!g) return false;

    const name = getToyType(g.demandToy)?.name ?? "toy";
    const need = g.demandQty - g.demandDelivered;
    const give = Math.min(need, getSellableStock(state, g.demandToy));
    if (give <= 0) {
      state.meta.statusText = `No finished ${name} in stock for the Grinch.`;
      return false;
    }

    removeFromStage(state, g.demandToy, "finished", give);
    g.demandDelivered += give;

    if (g.demandDelivered >= g.demandQty) {
      state.grinch.active = null;
      state.pendingAlerts.push(`🎁 ${pick(grinchFoiledTaunts)}`);
      state.meta.statusText = `Handed the Grinch ${g.demandQty} ${pluralize(g.demandQty, name)} — he slunk off.`;
      return true;
    }
    state.meta.statusText = `Gave the Grinch ${give} ${name}. ${g.demandQty - g.demandDelivered} to go.`;
    return true;
  }

  return { maybeTrigger, update, payToll, deliverDemand };
}

export type GrinchSystem = ReturnType<typeof createGrinchSystem>;
