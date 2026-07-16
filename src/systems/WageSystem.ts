/**
 * WageSystem — end-of-day payroll.
 * Per-elf wages live on each elf type (config/elfTypesConfig.ts, dailyWage) so
 * the bill scales with the workforce you actually have; failure penalties live
 * in config/wagesConfig.ts.
 */

import type { GameState } from "../state/GameState";
import { elfTypes } from "../config/elfTypesConfig";
import { countOfType, removeOneOfType } from "../helpers/workforceHelpers";
import { t } from "../ui/i18n/i18n";
import { formatMoney } from "../helpers/formatHelpers";

export function createWageSystem() {
  function getWageRuleText(): string {
    return t("wage.rule");
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
      state.meta.lastWageResult = t("sys.noWages");
      state.dayStats.wagesPaid = 0;
      state.meta.statusText = t("sys.noWages");
      return;
    }

    if (state.resources.money >= wages) {
      state.resources.money -= wages;
      state.dayStats.wagesPaid = wages;

      state.meta.lastWageResult = t("sys.paidWages", { money: formatMoney(wages) });
      state.meta.statusText = t("sys.paidWages", { money: formatMoney(wages) });
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
    const msg = t("sys.wageFail", { money: formatMoney(wagesOwed), n: totalLost });
    state.meta.lastWageResult = msg;
    state.meta.statusText = msg;
  }

  return { calcDailyWages, payEndOfDayWages, getWageRuleText };
}

export type WageSystem = ReturnType<typeof createWageSystem>;
