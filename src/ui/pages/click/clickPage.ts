/**
 * clickPage — the "Click" tab: pick a toy type and hand-craft it.
 * Markup: clickPage.html · Styles: clickPage.css
 * Logic: ProductionSystem (gifts per click, click action).
 * The toy picker only shows unlocked toys and scrolls, so it scales to
 * any number of toy types.
 */

import clickPageHtml from "./clickPage.html?raw";
import "./clickPage.css";

import type { Page } from "../Page";
import type { FrameViews, GameContext } from "../../../core/GameContext";
import { getClickableToyTypes } from "../../../helpers/unlockHelpers";
import { getToyType } from "../../../config/toyTypesConfig";
import { ensureInventory } from "../../../helpers/inventoryHelpers";
import { formatInt, formatMoneyPrecise } from "../../../helpers/formatHelpers";
import { spawnClickFloat } from "../../components/floatingText";

export function createClickPage(): Page {
  return {
    mount(container) {
      container.insertAdjacentHTML("beforeend", clickPageHtml);
    },

    bind(ctx) {
      ctx.dom.makeGiftBtn.onclick = () => {
        const state = ctx.getState();
        const mods = ctx.systems.modifier.getModifiers(state);

        const amount = ctx.systems.production.makeClick(state, mods);
        spawnClickFloat(ctx.dom.floatLayer, `+${amount}`);

        ctx.rebuildUI();
      };
    },

    rebuild(ctx) {
      buildToySelector(ctx);
    },

    renderFrame(ctx, views: FrameViews) {
      const state = ctx.getState();
      ctx.dom.clickGpc.textContent = formatInt(views.production.giftsPerClick);

      const selectedToy = getToyType(state.selectedClickToyType);
      if (selectedToy) {
        ctx.dom.makeGiftBtn.textContent = selectedToy.icon;
        ctx.dom.clickToyName.textContent = selectedToy.name;
        ctx.dom.clickToyValue.textContent = `${formatMoneyPrecise(selectedToy.baseSellValue)} each`;
        ctx.dom.clickStock.textContent = formatInt(ensureInventory(state, selectedToy.id).finished);
      }
    },
  };
}

/** One tray slot per hand-craftable toy; clicking selects what the big button crafts. */
function buildToySelector(ctx: GameContext): void {
  const state = ctx.getState();
  const clickable = getClickableToyTypes(ctx.getState());
  ctx.dom.clickToySelector.innerHTML = "";

  // If the selected toy isn't hand-craftable, fall back to the first one that is
  if (!clickable.some((t) => t.id === state.selectedClickToyType) && clickable[0]) {
    state.selectedClickToyType = clickable[0].id;
  }

  for (const t of clickable) {
    const isActive = t.id === state.selectedClickToyType;
    const slot = document.createElement("button");
    slot.className = "toy-slot" + (isActive ? " active" : "");
    slot.dataset.toyType = t.id;
    slot.title = `${t.name} — ${formatMoneyPrecise(t.baseSellValue)} each`;
    slot.innerHTML = `
      <span class="toy-slot-icon">${t.icon}</span>
      <span class="toy-slot-name">${t.name}</span>
    `;
    slot.onclick = () => {
      ctx.getState().selectedClickToyType = t.id;
      ctx.rebuildUI();
      slot.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    };
    ctx.dom.clickToySelector.appendChild(slot);
  }
}
