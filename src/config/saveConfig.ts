/**
 * Save/load settings — used by SaveSystem.
 *
 * Progress is stored in one of a few numbered slots. Bump SAVE_VERSION only
 * when the save format breaks compatibility.
 */

export const SAVE_VERSION = "v1";

/** How many save slots the main menu offers. */
export const SLOT_COUNT = 3;

/** localStorage key for a slot's save. */
export function slotKey(slot: number): string {
  return `santa_factory_clicker_save_${SAVE_VERSION}_slot${slot}`;
}

/** Pre-slots single-save key. Migrated into slot 1 on first launch. */
export const LEGACY_SAVE_KEY = "santa_factory_clicker_save_v1";
