/**
 * shopPage — the "Upgrades" tab. Two views behind a small rail:
 *
 *   Progression — every toy line and upgrade as one connected, zoomable MAP
 *                 (components/techTreeView.ts over helpers/techTree.ts). This
 *                 replaced two flat lists of ~50 toys and ~90 upgrades, where
 *                 nothing showed how anything related to anything else.
 *   Hiring      — still a plain searchable list: you buy elves over and over,
 *                 so they're a shop, not a one-time unlock to navigate to.
 *
 * Markup: shopPage.html · Styles: shopPage.css
 * Logic: ShopSystem (purchases); definitions in config/toyTypesConfig.ts,
 * config/elfTypesConfig.ts and config/upgradesConfig.ts.
 */

import shopPageHtml from "./shopPage.html?raw";
import "./shopPage.css";

import type { Page } from "../Page";
import type { GameContext } from "../../../core/GameContext";
import { elfTypes, elfCategories, type ElfTypeDef } from "../../../config/elfTypesConfig";
import { getElfCost } from "../../../helpers/costHelpers";
import { countOfType } from "../../../helpers/workforceHelpers";
import { elfIconHtml } from "../../elfIcons";
import { formatCost } from "../../../helpers/formatHelpers";
import { createTechTreeView, type TechTreeView } from "../../components/techTreeView";
import { t } from "../../i18n/i18n";
import { elfName, elfDesc, elfCategoryName, elfCategoryDesc, slotName, elfRuleChips } from "../../i18n/localize";

type Category = "tree" | "hiring";

const CATEGORY_TITLE: Record<Category, string> = { tree: "shop.tree", hiring: "shop.hiring" };

export function createShopPage(): Page {
  // View state persists across rebuilds (rebuild() recreates rows every action)
  let activeCategory: Category = "tree";
  let query = "";
  let tree: TechTreeView | null = null;

  function applyView(ctx: GameContext): void {
    ctx.dom.shopCats.forEach((b) => b.classList.toggle("active", b.dataset.shop === activeCategory));
    ctx.dom.shopViews.forEach((v) => v.classList.toggle("active", v.dataset.shop === activeCategory));
    ctx.dom.shopContentTitle.textContent = t(CATEGORY_TITLE[activeCategory]);
    // The map has its own navigation, so the search box only serves Hiring.
    const searching = activeCategory === "hiring";
    ctx.dom.shopSearch.hidden = !searching;
    ctx.dom.shopSearch.placeholder = t("shop.searchElves");
    if (!searching) ctx.dom.shopEmpty.hidden = true;
  }

  /** Hide rows in the hiring list that don't match the search; toggle empty state. */
  function applyFilter(ctx: GameContext): void {
    if (activeCategory !== "hiring") return;
    const q = query.trim().toLowerCase();
    let visible = 0;
    ctx.dom.elvesList.querySelectorAll<HTMLElement>(".shop-row").forEach((row) => {
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
      tree = createTechTreeView(ctx, ctx.dom.techTreeHost);

      ctx.dom.shopCats.forEach((btn) => {
        btn.onclick = () => {
          activeCategory = (btn.dataset.shop as Category) ?? "tree";
          applyView(ctx);
          applyFilter(ctx);
          // The map can only measure itself once its panel is actually visible.
          if (activeCategory === "tree") tree?.rebuild();
        };
      });

      ctx.dom.shopSearch.oninput = () => {
        query = ctx.dom.shopSearch.value;
        applyFilter(ctx);
      };
    },

    rebuild(ctx) {
      buildElvesList(ctx);
      tree?.rebuild();
      applyView(ctx);
      applyFilter(ctx);
    },

    renderFrame() {
      // Hiring rows refresh via rebuild(); the map only needs its affordability
      // outlines retouched as money moves.
      tree?.renderFrame();
    },
  };
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

  // Work rules as chips, straight from helpers/elfRules.ts — the exact same
  // list (and colours) the crew console shows, so what you read when hiring is
  // what you read when scheduling.
  const rules = elfRuleChips(def.id);
  const traitsHtml = rules.length
    ? `<div class="elf-traits">${rules
        .map((r) => `<span class="rule-chip tone-${r.tone}">${r.icon} ${r.text}</span>`)
        .join("")}</div>`
    : "";

  row.innerHTML = `
    <div class="shop-row-icon">${elfIconHtml(def.id, def.icon)}</div>
    <div class="elf-main">
      <div class="shop-row-title">${elfName(def.id)}</div>
      <div class="shop-row-sub">${elfDesc(def.id)}</div>
      ${traitsHtml}
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
