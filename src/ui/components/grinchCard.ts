/**
 * grinchCard — the Grinch's live heist card: a non-blocking fixed corner panel
 * with a real-time countdown and TWO ways out you can pay toward in any amount.
 * A "Make a deal…" button opens a picker where you choose how much CASH and/or
 * how many TOYS to hand over; he leaves the moment either the toll is paid off
 * or the toy demand is met. The game keeps running behind it.
 * Styles: grinchCard.css (card) + the shared .deliver-* modal shell.
 */

import "./grinchCard.css";
import grinchImg from "../../assets/icons/grinch.png";

import type { GameContext } from "../../core/GameContext";
import type { GameState } from "../../state/GameState";
import { getSellableStock } from "../../helpers/inventoryHelpers";
import { formatInt, formatMoney } from "../../helpers/formatHelpers";
import { createStepper } from "./stepper";
import { t } from "../i18n/i18n";
import { toyName, toyIcon } from "../i18n/localize";

const CARD_CLASS = "grinch-card";
const DEAL_CLASS = "grinch-deal-overlay";

export function grinchCardOpen(): boolean {
  return document.querySelector(`.${CARD_CLASS}`) !== null;
}

/** Remove the card AND any open deal modal (e.g. when the timer runs out). */
export function removeGrinchCard(): void {
  document.querySelector(`.${CARD_CLASS}`)?.remove();
  document.querySelector(`.${DEAL_CLASS}`)?.remove();
}

export function showGrinchCard(ctx: GameContext): void {
  removeGrinchCard();
  const threat = ctx.getState().grinch.active;
  if (!threat) return;

  const card = document.createElement("div");
  card.className = CARD_CLASS;
  card.innerHTML = `
    <div class="grinch-head">
      <img class="grinch-face" src="${grinchImg}" alt="" />
      <div class="grinch-head-text">
        <div class="grinch-name">${t("grinch.name")} <span class="grinch-secs" data-grinch-secs>—</span></div>
        <div class="grinch-taunt">${t(threat.taunt)}</div>
      </div>
    </div>
    <div class="grinch-threat">${t("grinch.threat", { pct: Math.round(threat.stealPct * 100) })}</div>
    <div class="grinch-progress">
      <div class="grinch-prog-row">
        <span class="grinch-prog-label">💰 ${t("grinch.tollLabel")}</span>
        <span class="grinch-prog-val" data-grinch-toll>—</span>
      </div>
      <div class="grinch-prog-row">
        <span class="grinch-prog-label">${toyIcon(threat.demandToy)} ${toyName(threat.demandToy)}</span>
        <span class="grinch-prog-val" data-grinch-demand>—</span>
      </div>
    </div>
    <div class="grinch-actions">
      <button class="grinch-btn grinch-deal" data-grinch-deal type="button">${t("grinch.makeDeal")}</button>
    </div>
  `;
  card.querySelector<HTMLButtonElement>("[data-grinch-deal]")!.onclick = () => openDealModal(ctx);
  document.body.appendChild(card);
}

/** Per-frame refresh: countdown + both progress readouts. */
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

  const tollEl = card.querySelector<HTMLElement>("[data-grinch-toll]");
  if (tollEl) tollEl.textContent = `${formatMoney(g.tollPaid)} / ${formatMoney(g.toll)}`;

  const demandEl = card.querySelector<HTMLElement>("[data-grinch-demand]");
  if (demandEl) demandEl.textContent = `${formatInt(g.demandDelivered)} / ${formatInt(g.demandQty)}`;
}

/**
 * The "make a deal" picker: choose a CASH amount (toward the toll) and/or a TOY
 * amount (toward the demand), each with a stepper. Confirming applies both; he
 * leaves if either condition is fully met. Reuses the shared .deliver-* shell.
 */
function openDealModal(ctx: GameContext): void {
  document.querySelector(`.${DEAL_CLASS}`)?.remove();

  const state = ctx.getState();
  const g = state.grinch.active;
  if (!g) return;

  const tollRemaining = Math.max(0, g.toll - g.tollPaid);
  const cashMax = Math.min(Math.floor(state.resources.money), tollRemaining);
  const demandRemaining = Math.max(0, g.demandQty - g.demandDelivered);
  const stock = getSellableStock(state, g.demandToy);
  const toyMax = Math.min(stock, demandRemaining);

  // Pre-fill the cash field to fully pay the toll when it's affordable (one
  // click clears him); otherwise start at 0 so nothing is spent by surprise.
  let cash = cashMax === tollRemaining ? tollRemaining : 0;
  let toys = 0;

  const overlay = document.createElement("div");
  overlay.className = `deliver-overlay ${DEAL_CLASS}`;
  const sheet = document.createElement("div");
  sheet.className = "deliver-sheet";
  overlay.appendChild(sheet);

  const close = () => overlay.remove();
  overlay.onclick = close;
  sheet.onclick = (e) => e.stopPropagation();

  const head = document.createElement("div");
  head.className = "deliver-head";
  head.innerHTML = `<span class="deliver-title">${t("grinch.dealTitle")}</span>`;
  const x = document.createElement("button");
  x.className = "deliver-close";
  x.setAttribute("aria-label", "Close");
  x.textContent = "✕";
  x.onclick = close;
  head.appendChild(x);
  sheet.appendChild(head);

  const sub = document.createElement("div");
  sub.className = "deliver-sub";
  sub.innerHTML = t("grinch.dealSub", { pct: Math.round(g.stealPct * 100) });
  sheet.appendChild(sub);

  const body = document.createElement("div");
  body.className = "grinch-deal-body";

  // Cash section
  const cashBlock = document.createElement("div");
  cashBlock.className = "grinch-deal-block";
  cashBlock.innerHTML = `<div class="grinch-deal-label">${t("grinch.dealCash", {
    paid: formatMoney(g.tollPaid),
    toll: formatMoney(g.toll),
    have: formatMoney(state.resources.money),
  })}</div>`;
  if (cashMax > 0) {
    cashBlock.appendChild(
      createStepper({
        value: cash,
        min: 0,
        max: cashMax,
        withMax: true,
        onChange: (v) => {
          cash = v;
          refresh();
        },
      })
    );
  } else {
    const none = document.createElement("div");
    none.className = "grinch-deal-none";
    none.textContent = t("grinch.dealNoCash");
    cashBlock.appendChild(none);
  }
  body.appendChild(cashBlock);

  // Toy section
  const toyBlock = document.createElement("div");
  toyBlock.className = "grinch-deal-block";
  toyBlock.innerHTML = `<div class="grinch-deal-label">${t("grinch.dealToys", {
    icon: toyIcon(g.demandToy),
    name: toyName(g.demandToy),
    given: formatInt(g.demandDelivered),
    qty: formatInt(g.demandQty),
    have: formatInt(stock),
  })}</div>`;
  if (toyMax > 0) {
    toyBlock.appendChild(
      createStepper({
        value: toys,
        min: 0,
        max: toyMax,
        withMax: true,
        onChange: (v) => {
          toys = v;
          refresh();
        },
      })
    );
  } else {
    const none = document.createElement("div");
    none.className = "grinch-deal-none";
    none.textContent = t("grinch.dealNoToys");
    toyBlock.appendChild(none);
  }
  body.appendChild(toyBlock);
  sheet.appendChild(body);

  const foot = document.createElement("div");
  foot.className = "deliver-foot";
  const summary = document.createElement("div");
  summary.className = "deliver-summary";
  foot.appendChild(summary);
  const actions = document.createElement("div");
  actions.className = "deliver-actions";
  const cancel = document.createElement("button");
  cancel.className = "deliver-cancel";
  cancel.textContent = t("deliver.cancel");
  cancel.onclick = close;
  const confirm = document.createElement("button");
  confirm.className = "deliver-confirm";
  confirm.onclick = () => {
    ctx.systems.grinch.makeDeal(ctx.getState(), cash, toys);
    close();
    ctx.rebuildUI();
  };
  actions.append(cancel, confirm);
  foot.appendChild(actions);
  sheet.appendChild(foot);

  function refresh(): void {
    const clears = g!.tollPaid + cash >= g!.toll || g!.demandDelivered + toys >= g!.demandQty;
    summary.innerHTML =
      cash > 0 || toys > 0
        ? t("grinch.dealSummary", { cash: formatMoney(cash), toys: formatInt(toys) }) +
          (clears ? `<span class="ok"> ${t("grinch.dealClears")}</span>` : "")
        : t("grinch.dealSummaryEmpty");
    confirm.textContent = t("grinch.dealConfirm");
    confirm.disabled = cash <= 0 && toys <= 0;
  }
  refresh();

  document.body.appendChild(overlay);
  sheet.querySelector<HTMLInputElement>(".stepper-input")?.focus();
}
