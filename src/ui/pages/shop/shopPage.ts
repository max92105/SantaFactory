/**
 * shopPage — the "Upgrades" tab: a category rail (New Toys / Hiring / Upgrades)
 * beside a searchable, scrolling list. Built to scale to many toys, elf types
 * and upgrades — the rail stays put, the list scrolls, and a search box filters
 * the active category.
 * Markup: shopPage.html · Styles: shopPage.css
 * Logic: ShopSystem (purchases); definitions in config/toyTypesConfig.ts,
 * config/elfTypesConfig.ts and config/upgradesConfig.ts.
 */

import shopPageHtml from "./shopPage.html?raw";
import "./shopPage.css";

import type { Page } from "../Page";
import type { GameContext } from "../../../core/GameContext";
import { toyTypes } from "../../../config/toyTypesConfig";
import { elfTypes, elfCategories, type ElfTypeDef } from "../../../config/elfTypesConfig";
import { upgrades, describeUpgradeEffect } from "../../../config/upgradesConfig";
import { isUnlockRuleMet } from "../../../config/unlockRules";
import { getElfCost } from "../../../helpers/costHelpers";
import { countOfType } from "../../../helpers/workforceHelpers";
import { isToyUnlocked } from "../../../helpers/unlockHelpers";
import { formatCost, formatMoneyPrecise } from "../../../helpers/formatHelpers";
import { t } from "../../i18n/i18n";
import {
  toyName,
  elfName,
  elfDesc,
  elfCategoryName,
  elfCategoryDesc,
  upgradeName,
  upgradeDesc,
  slotName,
} from "../../i18n/localize";

type Category = "toys" | "hiring" | "upgrades";

const CATEGORY_TITLE: Record<Category, string> = { toys: "shop.toys", hiring: "shop.hiring", upgrades: "shop.upgrades" };
const CATEGORY_PLACEHOLDER: Record<Category, string> = {
  toys: "shop.searchToys",
  hiring: "shop.searchElves",
  upgrades: "shop.searchUpgrades",
};

export function createShopPage(): Page {
  // View state persists across rebuilds (rebuild() recreates rows every action)
  let activeCategory: Category = "toys";
  let query = "";

  function listFor(ctx: GameContext): HTMLElement {
    if (activeCategory === "hiring") return ctx.dom.elvesList;
    if (activeCategory === "upgrades") return ctx.dom.upgradesList;
    return ctx.dom.toysList;
  }

  function applyView(ctx: GameContext): void {
    ctx.dom.shopCats.forEach((b) => b.classList.toggle("active", b.dataset.shop === activeCategory));
    ctx.dom.shopViews.forEach((v) => v.classList.toggle("active", v.dataset.shop === activeCategory));
    ctx.dom.shopContentTitle.textContent = t(CATEGORY_TITLE[activeCategory]);
    ctx.dom.shopSearch.placeholder = t(CATEGORY_PLACEHOLDER[activeCategory]);
  }

  /** Hide rows in the active list that don't match the search; toggle empty state. */
  function applyFilter(ctx: GameContext): void {
    const q = query.trim().toLowerCase();
    let visible = 0;
    listFor(ctx)
      .querySelectorAll<HTMLElement>(".shop-row")
      .forEach((row) => {
        const match = q === "" || (row.dataset.name ?? "").includes(q);
        row.hidden = !match;
        if (match) visible += 1;
      });
    ctx.dom.shopEmpty.hidden = visible > 0;
  }

  return {
    mount(container) {
      container.insertAdjacentHTML("beforeend", shopPageHtml);
    },

    bind(ctx) {
      ctx.dom.shopCats.forEach((btn) => {
        btn.onclick = () => {
          activeCategory = (btn.dataset.shop as Category) ?? "toys";
          applyView(ctx);
          applyFilter(ctx);
        };
      });

      ctx.dom.shopSearch.oninput = () => {
        query = ctx.dom.shopSearch.value;
        applyFilter(ctx);
      };
    },

    rebuild(ctx) {
      buildToysList(ctx);
      buildElvesList(ctx);
      buildUpgradesList(ctx);
      applyView(ctx);
      applyFilter(ctx);
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
  searchKey: string;
  buttonLabel: string;
  disabled: boolean;
  onBuy?: () => void;
}): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "shop-row";
  row.dataset.name = opts.searchKey.toLowerCase();

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
      title: toyName(def.id),
      tag: unlocked ? t("shop.unlocked") : undefined,
      sub: unlocked ? t("shop.inProduction") : t("shop.unlockToy"),
      meta: t("shop.sellsFor", { value: formatMoneyPrecise(def.baseSellValue) }),
      searchKey: `${toyName(def.id)} ${def.name}`,
      buttonLabel: unlocked ? t("shop.unlockedBtn") : t("shop.unlockBtn", { cost: formatCost(def.unlockCost) }),
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

/** Format a small probability as a percentage (keeps precision for tiny odds). */
function formatPct(chance: number): string {
  const pct = chance * 100;
  const decimals = pct < 1 ? 2 : pct < 10 ? 1 : 0;
  return `${pct.toFixed(decimals)}%`;
}

/** Elves grouped by category, each row showing wage / ruin / break separately. */
function buildElvesList(ctx: GameContext): void {
  const state = ctx.getState();
  ctx.dom.elvesList.innerHTML = "";

  for (const cat of elfCategories) {
    // Locked crews (Maintenance / Repair) stay hidden until their upgrade is bought.
    if (cat.unlockUpgrade && !state.owned.upgrades[cat.unlockUpgrade]) continue;

    const inCategory = elfTypes.filter((e) => e.category === cat.id);
    if (inCategory.length === 0) continue;

    const header = document.createElement("div");
    header.className = "shop-group";
    header.innerHTML = `
      <span class="shop-group-name">${elfCategoryName(cat.id)}</span>
      <span class="shop-group-desc">${elfCategoryDesc(cat.id)}</span>
    `;
    ctx.dom.elvesList.appendChild(header);

    for (const def of inCategory) {
      ctx.dom.elvesList.appendChild(buildElfRow(ctx, def));
    }
  }
}

/** One elf row: icon + name + description, then separated stats + Hire button. */
function buildElfRow(ctx: GameContext, def: ElfTypeDef): HTMLDivElement {
  const state = ctx.getState();
  const cost = getElfCost(def, countOfType(state, def.id));

  // Mechanics and menders are "specialists": one speed stat, not ruin/break.
  const isSpecialist = def.role === "mechanic" || def.role === "mender";
  const row = document.createElement("div");
  row.className = "shop-row elf-row" + (isSpecialist ? " mechanic" : "");
  row.dataset.name = `${elfName(def.id)} ${elfDesc(def.id)} ${def.name}`.toLowerCase();
  row.dataset.elfType = def.id;

  const wageStat = `
    <div class="elf-stat">
      <span class="elf-stat-label">${t("shop.wage")}</span>
      <span class="elf-stat-value wage">${t("shop.wagePerDay", { n: `$${def.dailyWage}` })}</span>
    </div>`;
  const blocked = def.blockedSlots ?? [];
  const shiftStat = `
    <div class="elf-stat">
      <span class="elf-stat-label">${t("shop.shifts")}</span>
      <span class="elf-stat-value shifts">${t("shop.shiftsPerDay", { n: def.maxShifts })}</span>
      <span class="elf-stat-sub ${blocked.length ? "warn" : ""}">${
        blocked.length ? t("shop.noSlots", { slots: blocked.map((s) => slotName(s)).join(", ") }) : t("shop.anySlot")
      }</span>
    </div>`;

  // Specialists show their speed; workers show ruin + break chances.
  const midStats =
    def.role === "mechanic"
      ? `
    <div class="elf-stat">
      <span class="elf-stat-label">${t("shop.repairsIn")}</span>
      <span class="elf-stat-value repair">${def.repairTime}s</span>
    </div>`
      : def.role === "mender"
      ? `
    <div class="elf-stat">
      <span class="elf-stat-label">${t("shop.mendsIn")}</span>
      <span class="elf-stat-value repair">${def.refurbishTime}s</span>
    </div>`
      : `
    <div class="elf-stat">
      <span class="elf-stat-label">${t("shop.ruinsGifts")}</span>
      <span class="elf-stat-value ruin">${formatPct(def.mistakeChance)}</span>
    </div>
    <div class="elf-stat">
      <span class="elf-stat-label">${t("shop.breaksStation")}</span>
      <span class="elf-stat-value break">${formatPct(def.breakChance)}</span>
    </div>`;

  row.innerHTML = `
    <div class="shop-row-icon">${def.icon}</div>
    <div class="elf-main">
      <div class="shop-row-title">${elfName(def.id)}</div>
      <div class="shop-row-sub">${elfDesc(def.id)}</div>
    </div>
    ${wageStat}
    ${midStats}
    ${shiftStat}
  `;

  const btn = document.createElement("button");
  btn.className = "shop-buy-btn";
  btn.textContent = t("shop.hireBtn", { cost: formatCost(cost) });
  btn.disabled = state.resources.money < cost;
  btn.onclick = () => {
    ctx.systems.shop.buyElf(ctx.getState(), def.id);
    ctx.rebuildUI();
  };

  row.appendChild(btn);
  return row;
}

/** One row per upgrade; owned upgrades show as bought and stay disabled. */
function buildUpgradesList(ctx: GameContext): void {
  const state = ctx.getState();
  ctx.dom.upgradesList.innerHTML = "";

  for (const def of upgrades) {
    // Hide upgrades whose prerequisite isn't met yet (e.g. bike hand-building).
    if (!isUnlockRuleMet(state, def.unlock)) continue;

    const owned = !!state.owned.upgrades[def.id];

    const effectText = def.effect.type === "unlock" ? t("upgrade.effect.unlock") : describeUpgradeEffect(def.effect);
    const row = buildShopRow({
      icon: "⬆️",
      title: upgradeName(def.id),
      tag: owned ? t("shop.owned") : undefined,
      sub: upgradeDesc(def.id),
      meta: t("shop.effect", { effect: effectText }),
      searchKey: `${upgradeName(def.id)} ${upgradeDesc(def.id)} ${def.name}`,
      buttonLabel: owned ? t("shop.ownedBtn") : t("shop.buyBtn", { cost: formatCost(def.cost) }),
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
