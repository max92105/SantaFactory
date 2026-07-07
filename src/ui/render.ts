import type { GameState } from "../state/GameState";
import { ensureInventory, getTotalFinished } from "../state/GameState";
import type { DomRefs } from "./dom";
import type { TimeView } from "../systems/TimeSystem";
import type { EconomyView } from "../systems/EconomySystem";
import type { ProductionView } from "../systems/ProductionSystem";
import type { PipelineView } from "../systems/PipelineSystem";
import { toyTypes } from "../data/toyTypes";
import { formatInt, formatMoney, formatMoneyPrecise } from "../utils/format";

export function render(
  dom: DomRefs,
  state: GameState,
  views: {
    time: TimeView;
    economy: EconomyView;
    production: ProductionView;
    pipeline: PipelineView;
    wagesDue: number;
    wageRuleText: string;
  },
  sellContext?: { type: string; label: string }
) {
  // HUD basics
  const totalFinished = getTotalFinished(state);
  dom.hudGifts.textContent = formatInt(totalFinished);
  dom.hudMoney.textContent = formatMoney(state.resources.money);
  dom.hudElves.textContent = formatInt(state.workforce.totalElves);

  // Gift breakdown dropdown (dynamic per toy type)
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

  // Click tab
  dom.clickGpc.textContent = formatInt(views.production.giftsPerClick);
  const selectedToy = toyTypes.find((t) => t.id === state.selectedClickToyType) ?? toyTypes[0];
  if (selectedToy) {
    dom.makeGiftBtn.textContent = selectedToy.icon;
  }

  // Footer status
  dom.statusText.textContent = state.meta.statusText;

  // Factory WIP grid (dynamic per toy type)
  dom.wipGrid.innerHTML = "";
  for (const t of toyTypes) {
    const inv = ensureInventory(state, t.id);
    for (const stage of ["raw", "assembled", "finished"] as const) {
      const stageIcons: Record<string, string> = { raw: "📦", assembled: "🔧", finished: "🎁" };
      const stageLabels: Record<string, string> = { raw: "Raw", assembled: "Assembled", finished: "Finished" };
      const el = document.createElement("div");
      el.className = "material";
      el.innerHTML = `
        <span class="material-icon">${stageIcons[stage]}</span>
        <span class="material-label">${t.icon} ${stageLabels[stage]}</span>
        <strong>${formatInt(inv[stage])}</strong>
      `;
      dom.wipGrid.appendChild(el);
    }
  }

  // Storage inventory (only finished, per toy type)
  dom.inventoryGrid.innerHTML = "";
  const sellRates = views.economy.sellRates;
  for (const t of toyTypes) {
    const inv = ensureInventory(state, t.id);
    const rateEntry = sellRates.find((r) => r.toyType === t.id);
    const rate = rateEntry?.rate ?? 0;
    const el = document.createElement("div");
    el.className = "inventory-item";
    el.innerHTML = `
      <span class="inventory-icon">${t.icon}</span>
      <div class="inventory-info">
        <span class="inventory-label">${t.name}</span>
        <strong class="inventory-value">${formatInt(inv.finished)}</strong>
      </div>
      <span class="inventory-rate">$${formatMoneyPrecise(rate, 2)}/ea</span>
    `;
    dom.inventoryGrid.appendChild(el);
  }

  // Sell slider bounds + preview (based on selected toy type)
  const sellType = sellContext?.type ?? toyTypes[0]?.id ?? "plushy";
  const inv = ensureInventory(state, sellType);
  const stock = Math.max(0, Math.floor(inv.finished));
  const current = Math.max(0, Math.min(Number(dom.sellSlider.value || 0), stock));

  dom.sellSlider.max = String(stock);
  if (Number(dom.sellSlider.value) > stock) dom.sellSlider.value = String(stock);

  dom.sellAmountLabel.textContent = formatInt(current);
  dom.sellUnitLabel.textContent = sellContext?.label ?? "items";
  const rateEntry = sellRates.find((r) => r.toyType === sellType);
  const sellRate = rateEntry?.rate ?? 0;
  const preview = current * sellRate;
  dom.sellPreviewMoney.textContent = formatMoneyPrecise(preview, 2);
  dom.sellBtn.disabled = current <= 0;

  // Metrics tab
  dom.mGpc.textContent = formatInt(views.production.giftsPerClick);
  dom.mGps.textContent = "—";

  const firstRate = sellRates[0]?.rate ?? 0;
  dom.mSellRate.textContent = formatMoneyPrecise(firstRate, 2);

  dom.mGifts.textContent = formatInt(totalFinished);
  dom.mMoney.textContent = formatMoney(state.resources.money);

  let netWorth = state.resources.money;
  for (const t of toyTypes) {
    const tInv = ensureInventory(state, t.id);
    const tRate = sellRates.find((r) => r.toyType === t.id)?.rate ?? 0;
    netWorth += tInv.finished * tRate;
  }
  dom.mNetWorth.textContent = formatMoneyPrecise(netWorth, 2);

  dom.mLifetimeGifts.textContent = formatInt(state.resources.lifetimeGifts);
  dom.mLifetimeSold.textContent = formatInt(state.stats.lifetimeSoldGifts);

  dom.mWagesDue.textContent = formatMoney(views.wagesDue);
  dom.mWageResult.textContent = state.meta.lastWageResult;
  dom.wageRuleText.textContent = views.wageRuleText;

  // Pipeline workforce
  dom.totalElves.textContent = formatInt(state.workforce.totalElves);
  dom.unassignedElves.textContent = formatInt(state.workforce.unassigned);

  // Pipeline progress bars
  for (const step of views.pipeline.steps) {
    const bar = document.querySelector<HTMLElement>(`[data-progress-step="${step.stepId}"]`);
    if (bar) {
      bar.style.width = `${Math.floor(step.progress * 100)}%`;
    }
    const row = document.querySelector<HTMLElement>(`[data-step-id="${step.stepId}"]`);
    if (row) {
      row.classList.toggle("bottlenecked", step.isBottlenecked);
    }
  }
}