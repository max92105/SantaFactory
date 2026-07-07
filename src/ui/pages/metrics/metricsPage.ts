/**
 * metricsPage — the "Metrics" tab: read-only dashboard of production,
 * economy, lifetime and wage numbers.
 * Markup: metricsPage.html · Styles: metricsPage.css
 */

import metricsPageHtml from "./metricsPage.html?raw";
import "./metricsPage.css";

import type { Page } from "../Page";
import type { FrameViews } from "../../../core/GameContext";
import { toyTypes } from "../../../config/toyTypesConfig";
import { ensureInventory, getTotalFinished } from "../../../helpers/inventoryHelpers";
import { formatInt, formatMoney, formatMoneyPrecise } from "../../../helpers/formatHelpers";

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

      // Production
      dom.mGpc.textContent = formatInt(views.production.giftsPerClick);
      dom.mGps.textContent = "—"; // TODO: surface pipeline output/sec here
      dom.mSellRate.textContent = formatMoneyPrecise(sellRates[0]?.rate ?? 0);

      // Economy
      dom.mGifts.textContent = formatInt(getTotalFinished(state));
      dom.mMoney.textContent = formatMoney(state.resources.money);

      // Net worth = cash + sell value of all finished goods
      let netWorth = state.resources.money;
      for (const t of toyTypes) {
        const inv = ensureInventory(state, t.id);
        const rate = sellRates.find((r) => r.toyType === t.id)?.rate ?? 0;
        netWorth += inv.finished * rate;
      }
      dom.mNetWorth.textContent = formatMoneyPrecise(netWorth);

      // Lifetime
      dom.mLifetimeGifts.textContent = formatInt(state.resources.lifetimeGifts);
      dom.mLifetimeSold.textContent = formatInt(state.stats.lifetimeSoldGifts);

      // Wages
      dom.mWagesDue.textContent = formatMoney(views.wagesDue);
      dom.mWageResult.textContent = state.meta.lastWageResult;
      dom.wageRuleText.textContent = views.wageRuleText;
    },
  };
}
