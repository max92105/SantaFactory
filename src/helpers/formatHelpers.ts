/** Number/money display formatting — the single place for all formatting rules. */

export function formatInt(n: number): string {
  return Math.floor(n).toLocaleString();
}

/** Use for big money totals (no cents). */
export function formatMoney(n: number): string {
  return `$${Math.floor(n).toLocaleString()}`;
}

/** Use for rates / multipliers / anything that needs decimals. */
export function formatMoneyPrecise(n: number, decimals: number = 2): string {
  return `$${n.toFixed(decimals)}`;
}

/**
 * Use for purchase prices: shows cents while they matter, and never displays
 * less than what will actually be charged (rounds up, not down).
 */
export function formatCost(n: number): string {
  if (n < 1000 && Math.round(n * 100) % 100 !== 0) return formatMoneyPrecise(n);
  return `$${Math.ceil(n).toLocaleString()}`;
}
