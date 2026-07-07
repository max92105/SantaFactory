/**
 * Shared unlock-rule format used by producers and upgrades.
 *
 * NOTE: unlock rules are defined on the data but not evaluated yet —
 * every producer/upgrade is currently always visible in the shop.
 * When gating is implemented, add an `isUnlocked(state, rule)` helper here
 * so the logic lives in exactly one place.
 */
export type UnlockRule =
  | { type: "always" }
  | { type: "producer_owned"; producerId: string; count: number };
