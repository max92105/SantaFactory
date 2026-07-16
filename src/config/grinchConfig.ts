/**
 * The Grinch — an occasional villain who threatens to steal your finished gifts
 * unless you pay him off or hand over a batch of toys before his timer runs out.
 * Real-time and non-blocking: the game keeps running so you can scramble.
 *
 * Tuning below; logic in systems/GrinchSystem.ts, UI in ui/components/grinchCard.ts.
 */

/** Quiet cooldown after a heist before he can roll again (in-game days). Also
 *  the initial warm-up on a fresh run, so a new player isn't ambushed. */
export const GRINCH_MIN_GAP_DAYS = 2;
/** Roughly the chance he shows up over one full eligible day — but the roll now
 *  happens continuously in real time, so he can strike at ANY moment of the
 *  day, not just at the day boundary. (GrinchSystem converts this to a
 *  per-second chance from SECONDS_PER_GAME_DAY.) */
export const GRINCH_DAILY_CHANCE = 0.5;

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
/** …and never cheaper than this share of your net worth (money + stock), so a
 *  rich late-game factory can't shrug him off with pocket change. */
export const GRINCH_TOLL_NETWORTH_PCT = 0.1;

/** How many of one toy he demands instead (inclusive random range). */
export const GRINCH_DEMAND_MIN = 15;
export const GRINCH_DEMAND_MAX = 45;
/** …scaled up to at least this many days' worth of your average production,
 *  so the toy ransom stays a real dent as the factory grows. */
export const GRINCH_DEMAND_DAYS_WORTH = 0.35;

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
