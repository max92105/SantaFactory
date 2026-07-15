/**
 * celebration — payout juice for completed orders: a confetti burst plus a big
 * "+$X" that counts up. Grand orders add a full-screen golden flash.
 * Styles: celebration.css. Everything is transient DOM in a fixed overlay
 * layer (pointer-events: none) and removes itself when its animation ends.
 */

import "./celebration.css";

import { formatMoney } from "../../helpers/formatHelpers";

const CONFETTI_COLORS = ["#ef4444", "#fbbf24", "#4ade80", "#4a9eff", "#f472b6", "#a78bfa"];

const COUNT_UP_MS = 900;

export type CelebrationOptions = { amount: number; grand?: boolean };

export function spawnCelebration(layer: HTMLElement, opts: CelebrationOptions): void {
  if (opts.grand) spawnFlash(layer);
  spawnConfetti(layer, opts.grand ? 70 : 30, opts.grand ?? false);
  spawnMoneyPop(layer, opts.amount, opts.grand ?? false);
}

/** Full-screen golden flash (grand orders only). */
function spawnFlash(layer: HTMLElement): void {
  const flash = document.createElement("div");
  flash.className = "celebrate-flash";
  flash.addEventListener("animationend", () => flash.remove(), { once: true });
  layer.appendChild(flash);
}

/** A burst of falling confetti pieces from the center of the screen. */
function spawnConfetti(layer: HTMLElement, count: number, grand: boolean): void {
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "celebrate-confetti";
    const angle = Math.random() * Math.PI * 2;
    const distance = 90 + Math.random() * (grand ? 320 : 200);
    piece.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    piece.style.setProperty("--dy", `${Math.sin(angle) * distance * 0.6 + 240}px`);
    piece.style.setProperty("--rot", `${(Math.random() - 0.5) * 720}deg`);
    piece.style.setProperty("--dur", `${0.9 + Math.random() * 0.8}s`);
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.addEventListener("animationend", () => piece.remove(), { once: true });
    layer.appendChild(piece);
  }
}

/** Big centered "+$X" that ticks up from 0 to the reward, then floats away. */
function spawnMoneyPop(layer: HTMLElement, amount: number, grand: boolean): void {
  const pop = document.createElement("div");
  pop.className = "celebrate-money" + (grand ? " grand" : "");
  pop.textContent = `+${formatMoney(0)}`;
  pop.addEventListener("animationend", () => pop.remove(), { once: true });
  layer.appendChild(pop);

  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / COUNT_UP_MS);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic — fast start, satisfying settle
    pop.textContent = `+${formatMoney(Math.round(amount * eased))}`;
    if (t < 1 && pop.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
