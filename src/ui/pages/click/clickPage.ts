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
import { t } from "../../i18n/i18n";
import { toyName } from "../../i18n/localize";

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
        // Pop the "+N" where the button is NOW (it's about to dart away).
        const btn = ctx.dom.makeGiftBtn;
        spawnClickFloat(ctx.dom.floatLayer, `+${amount}`, { x: btn.offsetLeft, y: btn.offsetTop });

        // Catch me if you can — the button darts to a new spot every click.
        moveToRandomSpot(btn);

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
        ctx.dom.clickToyName.textContent = toyName(selectedToy.id);
        ctx.dom.clickToyValue.textContent = t("click.each", { value: formatMoneyPrecise(selectedToy.baseSellValue) });
        ctx.dom.clickStock.textContent = formatInt(ensureInventory(state, selectedToy.id).finished);
      }
    },
  };
}

/**
 * Jump a button to a random spot inside its arena (its offsetParent, i.e.
 * .click-area). Positions are CENTER coordinates via --btn-x/--btn-y, clamped
 * to half the button's size on every edge — it can never leave the arena, and
 * the arena itself always fits the viewport. Written per-button so future
 * bonus buttons can share it.
 */
function moveToRandomSpot(btn: HTMLElement): void {
  const arena = btn.offsetParent as HTMLElement | null;
  if (!arena) return;

  const aw = arena.clientWidth;
  const ah = arena.clientHeight;
  const halfW = btn.offsetWidth / 2;
  const halfH = btn.offsetHeight / 2;
  if (aw <= halfW * 2 || ah <= halfH * 2) return; // arena too small (hidden tab) — stay put

  const x = halfW + Math.random() * (aw - halfW * 2);
  const y = halfH + Math.random() * (ah - halfH * 2);
  btn.style.setProperty("--btn-x", `${Math.round(x)}px`);
  btn.style.setProperty("--btn-y", `${Math.round(y)}px`);
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
