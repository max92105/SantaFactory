/**
 * appLayout — the app shell around the pages: header (menu, HUD resources,
 * time), main tab navigation, and the status footer.
 * Markup: appLayout.html · Styles: appLayout.css
 */

import appLayoutHtml from "./appLayout.html?raw";
import "./appLayout.css";

import type { FrameViews, GameContext } from "../../core/GameContext";
import { createInitialState } from "../../state/GameState";
import { ensureInventory, getTotalFinished } from "../../helpers/inventoryHelpers";
import { toyTypes } from "../../config/toyTypesConfig";
import { formatInt, formatMoney } from "../../helpers/formatHelpers";

/** Inject the layout shell into the app root. Must run before any page mounts. */
export function mountAppLayout(root: HTMLElement): void {
  root.innerHTML = appLayoutHtml;
}

/** Wire menu, tab switching, gifts dropdown and save/load/reset. */
export function bindAppLayout(ctx: GameContext): void {
  const { dom, systems } = ctx;

  // Main tabs
  dom.tabButtons.forEach((btn) => {
    btn.onclick = () => {
      dom.tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      dom.tabClick.classList.toggle("active", tab === "click");
      dom.tabFactory.classList.toggle("active", tab === "factory");
      dom.tabShop.classList.toggle("active", tab === "shop");
      dom.tabStorage.classList.toggle("active", tab === "storage");
      dom.tabMetrics.classList.toggle("active", tab === "metrics");
    };
  });

  // Gifts dropdown toggle
  dom.giftsResource.onclick = (e) => {
    e.stopPropagation();
    dom.giftsDropdown.classList.toggle("open");
  };
  document.addEventListener("click", () => {
    dom.giftsDropdown.classList.remove("open");
  });

  // Menu toggle
  const closeMenu = () => dom.menuPanel.classList.add("hidden");

  dom.menuBtn.onclick = (e) => {
    e.stopPropagation();
    dom.menuPanel.classList.toggle("hidden");
  };
  dom.menuPanel.onclick = (e) => e.stopPropagation();
  document.addEventListener("click", () => closeMenu());

  // Menu actions
  dom.saveBtn.onclick = () => {
    closeMenu();
    systems.save.save(ctx.getState());
    ctx.rebuildUI();
  };

  dom.loadBtn.onclick = () => {
    closeMenu();
    const loaded = systems.save.load();
    if (!loaded) {
      ctx.getState().meta.statusText = "No save found.";
      ctx.rebuildUI();
      return;
    }
    ctx.setState(loaded);
    ctx.rebuildUI();
  };

  dom.resetBtn.onclick = () => {
    closeMenu();
    systems.save.clear();
    const fresh = createInitialState();
    fresh.meta.statusText = "Reset complete.";
    ctx.setState(fresh);
    ctx.rebuildUI();
  };
}

/** Per-frame refresh of the HUD (resources, gift breakdown, time) and status bar. */
export function renderAppLayout(ctx: GameContext, views: FrameViews): void {
  const { dom } = ctx;
  const state = ctx.getState();

  dom.hudGifts.textContent = formatInt(getTotalFinished(state));
  dom.hudMoney.textContent = formatMoney(state.resources.money);
  dom.hudElves.textContent = formatInt(state.workforce.totalElves);

  // Gift breakdown dropdown (per toy type)
  dom.giftsDropdown.innerHTML = "";
  for (const t of toyTypes) {
    const inv = ensureInventory(state, t.id);
    const item = document.createElement("div");
    item.className = "dropdown-item";
    item.innerHTML = `<span>${t.icon} ${t.name} (finished)</span><strong>${formatInt(inv.finished)}</strong>`;
    dom.giftsDropdown.appendChild(item);
  }

  dom.hudDay.textContent = String(views.time.day);
  dom.hudTimeOfDay.textContent = views.time.timeOfDayLabel;
  dom.timeBarFill.style.width = `${Math.floor(views.time.dayProgress * 100)}%`;

  dom.statusText.textContent = state.meta.statusText;
}
