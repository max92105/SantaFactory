/**
 * Wage & payroll tuning — used by WageSystem.
 *
 * Per-elf wages live on each elf type (config/elfTypesConfig.ts, dailyWage).
 * This file only tunes what happens when payroll fails.
 */

/** Shown in the Metrics tab so the player knows the rule. */
export const WAGE_RULE_TEXT =
  "If you can't pay wages, one elf of every type quits (and their shifts free up).";
