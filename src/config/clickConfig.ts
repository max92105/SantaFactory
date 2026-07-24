/**
 * Click-game tuning — the hand-craft arena on the Click tab.
 *
 * The arena hosts one or more clickable buttons that dart around and pay out
 * gifts. Upgrades make the button bigger, boost gifts-per-click, add a second
 * permanent button, spawn transient golden buttons, and enable a click combo.
 * All numbers live here so the feel is easy to tune.
 */

/** Stable ids for the persistent buttons (positions are saved per id). */
export const MAIN_BUTTON = "main";
export const SECOND_BUTTON = "second";

/** Base button diameter (px). The old button was 110; the base is smaller now
 *  and grows with "Bigger Button" upgrades (clickButtonScale modifier). */
export const CLICK_BUTTON_BASE = 78;
export const CLICK_BUTTON_BASE_MOBILE = 64;
/** Golden buttons are a touch smaller than the base — a quick, precise target. */
export const GOLDEN_BUTTON_SIZE = 60;

/** Transient golden button: appears on a random cadence, pays a big burst, and
 *  vanishes fast if you miss it (all seconds). Only once its upgrade is owned. */
export const GOLDEN = {
  minInterval: 16,
  maxInterval: 38,
  lifetime: 6,
  /** Golden click pays gifts-per-click × this (then × combo). */
  giftMult: 20,
};

/** Combo: clicking any button within `window` seconds of the last keeps the
 *  streak alive and raises the multiplier by `perStep`, capped at `maxSteps`.
 *  multiplier = 1 + min(combo, maxSteps) × perStep  (e.g. 20 → ×3). Only once
 *  its upgrade is owned. */
export const COMBO = {
  window: 1.6,
  maxSteps: 20,
  perStep: 0.1,
};

/** Upgrade ids the click page gates features on (checked as owned flags). */
export const CLICK_UPGRADES = {
  secondButton: "click_second_button",
  golden: "click_golden",
  combo: "click_combo",
} as const;

/** Combo multiplier for a given streak count. */
export function comboMultiplier(combo: number): number {
  return 1 + Math.min(Math.max(0, combo), COMBO.maxSteps) * COMBO.perStep;
}
