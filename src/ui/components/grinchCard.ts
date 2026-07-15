/**
 * grinchCard — the Grinch's live heist card: a non-blocking fixed corner panel
 * with a real-time countdown and two ways out (pay the toll / give him toys).
 * The game keeps running behind it. Styles: grinchCard.css.
 */

import "./grinchCard.css";

import type { GameState, GrinchThreat } from "../../state/GameState";
import { getToyType } from "../../config/toyTypesConfig";
import { getSellableStock } from "../../helpers/inventoryHelpers";
import { formatInt, formatMoney } from "../../helpers/formatHelpers";

const CARD_CLASS = "grinch-card";

export type GrinchHandlers = { onPay: () => void; onGive: () => void };

export function grinchCardOpen(): boolean {
  return document.querySelector(`.${CARD_CLASS}`) !== null;
}

export function removeGrinchCard(): void {
  document.querySelector(`.${CARD_CLASS}`)?.remove();
}

export function showGrinchCard(threat: GrinchThreat, handlers: GrinchHandlers): void {
  removeGrinchCard();
  const toy = getToyType(threat.demandToy);

  const card = document.createElement("div");
  card.className = CARD_CLASS;
  card.innerHTML = `
    <div class="grinch-head">
      <span class="grinch-face">😈</span>
      <div class="grinch-head-text">
        <div class="grinch-name">The Grinch <span class="grinch-secs" data-grinch-secs>—</span></div>
        <div class="grinch-taunt">${threat.taunt}</div>
      </div>
    </div>
    <div class="grinch-threat">Loots <strong>${Math.round(threat.stealPct * 100)}%</strong> of your gifts when the timer hits zero.</div>
    <div class="grinch-actions">
      <button class="grinch-btn grinch-pay" data-grinch-pay type="button"></button>
      <button class="grinch-btn grinch-give" data-grinch-give type="button">
        <span class="grinch-give-main">Give ${toy?.icon ?? "🎁"} <span data-grinch-progress>0</span>/${formatInt(threat.demandQty)}</span>
        <span class="grinch-give-sub" data-grinch-have></span>
      </button>
    </div>
  `;
  card.querySelector<HTMLButtonElement>("[data-grinch-pay]")!.onclick = handlers.onPay;
  card.querySelector<HTMLButtonElement>("[data-grinch-give]")!.onclick = handlers.onGive;
  document.body.appendChild(card);
}

/** Per-frame refresh: countdown, toll affordability, demand progress + stock. */
export function updateGrinchCard(state: GameState): void {
  const g = state.grinch.active;
  const card = document.querySelector<HTMLElement>(`.${CARD_CLASS}`);
  if (!g || !card) return;

  const secs = Math.max(0, Math.ceil(g.secondsLeft));
  const secsEl = card.querySelector<HTMLElement>("[data-grinch-secs]");
  if (secsEl) {
    secsEl.textContent = `${secs}s`;
    secsEl.classList.toggle("ending", secs <= 15);
  }

  const pay = card.querySelector<HTMLButtonElement>("[data-grinch-pay]");
  if (pay) {
    pay.textContent = `Pay ${formatMoney(g.toll)}`;
    pay.disabled = state.resources.money < g.toll;
  }

  const stock = getSellableStock(state, g.demandToy);
  const progressEl = card.querySelector<HTMLElement>("[data-grinch-progress]");
  if (progressEl) progressEl.textContent = formatInt(g.demandDelivered);
  const haveEl = card.querySelector<HTMLElement>("[data-grinch-have]");
  if (haveEl) haveEl.textContent = `${formatInt(stock)} in stock`;
  const give = card.querySelector<HTMLButtonElement>("[data-grinch-give]");
  if (give) give.disabled = stock <= 0;
}
