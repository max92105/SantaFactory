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

/**
 * Compact display for very large counts (Christmas Order lines): 9B, 42.5M,
 * 12.4k. Numbers below 10,000 stay exact.
 */
export function formatCompact(n: number): string {
  const trim = (v: number) => {
    const s = v.toFixed(1);
    return s.endsWith(".0") ? s.slice(0, -2) : s;
  };
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${trim(n / 1e9)}B`;
  if (abs >= 1e6) return `${trim(n / 1e6)}M`;
  if (abs >= 10_000) return `${trim(n / 1e3)}k`;
  return formatInt(n);
}
