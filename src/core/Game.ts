/**
 * Game — the composition root. Mounts the UI, wires systems and pages
 * together, and drives the per-frame update/render cycle.
 *
 * Frame flow:  GameLoop tick → systems update state → renderFrame()
 * User action: page handler → system mutates state → ctx.rebuildUI()
 */

import { createGameLoop } from "./GameLoop";
import type { FrameViews, GameContext, Systems } from "./GameContext";
import { createInitialState, type GameState } from "../state/GameState";
import { SEASON_DAYS } from "../config/timeConfig";

import { createTimeSystem } from "../systems/TimeSystem";
import { createEconomySystem } from "../systems/EconomySystem";
import { createProductionSystem } from "../systems/ProductionSystem";
import { createPipelineSystem } from "../systems/PipelineSystem";
import { createWageSystem } from "../systems/WageSystem";
import { createShopSystem } from "../systems/ShopSystem";
import { createSaveSystem } from "../systems/SaveSystem";
import { createModifierSystem } from "../systems/ModifierSystem";

import { getDomRefs } from "../ui/domRegistry";
import { mountAppLayout, bindAppLayout, renderAppLayout } from "../ui/layout/appLayout";
import type { Page } from "../ui/pages/Page";
import { createClickPage } from "../ui/pages/click/clickPage";
import { createFactoryPage } from "../ui/pages/factory/factoryPage";
import { createShopPage } from "../ui/pages/shop/shopPage";
import { createStoragePage } from "../ui/pages/storage/storagePage";
import { createMetricsPage } from "../ui/pages/metrics/metricsPage";

export type Game = { start(): void };

export function createGame(): Game {
  // 1. Mount all markup (layout shell first, then each page into the tab area)
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app root element");
  mountAppLayout(root);

  const pages: Page[] = [
    createClickPage(),
    createFactoryPage(),
    createShopPage(),
    createStoragePage(),
    createMetricsPage(),
  ];

  const tabContent = document.getElementById("tabContent");
  if (!tabContent) throw new Error("Missing #tabContent container");
  for (const page of pages) page.mount(tabContent);

  // 2. Collect DOM references and create systems
  const dom = getDomRefs();

  let state: GameState = createInitialState();

  const systems: Systems = {
    time: createTimeSystem(),
    economy: createEconomySystem(),
    production: createProductionSystem(),
    pipeline: createPipelineSystem(),
    wage: createWageSystem(),
    shop: createShopSystem(),
    save: createSaveSystem(),
    modifier: createModifierSystem(),
  };

  const ctx: GameContext = {
    dom,
    systems,
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    rebuildUI,
  };

  function buildFrameViews(): FrameViews {
    const mods = systems.modifier.getModifiers(state);
    return {
      time: systems.time.getView(state),
      economy: systems.economy.getView(state, mods),
      production: systems.production.getView(state, mods),
      pipeline: systems.pipeline.getView(state, mods),
      wagesDue: systems.wage.calcDailyWages(state),
      wageRuleText: systems.wage.getWageRuleText(),
    };
  }

  /** Cheap value refresh — runs every frame. */
  function renderFrame() {
    const views = buildFrameViews();
    renderAppLayout(ctx, views);
    for (const page of pages) page.renderFrame(ctx, views);
  }

  /** Full refresh: rebuild interactive lists, then refresh values — runs on user actions. */
  function rebuildUI() {
    for (const page of pages) page.rebuild(ctx);
    renderFrame();
  }

  // 3. Wire event handlers
  bindAppLayout(ctx);
  for (const page of pages) page.bind(ctx);

  // 4. The game loop
  const loop = createGameLoop((dtSeconds) => {
    if (state.meta.isRunOver) return;

    const mods = systems.modifier.getModifiers(state);

    const timeResult = systems.time.update(state, dtSeconds);
    systems.pipeline.update(state, mods, dtSeconds);

    if (timeResult.dayEnded) {
      systems.wage.payEndOfDayWages(state);
      // Wages change money/elves, so shop buttons etc. must refresh
      rebuildUI();
    }

    if (state.time.day > SEASON_DAYS) state.meta.isRunOver = true;

    renderFrame();
  });

  return {
    start() {
      rebuildUI();
      loop.start(() => state.meta.isRunOver);
    },
  };
}
