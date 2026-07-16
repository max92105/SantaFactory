/**
 * grinchCard — the Grinch's live heist card: a non-blocking fixed corner panel
 * with a real-time countdown and two ways out (pay the toll / give him toys).
 * The game keeps running behind it. Styles: grinchCard.css.
 */

import "./grinchCard.css";

import type { GameState, GrinchThreat } from "../../state/GameState";
import { getSellableStock } from "../../helpers/inventoryHelpers";
import { formatInt, formatMoney } from "../../helpers/formatHelpers";
import { t } from "../i18n/i18n";
import { toyName, toyIcon } from "../i18n/localize";

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

  const card = document.createElement("div");
  card.className = CARD_CLASS;
  card.innerHTML = `
    <div class="grinch-head">
      <span class="grinch-face">😈</span>
      <div class="grinch-head-text">
        <div class="grinch-name">${t("grinch.name")} <span class="grinch-secs" data-grinch-secs>—</span></div>
        <div class="grinch-taunt">${t(threat.taunt)}</div>
      </div>
    </div>
    <div class="grinch-threat">${t("grinch.threat", { pct: Math.round(threat.stealPct * 100) })}</div>
    <div class="grinch-actions">
      <button class="grinch-btn grinch-pay" data-grinch-pay type="button"></button>
      <button class="grinch-btn grinch-give" data-grinch-give type="button">
        <span class="grinch-give-main">${t("grinch.give")} ${toyIcon(threat.demandToy)} <span data-grinch-progress>0</span>/${formatInt(threat.demandQty)}</span>
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
    pay.textContent = t("grinch.pay", { toll: formatMoney(g.toll) });
    pay.disabled = state.resources.money < g.toll;
  }

  const stock = getSellableStock(state, g.demandToy);
  const progressEl = card.querySelector<HTMLElement>("[data-grinch-progress]");
  if (progressEl) progressEl.textContent = formatInt(g.demandDelivered);
  const haveEl = card.querySelector<HTMLElement>("[data-grinch-have]");
  if (haveEl) haveEl.textContent = t("grinch.have", { n: formatInt(stock), name: toyName(g.demandToy) });
  const give = card.querySelector<HTMLButtonElement>("[data-grinch-give]");
  if (give) give.disabled = stock <= 0;
}
