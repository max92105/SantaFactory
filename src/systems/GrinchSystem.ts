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
  GRINCH_TOLL_NETWORTH_PCT,
  GRINCH_DEMAND_MIN,
  GRINCH_DEMAND_MAX,
  GRINCH_DEMAND_DAYS_WORTH,
  grinchTaunts,
  grinchStealTaunts,
  grinchFoiledTaunts,
} from "../config/grinchConfig";
import { getToyType } from "../config/toyTypesConfig";
import { SECONDS_PER_GAME_DAY } from "../config/timeConfig";
import { getUnlockedToyTypes } from "../helpers/unlockHelpers";
import { ensureInventory, getSellableStock, removeFromStage } from "../helpers/inventoryHelpers";
import { netWorth, scaledGifts } from "../helpers/progressHelpers";
import { formatMoney } from "../helpers/formatHelpers";
import { t } from "../ui/i18n/i18n";
import { toyName } from "../ui/i18n/localize";

/** Quiet cooldown after a heist (and the initial warm-up), in in-game seconds. */
const COOLDOWN_SECONDS = GRINCH_MIN_GAP_DAYS * SECONDS_PER_GAME_DAY;
/** Per-second appearance chance, derived so the odds over one full eligible day
 *  still match GRINCH_DAILY_CHANCE — only now spread continuously through it. */
const CHANCE_PER_SECOND = 1 - Math.pow(1 - GRINCH_DAILY_CHANCE, 1 / SECONDS_PER_GAME_DAY);

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

  /** Clear the active heist and start his quiet cooldown before the next one. */
  function clearThreat(state: GameState): void {
    clearThreat(state);
    state.grinch.cooldownSeconds = COOLDOWN_SECONDS;
  }

  /** Kick off a heist right now. Returns true if one started (false if there's
   *  nothing to steal). No gating — callers decide when he's eligible. */
  function startHeist(state: GameState): boolean {
    const toys = getUnlockedToyTypes(state);
    if (toys.length === 0) return false;

    const stealPct = randRange(GRINCH_STEAL_MIN, GRINCH_STEAL_MAX);
    // Toll tracks BOTH the stock he threatens and your overall wealth, so it
    // stings early ($200 floor) and late (10% of net worth) alike.
    const toll = Math.max(
      GRINCH_TOLL_FLOOR,
      Math.round(finishedStockValue(state) * stealPct * GRINCH_TOLL_FACTOR),
      Math.round(netWorth(state) * GRINCH_TOLL_NETWORTH_PCT)
    );
    const demandToy = pick(toys).id;

    const tauntKey = `grinch.taunt.${randInt(0, grinchTaunts.length - 1)}`;
    state.grinch.active = {
      toll,
      demandToy,
      // The toy ransom grows with your factory: at least a third of a day's output.
      demandQty: scaledGifts(state, randInt(GRINCH_DEMAND_MIN, GRINCH_DEMAND_MAX), GRINCH_DEMAND_DAYS_WORTH),
      demandDelivered: 0,
      stealPct,
      secondsLeft: randInt(GRINCH_SECONDS_MIN, GRINCH_SECONDS_MAX),
      taunt: tauntKey,
    };

    state.pendingAlerts.push(t("grinch.status.alert", { taunt: t(tauntKey) }));
    state.meta.statusText = t("grinch.status.arrive");
    return true;
  }

  /**
   * Real-time tick (call every frame). When a heist is live, counts it down and
   * lets him steal on timeout. When none is live, burns the quiet cooldown and
   * then rolls his continuous per-second chance — so he can appear at ANY time
   * of day. Returns true when the threat changed (so the UI rebuilds).
   */
  function update(state: GameState, dt: number): boolean {
    const g = state.grinch.active;

    // No heist running: tick down the cooldown, then maybe start one.
    if (!g) {
      if (state.grinch.cooldownSeconds > 0) {
        state.grinch.cooldownSeconds = Math.max(0, state.grinch.cooldownSeconds - dt);
        return false;
      }
      if (Math.random() < CHANCE_PER_SECOND * dt) return startHeist(state);
      return false;
    }

    g.secondsLeft -= dt;
    if (g.secondsLeft > 0) return false;

    let stolen = 0;
    for (const t of getUnlockedToyTypes(state)) {
      const inv = ensureInventory(state, t.id);
      const take = Math.floor(inv.finished * g.stealPct);
      inv.finished -= take;
      stolen += take;
    }
    clearThreat(state);
    const stealKey = `grinch.steal.${randInt(0, grinchStealTaunts.length - 1)}`;
    state.pendingAlerts.push(t("grinch.status.stoleAlert", { taunt: t(stealKey), n: stolen }));
    state.meta.statusText = t("grinch.status.stole", { n: stolen });
    return true;
  }

  /** Pay the toll to be rid of him. */
  function payToll(state: GameState): boolean {
    const g = state.grinch.active;
    if (!g) return false;
    if (state.resources.money < g.toll) {
      state.meta.statusText = t("grinch.status.noMoney", { toll: formatMoney(g.toll) });
      return false;
    }
    state.resources.money -= g.toll;
    clearThreat(state);
    state.pendingAlerts.push(t("grinch.foiled.pay", { taunt: t(`grinch.foiled.${randInt(0, grinchFoiledTaunts.length - 1)}`) }));
    state.meta.statusText = t("grinch.status.paid", { toll: formatMoney(g.toll) });
    return true;
  }

  /** Hand over as much of his demanded toy as you have; foils him when met. */
  function deliverDemand(state: GameState): boolean {
    const g = state.grinch.active;
    if (!g) return false;

    const name = toyName(g.demandToy);
    const need = g.demandQty - g.demandDelivered;
    const give = Math.min(need, getSellableStock(state, g.demandToy));
    if (give <= 0) {
      state.meta.statusText = t("grinch.status.noStock", { name });
      return false;
    }

    removeFromStage(state, g.demandToy, "finished", give);
    g.demandDelivered += give;

    if (g.demandDelivered >= g.demandQty) {
      clearThreat(state);
      state.pendingAlerts.push(t("grinch.foiled.give", { taunt: t(`grinch.foiled.${randInt(0, grinchFoiledTaunts.length - 1)}`) }));
      state.meta.statusText = t("grinch.status.gaveAll", { n: g.demandQty, name });
      return true;
    }
    state.meta.statusText = t("grinch.status.gaveSome", { n: give, name, left: g.demandQty - g.demandDelivered });
    return true;
  }

  return { update, payToll, deliverDemand };
}

export type GrinchSystem = ReturnType<typeof createGrinchSystem>;
