/**
 * Time & calendar tuning — used by TimeSystem.
 *
 * The run always ends on Christmas (see docs/GAME_DIRECTION.md).
 */

/** Total length of a run, in in-game days. Day 365 = Christmas. */
export const SEASON_DAYS = 365;

/**
 * How long one in-game day lasts in real time, in seconds.
 * This is the single pacing knob for the whole game.
 */
export const SECONDS_PER_GAME_DAY = 300; // 5 real minutes per in-game day
