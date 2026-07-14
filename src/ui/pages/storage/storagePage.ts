/**
 * storagePage — the "Storage" tab: a single searchable list of finished-goods
 * inventory with per-row selling, plus a "sell all" action. Built to scale to
 * many toys: rows scroll, a search box filters, and toys with stock sort to
 * the top so the actionable ones are always in view.
 * Markup: storagePage.html · Styles: storagePage.css
 * Logic: EconomySystem (sell rates + selling).
 */

import storagePageHtml from "./storagePage.html?raw";
import "./storagePage.css";

import type { Page } from "../Page";
import type { FrameViews, GameContext } from "../../../core/GameContext";
import type { ToyTypeDef } from "../../../config/toyTypesConfig";
import { getUnlockedToyTypes } from "../../../helpers/unlockHelpers";
import { getSellableStock, getBrokenStock, ensureInventory, getTotalBroken } from "../../../helpers/inventoryHelpers";
import { BROKEN_SALVAGE_RATE } from "../../../config/stationsConfig";
import { formatInt, formatMoneyPrecise } from "../../../helpers/formatHelpers";
import { spawnSellFloat } from "../../components/floatingText";
import { createStepper } from "../../components/stepper";

export function createStoragePage(): Page {
  // Search text persists across rebuilds (rebuild() recreates rows each action)
  let query = "";

  /** Unlocked toys with their current stock/rate, sorted stock-first (value desc). */
  function rankedToys(ctx: GameContext): { toy: ToyTypeDef; rate: number }[] {
    const state = ctx.getState();
    const mods = ctx.systems.modifier.getModifiers(state);
    return getUnlockedToyTypes(state)
      .map((toy) => {
        const stock = getSellableStock(state, toy.id);
        const rate = ctx.systems.economy.getSellRate(toy.id, mods);
        return { toy, rate, stock, value: stock * rate };
      })
      .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || b.value - a.value)
      .map(({ toy, rate }) => ({ toy, rate }));
  }

  function sell(ctx: GameContext, toyId: string, amount: number): number {
    if (amount <= 0) return 0;
    const state = ctx.getState();
    const mods = ctx.systems.modifier.getModifiers(state);
    return ctx.systems.economy.sellItems(state, mods, toyId, amount);
  }

  function salvage(ctx: GameContext, toyId: string, amount: number): number {
    if (amount <= 0) return 0;
    const state = ctx.getState();
    const mods = ctx.systems.modifier.getModifiers(state);
    return ctx.systems.economy.salvageBroken(state, mods, toyId, amount);
  }

  function flash(ctx: GameContext, earned: number): void {
    if (earned > 0) spawnSellFloat(ctx.dom.sellFloatLayer, `+${formatMoneyPrecise(earned)}`);
    ctx.rebuildUI();
  }

  /** Pick how many broken units to salvage, with a live payout preview. */
  function openSalvageModal(ctx: GameContext, toy: ToyTypeDef): void {
    document.querySelector(".deliver-overlay")?.remove();

    const state = ctx.getState();
    const mods = ctx.systems.modifier.getModifiers(state);
    const broken = getBrokenStock(state, toy.id);
    if (broken <= 0) return;
    const rate = ctx.systems.economy.getSalvageRate(toy.id, mods);

    let amount = broken; // default to salvaging everything

    const overlay = document.createElement("div");
    overlay.className = "deliver-overlay"; // reuse the responsive modal shell
    const sheet = document.createElement("div");
    sheet.className = "deliver-sheet";
    overlay.appendChild(sheet);

    const close = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    overlay.onclick = close;
    sheet.onclick = (e) => e.stopPropagation();

    const head = document.createElement("div");
    head.className = "deliver-head";
    head.innerHTML = `<span class="deliver-title">Salvage ${toy.icon} ${toy.name}</span>`;
    const x = document.createElement("button");
    x.className = "deliver-close";
    x.setAttribute("aria-label", "Close");
    x.textContent = "✕";
    x.onclick = close;
    head.appendChild(x);
    sheet.appendChild(head);

    const sub = document.createElement("div");
    sub.className = "deliver-sub";
    sub.innerHTML = `${formatInt(broken)} broken in stock · ${formatMoneyPrecise(rate)} each`;
    sheet.appendChild(sub);

    const body = document.createElement("div");
    body.className = "salvage-body";
    body.appendChild(
      createStepper({
        value: amount,
        min: 0,
        max: broken,
        withMax: true,
        onChange: (v) => {
          amount = v;
          refresh();
        },
      })
    );
    const value = document.createElement("div");
    value.className = "salvage-value";
    body.appendChild(value);
    sheet.appendChild(body);

    const foot = document.createElement("div");
    foot.className = "deliver-foot";
    const actions = document.createElement("div");
    actions.className = "deliver-actions";
    const cancel = document.createElement("button");
    cancel.className = "deliver-cancel";
    cancel.textContent = "Cancel";
    cancel.onclick = close;
    const confirm = document.createElement("button");
    confirm.className = "deliver-confirm";
    confirm.onclick = () => {
      const earned = salvage(ctx, toy.id, amount);
      close();
      flash(ctx, earned);
    };
    actions.append(cancel, confirm);
    foot.appendChild(actions);
    sheet.appendChild(foot);

    function refresh(): void {
      value.innerHTML = `You'll get <strong>${formatMoneyPrecise(amount * rate)}</strong>`;
      confirm.textContent = amount > 0 ? `Salvage ${formatInt(amount)}` : "Salvage";
      confirm.disabled = amount <= 0;
    }
    refresh();

    document.body.appendChild(overlay);
    sheet.querySelector<HTMLInputElement>(".stepper-input")?.focus();
  }

  function applyFilter(ctx: GameContext): void {
    const q = query.trim().toLowerCase();
    let visible = 0;
    ctx.dom.storageList.querySelectorAll<HTMLElement>(".stock-row").forEach((row) => {
      const match = q === "" || (row.dataset.name ?? "").includes(q);
      row.hidden = !match;
      if (match) visible += 1;
    });
    ctx.dom.storageEmpty.hidden = visible > 0;
  }

  function buildList(ctx: GameContext): void {
    const list = ctx.dom.storageList;
    list.innerHTML = "";

    for (const { toy, rate } of rankedToys(ctx)) {
      const row = document.createElement("div");
      row.className = "stock-row";
      row.dataset.toyType = toy.id;
      row.dataset.name = toy.name.toLowerCase();
      row.innerHTML = `
        <span class="stock-icon">${toy.icon}</span>
        <div class="stock-info">
          <div class="stock-name">${toy.name}</div>
          <div class="stock-rate">${formatMoneyPrecise(rate)} / ea</div>
          <div class="stock-broken" data-broken hidden></div>
        </div>
        <div class="stock-count"><strong data-count>0</strong><span>in stock</span></div>
        <div class="stock-value" data-value>$0.00</div>
        <div class="stock-actions">
          <button class="stock-btn stock-salvage" type="button" hidden>♻ Salvage</button>
          <button class="stock-btn stock-half" type="button">½</button>
          <button class="stock-btn stock-all" type="button">Sell all</button>
        </div>
      `;

      row.querySelector<HTMLButtonElement>(".stock-half")!.onclick = () => {
        const stock = getSellableStock(ctx.getState(), toy.id);
        flash(ctx, sell(ctx, toy.id, Math.floor(stock / 2)));
      };
      row.querySelector<HTMLButtonElement>(".stock-all")!.onclick = () => {
        const stock = getSellableStock(ctx.getState(), toy.id);
        flash(ctx, sell(ctx, toy.id, stock));
      };
      row.querySelector<HTMLButtonElement>(".stock-salvage")!.onclick = () => openSalvageModal(ctx, toy);

      list.appendChild(row);
    }
  }

  return {
    mount(container) {
      container.insertAdjacentHTML("beforeend", storagePageHtml);
    },

    bind(ctx) {
      ctx.dom.storageSearch.oninput = () => {
        query = ctx.dom.storageSearch.value;
        applyFilter(ctx);
      };

      ctx.dom.sellAllBtn.onclick = () => {
        let total = 0;
        for (const toy of getUnlockedToyTypes(ctx.getState())) {
          total += sell(ctx, toy.id, getSellableStock(ctx.getState(), toy.id));
        }
        flash(ctx, total);
      };
    },

    rebuild(ctx) {
      buildList(ctx);
      applyFilter(ctx);
    },

    renderFrame(ctx, views: FrameViews) {
      const state = ctx.getState();
      const rates = views.economy.sellRates;

      let totalStock = 0;
      let totalValue = 0;

      for (const toy of getUnlockedToyTypes(state)) {
        const inv = ensureInventory(state, toy.id);
        const stock = Math.floor(inv.finished);
        const broken = Math.floor(inv.broken);
        const rate = rates.find((r) => r.toyType === toy.id)?.rate ?? 0;
        totalStock += stock;
        totalValue += stock * rate;

        const row = ctx.dom.storageList.querySelector<HTMLElement>(`[data-toy-type="${toy.id}"]`);
        if (!row) continue;
        row.querySelector("[data-count]")!.textContent = formatInt(stock);
        row.querySelector("[data-value]")!.textContent = formatMoneyPrecise(stock * rate);

        const salvageValue = broken * rate * BROKEN_SALVAGE_RATE;
        const brokenEl = row.querySelector<HTMLElement>("[data-broken]")!;
        brokenEl.hidden = broken <= 0;
        brokenEl.textContent =
          broken > 0 ? `🔨 ${formatInt(broken)} broken · ♻ ${formatMoneyPrecise(salvageValue)} salvage` : "";

        // A row is "empty" (dimmed) only when it has nothing at all
        row.classList.toggle("empty", stock <= 0 && broken <= 0);
        // Selling needs finished stock; salvaging needs broken stock.
        row.querySelectorAll<HTMLButtonElement>(".stock-half, .stock-all").forEach((b) => (b.disabled = stock <= 0));
        const salvageBtn = row.querySelector<HTMLButtonElement>(".stock-salvage")!;
        salvageBtn.hidden = broken <= 0;
      }

      ctx.dom.storageTotalStock.textContent = formatInt(totalStock);
      ctx.dom.storageTotalValue.textContent = formatMoneyPrecise(totalValue);
      ctx.dom.storageTotalBroken.textContent = formatInt(getTotalBroken(state));
      ctx.dom.sellAllBtn.disabled = totalStock <= 0;
    },
  };
}
