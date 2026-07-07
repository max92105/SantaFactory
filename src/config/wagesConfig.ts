/**
 * Wage & payroll tuning — used by WageSystem.
 *
 * Every elf costs the same per day regardless of which hire package it came
 * from, so payroll is always consistent with the elves you actually have.
 */

/** Daily wage owed per elf currently employed. */
export const ELF_DAILY_WAGE = 2;

/** Shown in the Metrics tab so the player knows the rule. */
export const WAGE_RULE_TEXT =
  "If you can't pay wages, elves quit: one from each assigned step and one from the unassigned pool.";

/** Elves lost from EACH assigned pipeline step when wages can't be paid. */
export const UNPAID_ELVES_LOST_PER_STEP = 1;

/** Elves lost from the unassigned pool when wages can't be paid. */
export const UNPAID_ELVES_LOST_FROM_UNASSIGNED = 1;
