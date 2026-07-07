/**
 * clickPage — the "Click" tab: pick a toy type and hand-craft it.
 * Markup: clickPage.html · Styles: clickPage.css
 * Logic: ProductionSystem (gifts per click, click action).
 */

import clickPageHtml from "./clickPage.html?raw";
import "./clickPage.css";

import type { Page } from "../Page";
import type { FrameViews, GameContext } from "../../../core/GameContext";
import { toyTypes } from "../../../config/toyTypesConfig";
import { formatInt } from "../../../helpers/formatHelpers";
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
      ctx.dom.clickGpc.textContent = formatInt(views.production.giftsPerClick);

      const state = ctx.getState();
      const selectedToy = toyTypes.find((t) => t.id === state.selectedClickToyType) ?? toyTypes[0];
      if (selectedToy) {
        ctx.dom.makeGiftBtn.textContent = selectedToy.icon;
      }
    },
  };
}

/** One button per toy type; clicking selects what the big button produces. */
function buildToySelector(ctx: GameContext): void {
  const state = ctx.getState();
  ctx.dom.clickToySelector.innerHTML = "";

  for (const t of toyTypes) {
    const btn = document.createElement("button");
    btn.className = "click-toy-btn" + (t.id === state.selectedClickToyType ? " active" : "");
    btn.dataset.toyType = t.id;
    btn.innerHTML = `${t.icon} ${t.name}`;
    btn.onclick = () => {
      ctx.getState().selectedClickToyType = t.id;
      ctx.rebuildUI();
    };
    ctx.dom.clickToySelector.appendChild(btn);
  }
}
