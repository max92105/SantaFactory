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
