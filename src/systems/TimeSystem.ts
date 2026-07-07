import { SECONDS_PER_GAME_DAY, SEASON_DAYS } from "../state/defaults";
import type { GameState } from "../state/GameState";
import { clamp01 } from "../utils/clamp";

export type TimeView = {
  day: number;
  timeOfDayLabel: string;
  dayProgress: number; // 0..1
  seasonDays: number;
};

export type TimeUpdateResult = {
  dayEnded: boolean;
};

export function createTimeSystem() {
  function update(state: GameState, dtSeconds: number): TimeUpdateResult {
    if (state.meta.isRunOver) return { dayEnded: false };

    const before = state.time.dayProgress;
    const next = before + dtSeconds / SECONDS_PER_GAME_DAY;

    let dayEnded = false;

    if (next >= 1) {
      dayEnded = true;
      state.time.day += 1;
      state.time.dayProgress = clamp01(next - 1);
      state.meta.statusText = `Day ${state.time.day - 1} ended. Wages due.`;
    } else {
      state.time.dayProgress = next;
    }

    if (state.time.day > SEASON_DAYS) {
      state.meta.isRunOver = true;
      state.meta.statusText = `Season over (Day ${SEASON_DAYS}). Final scoring screen comes next.`;
    }

    return { dayEnded };
  }

  function getView(state: GameState): TimeView {
    const p = clamp01(state.time.dayProgress);

    // Simple labels you can improve later
    const timeOfDayLabel =
      p < 0.25 ? "Morning" : p < 0.5 ? "Afternoon" : p < 0.75 ? "Evening" : "Night";

    return {
      day: state.time.day,
      timeOfDayLabel,
      dayProgress: p,
      seasonDays: SEASON_DAYS,
    };
  }

  return { update, getView };
}