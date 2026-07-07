import type { GameState } from "../state/GameState";
import { producers } from "../data/producers";

export function createWageSystem() {
  const wageRuleText = "If you can't pay wages, you lose elves from each pipeline step.";

  function getWageRuleText(): string {
    return wageRuleText;
  }

  function calcDailyWages(state: GameState): number {
    // Calculate wages based on owned producer packages
    // Each producer package has elvesProvided * dailyWagePerElf
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

    // Penalty: lose elves when can't pay
    // For now, lose 1 elf from each assigned step and 1 from unassigned
    let totalLost = 0;

    // Remove from assignments first
    for (const stepId of Object.keys(state.workforce.assignments)) {
      const assigned = state.workforce.assignments[stepId];
      if (assigned > 0) {
        state.workforce.assignments[stepId] = assigned - 1;
        state.workforce.totalElves -= 1;
        totalLost += 1;
      }
    }

    // Remove from unassigned pool
    if (state.workforce.unassigned > 0) {
      state.workforce.unassigned -= 1;
      state.workforce.totalElves -= 1;
      totalLost += 1;
    }

    // Also reduce producer count to keep wage calculation in sync
    for (const def of producers) {
      const count = state.owned.producers[def.id] ?? 0;
      if (count > 0) {
        state.owned.producers[def.id] = count - 1;
      }
    }

    state.dayStats.wagesPaid = 0;
    state.meta.lastWageResult = `FAILED: owed $${wages.toFixed(2)} (lost ${totalLost} elves)`;
    state.meta.statusText = `Couldn't pay $${wages.toFixed(
      2
    )} wages. Some elves quit (lost ${totalLost} elves).`;
  }

  return { calcDailyWages, payEndOfDayWages, getWageRuleText };
}
