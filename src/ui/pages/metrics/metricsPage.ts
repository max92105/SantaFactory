/**
 * metricsPage — the "Metrics" tab: read-only dashboard of today's numbers,
 * production, economy, lifetime and wage stats.
 * Markup: metricsPage.html · Styles: metricsPage.css
 */

import metricsPageHtml from "./metricsPage.html?raw";
import "./metricsPage.css";

import type { Page } from "../Page";
import type { FrameViews } from "../../../core/GameContext";
import { getPipelineStep } from "../../../config/pipelineConfig";
import { getUnlockedToyTypes } from "../../../helpers/unlockHelpers";
import { ensureInventory, getTotalFinished, getTotalBroken } from "../../../helpers/inventoryHelpers";
import { formatInt, formatMoney, formatMoneyPrecise } from "../../../helpers/formatHelpers";
import { toyName } from "../../i18n/localize";
import { t } from "../../i18n/i18n";

export function createMetricsPage(): Page {
  return {
    mount(container) {
      container.insertAdjacentHTML("beforeend", metricsPageHtml);
    },

    bind() {
      // Read-only page — nothing to wire
    },

    rebuild() {
      // No dynamic lists — everything updates in renderFrame
    },

    renderFrame(ctx, views: FrameViews) {
      const state = ctx.getState();
      const { dom } = ctx;
      const sellRates = views.economy.sellRates;
      const unlocked = getUnlockedToyTypes(state);

      // Today
      dom.mDayMade.textContent = formatInt(state.dayStats.giftsMade);
      dom.mDaySold.textContent = formatInt(state.dayStats.giftsSold);
      dom.mDayEarned.textContent = formatMoneyPrecise(state.dayStats.moneyEarned);
      dom.mDayRuined.textContent = formatInt(state.dayStats.ruined);
      dom.mWagesDue.textContent = formatMoney(views.wagesDue);

      // Production
      dom.mGpc.textContent = formatInt(views.production.giftsPerClick);

      // Pipeline output: finished gifts per second across final steps
      let finishedPerSec = 0;
      for (const step of views.pipeline.steps) {
        const def = getPipelineStep(step.stepId);
        if (def?.outputStage === "finished") finishedPerSec += step.outputPerSecond;
      }
      dom.mGps.textContent = `${finishedPerSec.toFixed(2)}/s`;

      // Economy
      dom.mGifts.textContent = formatInt(getTotalFinished(state));
      dom.mMoney.textContent = formatMoney(state.resources.money);

      // Net worth = cash + sell value of all finished goods
      let netWorth = state.resources.money;
      for (const t of unlocked) {
        const inv = ensureInventory(state, t.id);
        const rate = sellRates.find((r) => r.toyType === t.id)?.rate ?? 0;
        netWorth += inv.finished * rate;
      }
      dom.mNetWorth.textContent = formatMoneyPrecise(netWorth);
      dom.mBrokenHeld.textContent = formatInt(getTotalBroken(state));

      // Per-toy sell rates (only unlocked toys)
      dom.mSellRates.innerHTML = "";
      for (const toy of unlocked) {
        const rate = sellRates.find((r) => r.toyType === toy.id)?.rate ?? 0;
        const row = document.createElement("div");
        row.className = "sell-rate-row";
        row.innerHTML = `<span>${toy.icon} ${toyName(toy.id)}</span><strong>${t("storage.each", {
          value: formatMoneyPrecise(rate),
        })}</strong>`;
        dom.mSellRates.appendChild(row);
      }

      // Lifetime
      dom.mLifetimeGifts.textContent = formatInt(state.resources.lifetimeGifts);
      dom.mLifetimeSold.textContent = formatInt(state.stats.lifetimeSoldGifts);
      dom.mLifetimeRuined.textContent = formatInt(state.stats.lifetimeRuined);
      dom.mOrdersFilled.textContent = formatInt(state.stats.ordersCompleted);

      // Wages
      dom.mWageResult.textContent = state.meta.lastWageResult;
      dom.wageRuleText.textContent = views.wageRuleText;
    },
  };
}
