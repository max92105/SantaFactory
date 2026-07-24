/**
 * clickPage — the "Click" tab: pick a toy, then hand-craft it in the arena.
 *
 * The interactive surface (buttons, golden bonus, combo, overlap-triggering,
 * persisted positions) lives in components clickArena.ts; this page owns the
 * toy picker + the stats readout and just drives the arena each frame.
 * Markup: clickPage.html · Styles: clickPage.css
 */

import clickPageHtml from "./clickPage.html?raw";
import "./clickPage.css";

import type { Page } from "../Page";
import type { FrameViews, GameContext } from "../../../core/GameContext";
import { getClickableToyTypes } from "../../../helpers/unlockHelpers";
import { getToyType } from "../../../config/toyTypesConfig";
import { ensureInventory } from "../../../helpers/inventoryHelpers";
import { formatInt, formatMoneyPrecise } from "../../../helpers/formatHelpers";
import { t } from "../../i18n/i18n";
import { toyName } from "../../i18n/localize";
import { createClickArena, type ClickArena } from "./clickArena";

export function createClickPage(): Page {
  let arena: ClickArena | null = null;

  return {
    mount(container) {
      container.insertAdjacentHTML("beforeend", clickPageHtml);
    },

    bind(ctx) {
      arena = createClickArena(ctx, {
        arena: ctx.dom.clickArea,
        mainBtn: ctx.dom.makeGiftBtn,
        floatLayer: ctx.dom.floatLayer,
        combo: ctx.dom.clickCombo,
      });
    },

    rebuild(ctx) {
      buildToySelector(ctx);
      arena?.refresh(); // button set + sizes may have changed (upgrade bought)
    },

    renderFrame(ctx, views: FrameViews) {
      const state = ctx.getState();
      ctx.dom.clickGpc.textContent = formatInt(views.production.giftsPerClick);

      const selectedToy = getToyType(state.selectedClickToyType);
      if (selectedToy) {
        ctx.dom.clickToyName.textContent = toyName(selectedToy.id);
        ctx.dom.clickToyValue.textContent = t("click.each", { value: formatMoneyPrecise(selectedToy.baseSellValue) });
        ctx.dom.clickStock.textContent = formatInt(ensureInventory(state, selectedToy.id).finished);
      }

      arena?.update(); // golden lifecycle, combo decay, icons, button positions
    },
  };
}

/** One tray slot per hand-craftable toy; clicking selects what the buttons craft. */
function buildToySelector(ctx: GameContext): void {
  const state = ctx.getState();
  const clickable = getClickableToyTypes(ctx.getState());
  ctx.dom.clickToySelector.innerHTML = "";

  // If the selected toy isn't hand-craftable, fall back to the first one that is
  if (!clickable.some((t) => t.id === state.selectedClickToyType) && clickable[0]) {
    state.selectedClickToyType = clickable[0].id;
  }

  for (const toy of clickable) {
    const isActive = toy.id === state.selectedClickToyType;
    const slot = document.createElement("button");
    slot.className = "toy-slot" + (isActive ? " active" : "");
    slot.dataset.toyType = toy.id;
    slot.title = `${toyName(toy.id)} — ${t("click.each", { value: formatMoneyPrecise(toy.baseSellValue) })}`;
    slot.innerHTML = `
      <span class="toy-slot-icon">${toy.icon}</span>
      <span class="toy-slot-name">${toyName(toy.id)}</span>
    `;
    slot.onclick = () => {
      ctx.getState().selectedClickToyType = toy.id;
      ctx.rebuildUI();
      slot.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    };
    ctx.dom.clickToySelector.appendChild(slot);
  }
}
