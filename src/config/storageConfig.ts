/**
 * Warehouse capacity — the hard ceiling on how much STUFF the factory holds.
 *
 * Everything physical counts against it: every production stage (wip1/wip2/raw/
 * assembled/finished) plus the broken pile. Counting the whole pipeline (not
 * just finished gifts) is deliberate — otherwise you could park a million
 * half-built toys at `assembled` and burst-convert them on demand, which is the
 * exact infinite-stockpile the cap exists to stop.
 *
 * When the warehouse is full, steps that CREATE items from nothing (the craft
 * steps) and the click button halt. Every other step consumes one item and
 * produces one, so the line keeps draining — the factory jams from the front.
 *
 * Capacity is derived, not saved: it's `BASE_STORAGE_CAPACITY` doubled once per
 * Warehouse Expansion owned (see config/upgradesConfig.ts, which generates the
 * tier chain from the numbers below). Logic lives in helpers/storageHelpers.ts.
 */

/** Items the warehouse holds before any expansion is bought. */
export const BASE_STORAGE_CAPACITY = 250;

/** Each expansion multiplies TOTAL capacity by this (2 = every tier doubles). */
export const STORAGE_TIER_CAP_MULT = 2;

/** How many expansions exist. 16 doublings takes 250 → ~16.4M, roughly a day's
 *  output at the pace the Christmas Order demands (9B / 365 days). */
export const STORAGE_TIER_COUNT = 16;

/** Price of the first expansion, and the per-tier price ramp. The ramp is
 *  steeper than the capacity ramp on purpose: space should always be a real
 *  purchase competing with toys and elves, never an afterthought you max out. */
export const STORAGE_TIER_BASE_COST = 350;
export const STORAGE_TIER_COST_GROWTH = 3.8;

/** Fill fraction at which meters turn amber — the "sell or expand soon" nudge. */
export const STORAGE_WARN_PCT = 0.85;

/** Round to 3 significant digits so generated prices read like hand-picked ones. */
function roundSignificant(n: number): number {
  if (n <= 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(n)) - 2);
  return Math.round(n / mag) * mag;
}

/** Total capacity after owning `tiers` expansions. */
export function capacityForTiers(tiers: number): number {
  return Math.round(BASE_STORAGE_CAPACITY * Math.pow(STORAGE_TIER_CAP_MULT, tiers));
}

/** Price of the i-th expansion (0-based: 0 is the first one you can buy). */
export function storageTierCost(i: number): number {
  return roundSignificant(STORAGE_TIER_BASE_COST * Math.pow(STORAGE_TIER_COST_GROWTH, i));
}
