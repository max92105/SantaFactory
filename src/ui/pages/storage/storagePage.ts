/**
 * storagePage — the "Storage" tab: finished-goods inventory and selling.
 * Markup: storagePage.html · Styles: storagePage.css
 * Logic: EconomySystem (sell rates + selling).
 */

import storagePageHtml from "./storagePage.html?raw";
import "./storagePage.css";

import type { Page } from "../Page";
import type { FrameViews, GameContext } from "../../../core/GameContext";
import { toyTypes, getToyType } from "../../../config/toyTypesConfig";
import { getSellableStock, ensureInventory } from "../../../helpers/inventoryHelpers";
import { formatInt, formatMoneyPrecise } from "../../../helpers/formatHelpers";
import { spawnSellFloat } from "../../components/floatingText";

export function createStoragePage(): Page {
  // Which toy type is currently selected for selling
  let currentSellType: string = toyTypes[0]?.id ?? "plushy";

  function buildSellTypeSelector(ctx: GameContext): void {
    const state = ctx.getState();
    const mods = ctx.systems.modifier.getModifiers(state);
    ctx.dom.sellTypeSelector.innerHTML = "";

    for (const t of toyTypes) {
      const rate = ctx.systems.economy.getSellRate(t.id, mods);
      const btn = document.createElement("button");
      btn.className = "sell-type-btn" + (t.id === currentSellType ? " active" : "");
      btn.dataset.sellType = t.id;
      btn.innerHTML = `${t.icon} ${t.name} <span class="sell-type-rate">${formatMoneyPrecise(rate)}</span>`;
      btn.onclick = () => {
        currentSellType = t.id;
        ctx.dom.sellSlider.value = "0";
        ctx.rebuildUI();
      };
      ctx.dom.sellTypeSelector.appendChild(btn);
    }
  }

  return {
    mount(container) {
      container.insertAdjacentHTML("beforeend", storagePageHtml);
    },

    bind(ctx) {
      const { dom } = ctx;

      // Live preview while dragging the slider
      dom.sellSlider.oninput = () => ctx.rebuildUI();

      // Fixed-amount quick buttons (10 / 100 / 1k / Max)
      dom.sellQuickButtons.forEach((btn) => {
        btn.onclick = () => {
          const max = getSellableStock(ctx.getState(), currentSellType);
          const raw = btn.dataset.sell;

          const next = raw === "max" ? max : Number(raw || 0);
          dom.sellSlider.value = String(Math.max(0, Math.min(next, max)));
          ctx.rebuildUI();
        };
      });

      // Percentage quick buttons (25% / 50% / 100%)
      dom.sellPctButtons.forEach((btn) => {
        btn.onclick = () => {
          const max = getSellableStock(ctx.getState(), currentSellType);
          const pct = Number(btn.dataset.pct || 0);
          const next = Math.floor(max * pct);

          dom.sellSlider.value = String(Math.max(0, Math.min(next, max)));
          ctx.rebuildUI();
        };
      });

      // Sell button
      dom.sellBtn.onclick = () => {
        const state = ctx.getState();
        const mods = ctx.systems.modifier.getModifiers(state);
        const stock = getSellableStock(state, currentSellType);

        const amount = Math.max(0, Math.min(Number(dom.sellSlider.value || 0), stock));
        if (amount <= 0) return;

        const earned = ctx.systems.economy.sellItems(state, mods, currentSellType, amount);

        dom.sellSlider.value = "0";
        spawnSellFloat(dom.sellFloatLayer, `+${formatMoneyPrecise(earned)}`);

        ctx.rebuildUI();
      };
    },

    rebuild(ctx) {
      buildSellTypeSelector(ctx);
    },

    renderFrame(ctx, views: FrameViews) {
      const state = ctx.getState();
      const { dom } = ctx;
      const sellRates = views.economy.sellRates;

      // Inventory overview (finished goods per toy type)
      dom.inventoryGrid.innerHTML = "";
      for (const t of toyTypes) {
        const inv = ensureInventory(state, t.id);
        const rate = sellRates.find((r) => r.toyType === t.id)?.rate ?? 0;
        const el = document.createElement("div");
        el.className = "inventory-item";
        el.innerHTML = `
          <span class="inventory-icon">${t.icon}</span>
          <div class="inventory-info">
            <span class="inventory-label">${t.name}</span>
            <strong class="inventory-value">${formatInt(inv.finished)}</strong>
          </div>
          <span class="inventory-rate">${formatMoneyPrecise(rate)}/ea</span>
        `;
        dom.inventoryGrid.appendChild(el);
      }

      // Sell slider bounds + live preview for the selected toy type
      const stock = getSellableStock(state, currentSellType);
      const current = Math.max(0, Math.min(Number(dom.sellSlider.value || 0), stock));

      dom.sellSlider.max = String(stock);
      if (Number(dom.sellSlider.value) > stock) dom.sellSlider.value = String(stock);

      dom.sellAmountLabel.textContent = formatInt(current);
      dom.sellUnitLabel.textContent = getToyType(currentSellType)?.name ?? "items";

      const sellRate = sellRates.find((r) => r.toyType === currentSellType)?.rate ?? 0;
      dom.sellPreviewMoney.textContent = formatMoneyPrecise(current * sellRate);
      dom.sellBtn.disabled = current <= 0;
    },
  };
}
