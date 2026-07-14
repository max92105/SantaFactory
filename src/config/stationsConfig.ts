/**
 * Station (pipeline step) tuning — breakdowns & repair.
 *
 * Elves can break the station they work on (elfTypesConfig breakChance). A
 * broken station halts until the player pays to repair it in the Factory tab.
 */

/** Flat cost to repair one broken station manually. */
export const STATION_REPAIR_COST = 40;

/**
 * The virtual "step" mechanics are scheduled to. It isn't a production line —
 * mechanics on shift here auto-repair broken stations (see PipelineSystem).
 */
export const MAINTENANCE_STEP = "maintenance";

/**
 * The virtual "step" menders are scheduled to — the Repair Bench. Menders on
 * shift here refurbish broken toys back into finished ones (see PipelineSystem).
 */
export const REPAIR_STEP = "repair";

/** Salvaging a broken toy pays this fraction of its normal sell value. */
export const BROKEN_SALVAGE_RATE = 0.4;
