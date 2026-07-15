/**
 * The Grinch — an occasional villain who threatens to steal your finished gifts
 * unless you pay him off or hand over a batch of toys before his timer runs out.
 * Real-time and non-blocking: the game keeps running so you can scramble.
 *
 * Tuning below; logic in systems/GrinchSystem.ts, UI in ui/components/grinchCard.ts.
 */

/** Earliest he can return after a heist (days). Also warms up from day 1. */
export const GRINCH_MIN_GAP_DAYS = 4;
/** Once eligible, daily chance he shows up. */
export const GRINCH_DAILY_CHANCE = 0.35;

/** Countdown he gives you (real seconds, inclusive random range). */
export const GRINCH_SECONDS_MIN = 80;
export const GRINCH_SECONDS_MAX = 120;

/** Fraction of finished stock he steals on timeout (inclusive random range). */
export const GRINCH_STEAL_MIN = 0.3;
export const GRINCH_STEAL_MAX = 0.5;

/** Toll = threatened stock value × this (so paying beats losing the stock). */
export const GRINCH_TOLL_FACTOR = 0.6;
/** Never cheaper than this (keeps early heists meaningful). */
export const GRINCH_TOLL_FLOOR = 200;

/** How many of one toy he demands instead (inclusive random range). */
export const GRINCH_DEMAND_MIN = 15;
export const GRINCH_DEMAND_MAX = 45;

export const grinchTaunts = [
  "Stink, stank, stunk! Hand over those gifts.",
  "Such potential for MISCHIEF... pay up or I loot the lot.",
  "I could use a few thousand toys. Or your coin. Your choice.",
  "Oh, the noise, noise, noise! Buy my silence.",
  "A wonderful, awful idea: I rob your warehouse. Unless...",
  "Tribute, little manager. Toys or gold — tick tock.",
];

export const grinchStealTaunts = [
  "Too slow! I'll be taking these.",
  "Should've paid up. Merry heist to me!",
  "Down the chimney they go — mine now!",
  "Snoozed, and lost. Classic.",
];

export const grinchFoiledTaunts = [
  "Bah! Fine. Keep your precious gifts.",
  "You win this round, manager.",
  "Hmph. I'll be back when you least expect it.",
  "Lucky. Don't get comfortable.",
];
