/**
 * shopPage — the "Upgrades" tab: new toys, hiring, upgrades.
 * Markup: shopPage.html · Styles: shopPage.css
 * Logic: ShopSystem (purchases); definitions in config/toyTypesConfig.ts,
 * config/producersConfig.ts and config/upgradesConfig.ts.
 */

import shopPageHtml from "./shopPage.html?raw";
import "./shopPage.css";

import type { Page } from "../Page";
import type { GameContext } from "../../../core/GameContext";
import { toyTypes } from "../../../config/toyTypesConfig";
import { producers } from "../../../config/producersConfig";
import { upgrades, describeUpgradeEffect } from "../../../config/upgradesConfig";
import { ELF_DAILY_WAGE } from "../../../config/wagesConfig";
import { getProducerCostForState } from "../../../helpers/costHelpers";
import { isToyUnlocked } from "../../../helpers/unlockHelpers";
import { formatMoney, formatMoneyPrecise } from "../../../helpers/formatHelpers";

export function createShopPage(): Page {
  return {
    mount(container) {
      container.insertAdjacentHTML("beforeend", shopPageHtml);
    },

    bind(ctx) {
      // Section sub-tabs (toys / hiring / upgrades)
      ctx.dom.shopTabs.forEach((btn) => {
        btn.onclick = () => {
          ctx.dom.shopTabs.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");

          const tab = btn.dataset.shop;
          ctx.dom.shopToys.classList.toggle("active", tab === "toys");
          ctx.dom.shopHiring.classList.toggle("active", tab === "hiring");
          ctx.dom.shopUpgrades.classList.toggle("active", tab === "upgrades");
        };
      });
    },

    rebuild(ctx) {
      buildToysList(ctx);
      buildProducersList(ctx);
      buildUpgradesList(ctx);
    },

    renderFrame() {
      // Lists refresh via rebuild() after every purchase/sale/wage event
    },
  };
}

/** Shared factory for one purchasable row (title / sub / meta + action button). */
function buildShopRow(opts: {
  icon: string;
  title: string;
  tag?: string;
  sub: string;
  meta: string;
  buttonLabel: string;
  disabled: boolean;
  onBuy?: () => void;
}): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "shop-row";

  const iconEl = document.createElement("div");
  iconEl.className = "shop-row-icon";
  iconEl.textContent = opts.icon;

  const info = document.createElement("div");
  info.className = "shop-row-info";
  info.innerHTML = `
    <div class="shop-row-title">${opts.title}${opts.tag ? ` <span class="shop-row-tag">${opts.tag}</span>` : ""}</div>
    <div class="shop-row-sub">${opts.sub}</div>
    <div class="shop-row-meta">${opts.meta}</div>
  `;

  const btn = document.createElement("button");
  btn.className = "shop-buy-btn";
  btn.textContent = opts.buttonLabel;
  btn.disabled = opts.disabled;
  if (opts.onBuy) btn.onclick = opts.onBuy;

  row.appendChild(iconEl);
  row.appendChild(info);
  row.appendChild(btn);
  return row;
}

/** One row per toy line: unlocked ones show as owned, locked ones are buyable. */
function buildToysList(ctx: GameContext): void {
  const state = ctx.getState();
  ctx.dom.toysList.innerHTML = "";

  for (const def of toyTypes) {
    const unlocked = isToyUnlocked(state, def.id);

    const row = buildShopRow({
      icon: def.icon,
      title: def.name,
      tag: unlocked ? "unlocked" : undefined,
      sub: unlocked
        ? "In production — craft it by hand or assign elves to its line."
        : "Unlock this toy line to produce and sell it.",
      meta: `Sells for ${formatMoneyPrecise(def.baseSellValue)} each (base)`,
      buttonLabel: unlocked ? "Unlocked" : `Unlock (${formatMoney(def.unlockCost)})`,
      disabled: unlocked || state.resources.money < def.unlockCost,
      onBuy: unlocked
        ? undefined
        : () => {
            ctx.systems.shop.buyToyUnlock(ctx.getState(), def.id);
            ctx.rebuildUI();
          },
    });

    ctx.dom.toysList.appendChild(row);
  }
}

/** One row per hire package with live cost (based on current elves). */
function buildProducersList(ctx: GameContext): void {
  const state = ctx.getState();
  ctx.dom.producersList.innerHTML = "";

  for (const def of producers) {
    const cost = getProducerCostForState(def, state);
    const totalWage = def.elvesProvided * ELF_DAILY_WAGE;

    const row = buildShopRow({
      icon: "🧝",
      title: def.name,
      sub: def.description,
      meta: `+${def.elvesProvided} ${def.elvesProvided > 1 ? "elves" : "elf"} • Wages: $${totalWage}/day`,
      buttonLabel: `Hire (${formatMoney(cost)})`,
      disabled: state.resources.money < cost,
      onBuy: () => {
        ctx.systems.shop.buyProducer(ctx.getState(), def.id);
        ctx.rebuildUI();
      },
    });
    row.setAttribute("data-producer-id", def.id);

    ctx.dom.producersList.appendChild(row);
  }
}

/** One row per upgrade; owned upgrades show as bought and stay disabled. */
function buildUpgradesList(ctx: GameContext): void {
  const state = ctx.getState();
  ctx.dom.upgradesList.innerHTML = "";

  for (const def of upgrades) {
    const owned = !!state.owned.upgrades[def.id];

    const row = buildShopRow({
      icon: "⬆️",
      title: def.name,
      tag: owned ? "owned" : undefined,
      sub: def.description,
      meta: `Effect: ${describeUpgradeEffect(def.effect)}`,
      buttonLabel: owned ? "Owned" : `Buy (${formatMoney(def.cost)})`,
      disabled: owned || state.resources.money < def.cost,
      onBuy: owned
        ? undefined
        : () => {
            ctx.systems.shop.buyUpgrade(ctx.getState(), def.id);
            ctx.rebuildUI();
          },
    });

    ctx.dom.upgradesList.appendChild(row);
  }
}
