/**
 * endScreen — the run-over overlay: victory (the Christmas Order was filled
 * before Christmas) or defeat (Christmas came first). Shown once by Game.ts
 * when meta.runOutcome lands; the loop stops right after, so this overlay is
 * the final screen of the run. Styles: endScreen.css.
 */

import "./endScreen.css";

import type { GameContext } from "../../core/GameContext";
import { formatInt } from "../../helpers/formatHelpers";
import { t } from "../i18n/i18n";

const END_OVERLAY_CLASS = "end-overlay";

export function showEndScreen(ctx: GameContext): void {
  if (document.querySelector(`.${END_OVERLAY_CLASS}`)) return;

  const state = ctx.getState();
  const view = ctx.systems.christmas.getView(state);
  const won = state.meta.runOutcome === "won";

  const overlay = document.createElement("div");
  overlay.className = `${END_OVERLAY_CLASS} ${won ? "won" : "lost"}`;

  const sheet = document.createElement("div");
  sheet.className = "end-sheet";
  overlay.appendChild(sheet);

  const pct = Math.floor(view.progress * 100);

  sheet.innerHTML = `
    <div class="end-icon">${won ? "🎅🎉" : "😢🎄"}</div>
    <div class="end-title">${won ? t("end.wonTitle") : t("end.lostTitle")}</div>
    <div class="end-sub">${
      won
        ? t("end.wonSub", { gifts: formatInt(view.total), day: state.time.day })
        : t("end.lostSub", { pct })
    }</div>
    <div class="end-stats">
      <div class="end-stat"><span>${t("end.giftsDelivered")}</span><strong>${formatInt(view.delivered)} / ${formatInt(view.total)}</strong></div>
      <div class="end-stat"><span>${t("end.lifetimeGifts")}</span><strong>${formatInt(state.resources.lifetimeGifts)}</strong></div>
      <div class="end-stat"><span>${t("end.ordersFilled")}</span><strong>${formatInt(state.stats.ordersCompleted)}</strong></div>
    </div>
    <button class="end-menu-btn">${t("end.backToMenu")}</button>
  `;

  sheet.querySelector<HTMLButtonElement>(".end-menu-btn")!.onclick = () => {
    overlay.remove();
    ctx.exitToMenu();
  };

  document.body.appendChild(overlay);
}
