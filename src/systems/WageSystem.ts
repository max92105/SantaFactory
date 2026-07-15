/**
 * WageSystem — end-of-day payroll.
 * Per-elf wages live on each elf type (config/elfTypesConfig.ts, dailyWage) so
 * the bill scales with the workforce you actually have; failure penalties live
 * in config/wagesConfig.ts.
 */

import type { GameState } from "../state/GameState";
import { elfTypes } from "../config/elfTypesConfig";
import { WAGE_RULE_TEXT } from "../config/wagesConfig";
import { countOfType, removeOneOfType } from "../helpers/workforceHelpers";

export function createWageSystem() {
  function getWageRuleText(): string {
    return WAGE_RULE_TEXT;
  }

  /** Total wages owed at the end of the current day (sum of each elf's wage). */
  function calcDailyWages(state: GameState, wageMult = 1): number {
    let total = 0;
    for (const def of elfTypes) {
      total += countOfType(state, def.id) * def.dailyWage;
    }
    return Math.round(total * wageMult);
  }

  function payEndOfDayWages(state: GameState, wageMult = 1) {
    if (state.meta.isRunOver) return;

    const wages = calcDailyWages(state, wageMult);
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
   * Can't pay: one elf of each type quits (and its shifts are trimmed to fit).
   * Hire prices follow the current per-type count (helpers/costHelpers.ts), so
   * losing elves automatically makes rehiring that type cheaper.
   */
  function applyUnpaidWagePenalty(state: GameState, wagesOwed: number) {
    let totalLost = 0;
    for (const def of elfTypes) {
      if (removeOneOfType(state, def.id)) totalLost += 1;
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
