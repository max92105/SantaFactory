/**
 * THE CHRISTMAS ORDER — the endgame. Nine billion gifts, one for every person
 * on Earth, due before Christmas morning (the end of day SEASON_DAYS).
 *
 * Deliver every line before the deadline → YOU WIN THE RUN.
 * Christmas arrives with the order unfinished → you lose.
 *
 * ── The math (why toys × sleigh magic, not 9e9 physical toys) ─────────────
 * One elf on 2 shifts works 150s of a 300s day. A cheap toy costs ~7 elf-
 * seconds through the whole chain (craft 2s + QC 3s + pack 2s) → ~21 finished
 * toys per elf-day → ~7,800 per elf over the 365-day season. 9e9 physical toys
 * would need ~1.2 MILLION elves — four orders of magnitude past what the
 * factory (or the UI) can hold. So each physical toy the player delivers is
 * multiplied by Santa's SLEIGH_MAGIC on delivery night: 500,000 toys ×
 * 18,000 = exactly 9,000,000,000 gifts. The gift number is the fantasy; the
 * toy number is the real difficulty knob.
 *
 * Feasibility of 500,000 toys: quantities are weighted ∝ 1/chain-time, so
 * every line costs roughly equal elf-time — ≈ 6.3M elf-seconds total
 * ≈ 46,000 elf-days ≈ an average of ~130 elves working 2 shifts across the
 * whole run (more like 250–350 late-game since you start from zero). Hard,
 * but winnable — and future production multipliers only make it easier.
 */

import { SEASON_DAYS } from "./timeConfig";

/** Physical toys the order demands, split across every toy type. */
export const CHRISTMAS_TOTAL_TOYS = 500_000;

/** Each delivered toy becomes this many gifts on Christmas night. */
export const SLEIGH_MAGIC = 18_000;

/** The headline number: one gift for every person on Earth. */
export const CHRISTMAS_TOTAL_GIFTS = CHRISTMAS_TOTAL_TOYS * SLEIGH_MAGIC; // 9,000,000,000

/** Deliver everything by the END of this day — Christmas itself. */
export const CHRISTMAS_DEADLINE_DAY = SEASON_DAYS;

/**
 * Per-run randomization: each toy's share is its base weight (∝ 1/chain-time,
 * so cheap fast toys are asked for in far larger numbers) jittered by
 * ±CHRISTMAS_QTY_JITTER. Every run demands a different mix.
 */
export const CHRISTMAS_QTY_JITTER = 0.4; // weight × rand(0.6 .. 1.4)

/** No line is ever smaller than this — "a large quantity of each toy". */
export const CHRISTMAS_MIN_PER_TOY = 500;
