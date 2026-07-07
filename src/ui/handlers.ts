import type { DomRefs } from "./dom";
import type { GameState } from "../state/GameState";
import { createInitialState, ensureInventory } from "../state/GameState";
import { spawnFloatingText } from "./floatingText";
import { spawnSellFloat } from "./sellFloatingText.ts";
import { formatMoneyPrecise } from "../utils/format";
import { toyTypes, getToyType } from "../data/toyTypes";

export function bindHandlers(args: {
  dom: DomRefs;
  getState: () => GameState;
  setState: (s: GameState) => void;
  systems: {
    economySystem: any;
    productionSystem: any;
    pipelineSystem: any;
    shopSystem: any;
    saveSystem: any;
    modifierSystem: any;
  };
  rerender: () => void;
}) {
  const { dom, getState, setState, systems, rerender } = args;

  // Track which toy type is selected for selling (default: first toy type)
  let currentSellType: string = toyTypes[0]?.id ?? "plushy";

  // Build click toy type selector buttons dynamically
  function buildClickToyButtons() {
    const state = getState();
    dom.clickToySelector.innerHTML = "";
    for (const t of toyTypes) {
      const btn = document.createElement("button");
      btn.className = "click-toy-btn" + (t.id === state.selectedClickToyType ? " active" : "");
      btn.dataset.toyType = t.id;
      btn.innerHTML = `${t.icon} ${t.name}`;
      btn.onclick = () => {
        const s = getState();
        s.selectedClickToyType = t.id;
        buildClickToyButtons();
        rerender();
      };
      dom.clickToySelector.appendChild(btn);
    }
  }
  buildClickToyButtons();

  // Build sell type selector buttons dynamically
  function buildSellTypeButtons() {
    const state = getState();
    const mods = systems.modifierSystem.getModifiers(state);
    dom.sellTypeSelector.innerHTML = "";
    for (const t of toyTypes) {
      const rate = systems.economySystem.getSellRate(t.id, mods);
      const btn = document.createElement("button");
      btn.className = "sell-type-btn" + (t.id === currentSellType ? " active" : "");
      btn.dataset.sellType = t.id;
      btn.innerHTML = `${t.icon} ${t.name} <span class="sell-type-rate">$${formatMoneyPrecise(rate, 2)}</span>`;
      btn.onclick = () => {
        currentSellType = t.id;
        dom.sellSlider.value = "0";
        buildSellTypeButtons();
        rerender();
      };
      dom.sellTypeSelector.appendChild(btn);
    }
  }
  buildSellTypeButtons();

  // Main Tabs
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

  // Shop Sub-Tabs
  dom.shopTabs.forEach((btn) => {
    btn.onclick = () => {
      dom.shopTabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.shop;
      dom.shopWorkforce.classList.toggle("active", tab === "workforce");
      dom.shopUpgrades.classList.toggle("active", tab === "upgrades");
      dom.shopMachines.classList.toggle("active", tab === "machines");
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
  const toggleMenu = () => dom.menuPanel.classList.toggle("hidden");

  dom.menuBtn.onclick = (e) => {
    e.stopPropagation();
    toggleMenu();
  };

  dom.menuPanel.onclick = (e) => e.stopPropagation();
  document.addEventListener("click", () => closeMenu());

  // Sell slider live update
  dom.sellSlider.oninput = () => rerender();

  dom.sellQuickButtons.forEach((btn) => {
    btn.onclick = () => {
      const state = getState();
      const max = getStock(state, currentSellType);
      const raw = btn.dataset.sell;

      let next = 0;
      if (raw === "max") next = max;
      else next = Number(raw || 0);

      dom.sellSlider.value = String(Math.max(0, Math.min(next, max)));
      rerender();
    };
  });

  dom.sellPctButtons.forEach((btn) => {
    btn.onclick = () => {
      const state = getState();
      const max = getStock(state, currentSellType);
      const pct = Number(btn.dataset.pct || 0);
      const next = Math.floor(max * pct);

      dom.sellSlider.value = String(Math.max(0, Math.min(next, max)));
      rerender();
    };
  });

  // Sell button
  dom.sellBtn.onclick = () => {
    const state = getState();
    const mods = systems.modifierSystem.getModifiers(state);
    const stock = getStock(state, currentSellType);

    const amount = Math.max(0, Math.min(Number(dom.sellSlider.value || 0), stock));
    if (amount <= 0) return;

    const beforeMoney = state.resources.money;
    systems.economySystem.sellItems(state, mods, currentSellType, amount);
    const earned = state.resources.money - beforeMoney;

    dom.sellSlider.value = "0";

    spawnSellFloat(dom.sellFloatLayer, `+${formatMoneyPrecise(earned, 2)}`);

    buildSellTypeButtons();
    systems.shopSystem.renderProducers(dom, state, rerender);
    systems.shopSystem.renderUpgrades(dom, state, rerender);
    rerender();
  };

  // Main click - produces finished gifts (bootstrap)
  dom.makeGiftBtn.onclick = () => {
    const state = getState();
    const mods = systems.modifierSystem.getModifiers(state);

    const amount: number = systems.productionSystem.makeClick(state, mods);
    spawnFloatingText(dom.floatLayer, `+${amount}`);

    systems.shopSystem.renderProducers(dom, state, rerender);
    systems.shopSystem.renderUpgrades(dom, state, rerender);
    rerender();
  };

  // Menu actions
  dom.saveBtn.onclick = () => {
    closeMenu();
    const state = getState();
    systems.saveSystem.save(state);
    rerender();
  };

  dom.loadBtn.onclick = () => {
    closeMenu();
    const loaded = systems.saveSystem.load();
    if (!loaded) {
      const state = getState();
      state.meta.statusText = "No save found.";
      rerender();
      return;
    }

    setState(loaded);
    buildClickToyButtons();
    buildSellTypeButtons();
    systems.shopSystem.renderProducers(dom, loaded, rerender);
    systems.shopSystem.renderUpgrades(dom, loaded, rerender);
    rerender();
  };

  dom.resetBtn.onclick = () => {
    closeMenu();
    systems.saveSystem.clear();
    const fresh = createInitialState();
    fresh.meta.statusText = "Reset complete.";
    setState(fresh);

    buildClickToyButtons();
    buildSellTypeButtons();
    systems.shopSystem.renderProducers(dom, fresh, rerender);
    systems.shopSystem.renderUpgrades(dom, fresh, rerender);
    rerender();
  };

  function getStock(state: GameState, toyTypeId: string): number {
    return Math.max(0, Math.floor(ensureInventory(state, toyTypeId).finished));
  }

  function getSellTypeLabel(): string {
    const def = getToyType(currentSellType);
    return def?.name ?? "items";
  }

  function getCurrentSellType(): string {
    return currentSellType;
  }

  function rebuildSellButtons() {
    buildSellTypeButtons();
  }

  function rebuildClickToySelector() {
    buildClickToyButtons();
  }

  return { getCurrentSellType, getSellTypeLabel, rebuildSellButtons, rebuildClickToySelector };
}