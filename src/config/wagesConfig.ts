/**
 * Wage & payroll tuning — used by WageSystem.
 *
 * Wage amounts themselves live on each hire package in producersConfig.ts
 * (dailyWagePerElf). This file tunes what happens when payroll fails.
 */

/** Shown in the Metrics tab so the player knows the rule. */
export const WAGE_RULE_TEXT = "If you can't pay wages, you lose elves from each pipeline step.";

/** Elves lost from EACH assigned pipeline step when wages can't be paid. */
export const UNPAID_ELVES_LOST_PER_STEP = 1;

/** Elves lost from the unassigned pool when wages can't be paid. */
export const UNPAID_ELVES_LOST_FROM_UNASSIGNED = 1;
