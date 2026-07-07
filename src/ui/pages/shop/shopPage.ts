/**
 * shopPage — the "Shop" tab: hire packages and upgrades.
 * Markup: shopPage.html · Styles: shopPage.css
 * Logic: ShopSystem (purchases); definitions in config/producersConfig.ts
 * and config/upgradesConfig.ts.
 */

import shopPageHtml from "./shopPage.html?raw";
import "./shopPage.css";

import type { Page } from "../Page";
import type { GameContext } from "../../../core/GameContext";
import { producers } from "../../../config/producersConfig";
import { upgrades, describeUpgradeEffect } from "../../../config/upgradesConfig";
import { getProducerCost } from "../../../helpers/costHelpers";
import { formatMoney } from "../../../helpers/formatHelpers";

export function createShopPage(): Page {
  return {
    mount(container) {
      container.insertAdjacentHTML("beforeend", shopPageHtml);
    },

    bind(ctx) {
      // Shop sub-tabs (workforce / upgrades / machines)
      ctx.dom.shopTabs.forEach((btn) => {
        btn.onclick = () => {
          ctx.dom.shopTabs.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");

          const tab = btn.dataset.shop;
          ctx.dom.shopWorkforce.classList.toggle("active", tab === "workforce");
          ctx.dom.shopUpgrades.classList.toggle("active", tab === "upgrades");
          ctx.dom.shopMachines.classList.toggle("active", tab === "machines");
        };
      });
    },

    rebuild(ctx) {
      buildProducersList(ctx);
      buildUpgradesList(ctx);
    },

    renderFrame() {
      // Lists refresh via rebuild() after every purchase/sale/wage event
    },
  };
}

/** One row per hire package with live cost and affordability. */
function buildProducersList(ctx: GameContext): void {
  const state = ctx.getState();
  ctx.dom.producersList.innerHTML = "";

  for (const def of producers) {
    const owned = state.owned.producers[def.id] ?? 0;
    const cost = getProducerCost(def, owned);
    const totalWage = def.elvesProvided * def.dailyWagePerElf;

    const row = document.createElement("div");
    row.className = "row";
    row.setAttribute("data-producer-id", def.id);

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="row-title">${def.name} <span style="opacity:.75; font-weight:600;">(owned: ${owned})</span></div>
      <div class="row-sub">${def.description}</div>
      <div class="row-meta">Elves: +${def.elvesProvided} • Wage: $${totalWage}/day</div>
    `;

    const btn = document.createElement("button");
    btn.textContent = `Hire (${formatMoney(cost)})`;
    btn.disabled = state.resources.money < cost;
    btn.onclick = () => {
      ctx.systems.shop.buyProducer(ctx.getState(), def.id);
      ctx.rebuildUI();
    };

    row.appendChild(left);
    row.appendChild(btn);
    ctx.dom.producersList.appendChild(row);
  }
}

/** One row per upgrade; owned upgrades show as bought and stay disabled. */
function buildUpgradesList(ctx: GameContext): void {
  const state = ctx.getState();
  ctx.dom.upgradesList.innerHTML = "";

  for (const def of upgrades) {
    const owned = !!state.owned.upgrades[def.id];

    const row = document.createElement("div");
    row.className = "row";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="row-title">${def.name} <span style="opacity:.75; font-weight:600;">${owned ? "(owned)" : ""}</span></div>
      <div class="row-sub">${def.description}</div>
      <div class="row-meta">Effect: ${describeUpgradeEffect(def.effect)}</div>
    `;

    const btn = document.createElement("button");
    btn.textContent = owned ? "Owned" : `Buy (${formatMoney(def.cost)})`;
    btn.disabled = owned || state.resources.money < def.cost;
    btn.onclick = () => {
      ctx.systems.shop.buyUpgrade(ctx.getState(), def.id);
      ctx.rebuildUI();
    };

    row.appendChild(left);
    row.appendChild(btn);
    ctx.dom.upgradesList.appendChild(row);
  }
}
