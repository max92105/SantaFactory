/**
 * ChristmasSystem — the endgame: THE CHRISTMAS ORDER.
 *
 * At run start (or on loading an older save) it generates one giant order line
 * per toy type, quantities randomized per run but weighted ∝ 1/chain-time so
 * every line costs roughly equal elf-effort. The player delivers finished toys
 * toward it all season; completing every line before Christmas WINS the run,
 * and Christmas arriving first LOSES it.
 *
 * Tuning: config/christmasConfig.ts
 */

import type { GameState } from "../state/GameState";
import {
  CHRISTMAS_TOTAL_GIFTS,
  CHRISTMAS_QTY_JITTER,
  CHRISTMAS_MIN_PER_TOY,
  CHRISTMAS_DEADLINE_DAY,
} from "../config/christmasConfig";
import { toyTypes } from "../config/toyTypesConfig";
import { pipelineSteps } from "../config/pipelineConfig";
import { removeFromStage } from "../helpers/inventoryHelpers";
import { deliverableToLine, isOrderComplete, orderDelivered, orderQuantity, orderRemaining } from "../helpers/orderHelpers";
import { formatInt } from "../helpers/formatHelpers";
import { t } from "../ui/i18n/i18n";

export type ChristmasView = {
  /** Every count is in gifts — one delivered toy = one gift (1:1). */
  total: number;
  delivered: number;
  remaining: number;
  progress: number; // 0..1
  daysLeft: number;
  deadlineDay: number;
  complete: boolean;
};

/** Total elf-seconds to push one toy of this type through its whole chain
 *  (all its craft steps + the shared QC and Packaging steps). */
function chainTime(toyId: string): number {
  let time = 0;
  for (const step of pipelineSteps) {
    if (step.toyType === toyId) time += step.baseTime; // its craft step(s)
    if (step.toyType === null) time += step.baseTime; // QC + Packaging
  }
  return Math.max(1, time);
}

export function createChristmasSystem() {
  /**
   * Generate the order once per run: weight each toy ∝ 1/chain-time (cheap
   * fast toys are demanded in far larger numbers), jitter each weight so every
   * run wants a different mix, scale to the configured total, and floor every
   * line at the minimum. Rounding drift lands on the biggest line.
   */
  function generateLines(state: GameState): void {
    const weights = toyTypes.map((toy) => {
      const jitter = 1 - CHRISTMAS_QTY_JITTER + Math.random() * CHRISTMAS_QTY_JITTER * 2;
      return { toyId: toy.id, weight: (1 / chainTime(toy.id)) * jitter };
    });
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);

    const lines = weights.map((w) => ({
      toyType: w.toyId,
      quantity: Math.max(CHRISTMAS_MIN_PER_TOY, Math.round((CHRISTMAS_TOTAL_GIFTS * w.weight) / totalWeight)),
      delivered: 0,
    }));

    // Land the rounding/min-floor drift on the largest line so the total is exact.
    const drift = CHRISTMAS_TOTAL_GIFTS - lines.reduce((s, l) => s + l.quantity, 0);
    const biggest = lines.reduce((a, b) => (b.quantity > a.quantity ? b : a));
    biggest.quantity = Math.max(CHRISTMAS_MIN_PER_TOY, biggest.quantity + drift);

    state.christmas.lines = lines;
  }

  /** Make sure the order exists and matches the current goal (new runs and
   *  older saves alike). Regenerates a stale order — e.g. a save from before the
   *  9-billion target — so an in-progress run always plays toward today's goal.
   *  A finished run is left untouched so its result still reads correctly. */
  function ensureInit(state: GameState): void {
    if (!state.meta.isRunOver) {
      const currentTotal = orderQuantity(state.christmas);
      if (state.christmas.lines.length === 0 || currentTotal !== CHRISTMAS_TOTAL_GIFTS) {
        generateLines(state);
      }
    }

    // A run that ended before outcomes existed: resolve it now so the old
    // "season over" save shows a proper end screen instead of a dead UI.
    if (state.meta.isRunOver && state.meta.runOutcome === null) {
      state.meta.runOutcome = isOrderComplete(state.christmas) ? "won" : "lost";
    }
  }

  /** WIN — every line filled before Christmas. Ends the run on the spot. */
  function win(state: GameState): void {
    state.meta.runOutcome = "won";
    state.meta.isRunOver = true;
    state.meta.statusText = t("sys.christmasWon");
    state.pendingCelebrations.push({ amount: 0, grand: true });
  }

  /**
   * Ship every deliverable finished toy toward the order (all lines at once —
   * with 50 lines, per-line steppers would be busywork). Wins immediately if
   * that completes the order.
   */
  function deliverMax(state: GameState): boolean {
    let gave = 0;
    for (const line of state.christmas.lines) {
      const give = deliverableToLine(state, line);
      if (give > 0) {
        removeFromStage(state, line.toyType, "finished", give);
        line.delivered += give;
        gave += give;
      }
    }

    if (gave <= 0) {
      state.meta.statusText = t("sys.orderNothing");
      return false;
    }

    if (isOrderComplete(state.christmas)) {
      win(state);
    } else {
      state.meta.statusText = t("sys.christmasPartial", {
        n: formatInt(gave),
        left: formatInt(orderRemaining(state.christmas)),
      });
    }
    return true;
  }

  /**
   * Ship a player-chosen amount of each toy (keyed by toyType) toward the
   * order — the exact-amount path, mirroring the daily-order deliver modal.
   * Each is capped to what's owed and in stock. Wins if it finishes the order.
   */
  function deliverAmounts(state: GameState, amounts: Record<string, number>): boolean {
    let gave = 0;
    for (const line of state.christmas.lines) {
      const want = Math.max(0, Math.floor(amounts[line.toyType] ?? 0));
      const give = Math.min(want, deliverableToLine(state, line));
      if (give > 0) {
        removeFromStage(state, line.toyType, "finished", give);
        line.delivered += give;
        gave += give;
      }
    }

    if (gave <= 0) {
      state.meta.statusText = t("sys.orderNothing");
      return false;
    }

    if (isOrderComplete(state.christmas)) {
      win(state);
    } else {
      state.meta.statusText = t("sys.christmasPartial", {
        n: formatInt(gave),
        left: formatInt(orderRemaining(state.christmas)),
      });
    }
    return true;
  }

  /** Christmas has arrived (day > deadline): resolve the run if still open. */
  function resolveSeasonEnd(state: GameState): void {
    if (state.meta.runOutcome !== null) return;
    if (isOrderComplete(state.christmas)) {
      win(state);
    } else {
      state.meta.runOutcome = "lost";
      state.meta.isRunOver = true;
      state.meta.statusText = t("sys.christmasLost");
    }
  }

  function getView(state: GameState): ChristmasView {
    const total = orderQuantity(state.christmas);
    const delivered = orderDelivered(state.christmas);
    return {
      total,
      delivered,
      remaining: total - delivered,
      progress: total > 0 ? delivered / total : 0,
      daysLeft: Math.max(0, CHRISTMAS_DEADLINE_DAY - state.time.day + 1),
      deadlineDay: CHRISTMAS_DEADLINE_DAY,
      complete: isOrderComplete(state.christmas),
    };
  }

  return { ensureInit, deliverMax, deliverAmounts, resolveSeasonEnd, getView };
}

export type ChristmasSystem = ReturnType<typeof createChristmasSystem>;
