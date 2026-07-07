/**
 * WageSystem — end-of-day payroll.
 * Wage amounts live on hire packages (config/producersConfig.ts);
 * failure penalties live in config/wagesConfig.ts.
 */

import type { GameState } from "../state/GameState";
import { producers } from "../config/producersConfig";
import {
  WAGE_RULE_TEXT,
  UNPAID_ELVES_LOST_PER_STEP,
  UNPAID_ELVES_LOST_FROM_UNASSIGNED,
} from "../config/wagesConfig";

export function createWageSystem() {
  function getWageRuleText(): string {
    return WAGE_RULE_TEXT;
  }

  /** Total wages owed at the end of the current day. */
  function calcDailyWages(state: GameState): number {
    // Each hire package owes: owned * elvesProvided * dailyWagePerElf
    let total = 0;
    for (const def of producers) {
      const count = state.owned.producers[def.id] ?? 0;
      if (count <= 0) continue;
      total += count * def.elvesProvided * def.dailyWagePerElf;
    }
    return total;
  }

  function payEndOfDayWages(state: GameState) {
    if (state.meta.isRunOver) return;

    const wages = calcDailyWages(state);
    state.dayStats.wagesDue = wages;

    if (wages <= 0) {
      state.meta.lastWageResult = "No wages due";
      state.dayStats.wagesPaid = 0;
      state.meta.statusText = "End of day: no wages due.";
      return;
    }

    if (state.resources.money >= wages) {
      state.resources.money -= wages;
      state.dayStats.wagesPaid = wages;

      state.meta.lastWageResult = `Paid $${wages.toFixed(2)}`;
      state.meta.statusText = `Paid $${wages.toFixed(2)} in wages.`;
      return;
    }

    applyUnpaidWagePenalty(state, wages);
  }

  /** Can't pay: elves quit from each assigned step and from the unassigned pool. */
  function applyUnpaidWagePenalty(state: GameState, wagesOwed: number) {
    let totalLost = 0;

    for (const stepId of Object.keys(state.workforce.assignments)) {
      const assigned = state.workforce.assignments[stepId];
      const lost = Math.min(assigned, UNPAID_ELVES_LOST_PER_STEP);
      if (lost > 0) {
        state.workforce.assignments[stepId] = assigned - lost;
        state.workforce.totalElves -= lost;
        totalLost += lost;
      }
    }

    const lostUnassigned = Math.min(state.workforce.unassigned, UNPAID_ELVES_LOST_FROM_UNASSIGNED);
    if (lostUnassigned > 0) {
      state.workforce.unassigned -= lostUnassigned;
      state.workforce.totalElves -= lostUnassigned;
      totalLost += lostUnassigned;
    }

    // Also shrink each hire package by one so tomorrow's wage bill goes down too
    for (const def of producers) {
      const count = state.owned.producers[def.id] ?? 0;
      if (count > 0) {
        state.owned.producers[def.id] = count - 1;
      }
    }

    state.dayStats.wagesPaid = 0;
    state.meta.lastWageResult = `FAILED: owed $${wagesOwed.toFixed(2)} (lost ${totalLost} elves)`;
    state.meta.statusText = `Couldn't pay $${wagesOwed.toFixed(
      2
    )} wages. Some elves quit (lost ${totalLost} elves).`;
  }

  return { calcDailyWages, payEndOfDayWages, getWageRuleText };
}

export type WageSystem = ReturnType<typeof createWageSystem>;
