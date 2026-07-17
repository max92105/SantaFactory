/**
 * THE CHRISTMAS ORDER — the endgame. Deliver 9,000,000,000 gifts — one for every
 * person on Earth — before Christmas morning (the end of day SEASON_DAYS).
 *
 * Every finished toy you deliver counts as exactly one gift (1:1, no multiplier).
 * Nine billion is only reachable once you've scaled up automation and production
 * upgrades — that long ramp IS the late game. Deliver every line before the
 * deadline → YOU WIN THE RUN. Christmas arrives with the order unfinished → lose.
 *
 * The order is split across every toy type: each toy's share is weighted
 * ∝ 1/chain-time (so cheap, fast toys are asked for in far larger numbers,
 * keeping each line roughly equal elf-effort) and jittered per run, so every
 * game demands a different mix.
 */

import { SEASON_DAYS } from "./timeConfig";

/** Total gifts the order demands (1 delivered toy = 1 gift), split across every toy type. */
export const CHRISTMAS_TOTAL_GIFTS = 9_000_000_000;

/** Deliver everything by the END of this day — Christmas itself. */
export const CHRISTMAS_DEADLINE_DAY = SEASON_DAYS;

/** Per-run randomization: each toy's weighted share is jittered by ±this. */
export const CHRISTMAS_QTY_JITTER = 0.4; // weight × rand(0.6 .. 1.4)

/** No line is ever smaller than this — "a large quantity of each toy". */
export const CHRISTMAS_MIN_PER_TOY = 1000;
