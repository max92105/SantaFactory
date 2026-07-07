import type { GameState } from "../state/GameState";

export type DaySummary = {
  dayNumber: number;

  giftsMade: number;
  giftsSold: number;

  moneyEarned: number;
  wagesDue: number;
  wagesPaid: number;

  moneyStart: number;
  moneyEnd: number;
  netChange: number;

  note: string;
};

export function createDailySummarySystem() {
  function startDay(state: GameState) {
    state.dayStats.giftsMade = 0;
    state.dayStats.giftsSold = 0;
    state.dayStats.moneyEarned = 0;
    state.dayStats.wagesPaid = 0;
    state.dayStats.wagesDue = 0;

    state.dayStats.moneyStart = state.resources.money;
    state.dayStats.moneyEnd = state.resources.money;
  }

  function finalizeDay(state: GameState, dayNumberThatEnded: number) {
    state.dayStats.moneyEnd = state.resources.money;
    const netChange = state.dayStats.moneyEnd - state.dayStats.moneyStart;

    const note =
      state.dayStats.wagesPaid >= state.dayStats.wagesDue
        ? "Wages paid successfully."
        : "Wages failed. Penalty applied.";

    const summary: DaySummary = {
      dayNumber: dayNumberThatEnded,
      giftsMade: state.dayStats.giftsMade,
      giftsSold: state.dayStats.giftsSold,
      moneyEarned: state.dayStats.moneyEarned,
      wagesDue: state.dayStats.wagesDue,
      wagesPaid: state.dayStats.wagesPaid,
      moneyStart: state.dayStats.moneyStart,
      moneyEnd: state.dayStats.moneyEnd,
      netChange,
      note,
    };

    state.meta.lastDaySummary = summary;
    state.meta.showDaySummary = true;
    state.meta.isPaused = true;
  }

  return { startDay, finalizeDay };
}