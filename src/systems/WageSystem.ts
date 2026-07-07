/**
 * WageSystem — end-of-day payroll.
 * Wages are per elf (config/wagesConfig.ts) so the bill always matches the
 * elves you actually have; failure penalties live in the same config.
 */

import type { GameState } from "../state/GameState";
import {
  ELF_DAILY_WAGE,
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
    return state.workforce.totalElves * ELF_DAILY_WAGE;
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

  /**
   * Can't pay: elves quit from each assigned step and from the unassigned
   * pool. Hire prices follow the current elf count (helpers/costHelpers.ts),
   * so losing elves automatically makes rehiring cheaper.
   */
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

    state.dayStats.wagesPaid = 0;
    state.meta.lastWageResult = `FAILED: owed $${wagesOwed.toFixed(2)} (lost ${totalLost} elves)`;
    state.meta.statusText = `Couldn't pay $${wagesOwed.toFixed(
      2
    )} wages. Some elves quit (lost ${totalLost} elves).`;
  }

  return { calcDailyWages, payEndOfDayWages, getWageRuleText };
}

export type WageSystem = ReturnType<typeof createWageSystem>;
