/**
 * Game — the composition root. Mounts the UI, wires systems and pages
 * together, and drives the per-frame update/render cycle.
 *
 * Frame flow:  GameLoop tick → systems update state → renderFrame()
 * User action: page handler → system mutates state → ctx.rebuildUI()
 */

import { createGameLoop } from "./GameLoop";
import type { FrameViews, GameContext, Systems } from "./GameContext";
import type { GameState } from "../state/GameState";
import { SEASON_DAYS } from "../config/timeConfig";
import { brokenStationCount } from "../helpers/stationHelpers";
import { resetSpentShifts } from "../helpers/workforceHelpers";

import { createTimeSystem } from "../systems/TimeSystem";
import { createEconomySystem } from "../systems/EconomySystem";
import { createProductionSystem } from "../systems/ProductionSystem";
import { createPipelineSystem } from "../systems/PipelineSystem";
import { createWageSystem } from "../systems/WageSystem";
import { createShopSystem } from "../systems/ShopSystem";
import { createSaveSystem } from "../systems/SaveSystem";
import { createModifierSystem } from "../systems/ModifierSystem";
import { createOrdersSystem } from "../systems/OrdersSystem";

import { getDomRefs } from "../ui/domRegistry";
import { mountAppLayout, bindAppLayout, renderAppLayout } from "../ui/layout/appLayout";
import type { Page } from "../ui/pages/Page";
import { createClickPage } from "../ui/pages/click/clickPage";
import { createFactoryPage } from "../ui/pages/factory/factoryPage";
import { createShopPage } from "../ui/pages/shop/shopPage";
import { createStoragePage } from "../ui/pages/storage/storagePage";
import { createOrdersPage } from "../ui/pages/orders/ordersPage";
import { createMetricsPage } from "../ui/pages/metrics/metricsPage";

export type Game = { start(): void };

export type CreateGameOptions = {
  /** State to play — a loaded save, or a fresh createInitialState(). */
  state: GameState;
  /** Save slot this session writes to (autosave + manual save). */
  slot: number;
  /** Called when the player returns to the main menu (after a final save). */
  onExit: () => void;
};

/** How often the game autosaves while playing. */
const AUTOSAVE_INTERVAL_MS = 20000;

export function createGame(opts: CreateGameOptions): Game {
  // 1. Mount all markup (clear the menu / previous session first)
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app root element");
  root.innerHTML = "";
  mountAppLayout(root);

  const pages: Page[] = [
    createClickPage(),
    createFactoryPage(),
    createShopPage(),
    createStoragePage(),
    createOrdersPage(),
    createMetricsPage(),
  ];

  const tabContent = document.getElementById("tabContent");
  if (!tabContent) throw new Error("Missing #tabContent container");
  for (const page of pages) page.mount(tabContent);

  // 2. Collect DOM references and create systems
  const dom = getDomRefs();

  let state: GameState = opts.state;

  // Session lifecycle (autosave + return-to-menu)
  let stopped = false;
  let autosaveTimer: number | undefined;

  const systems: Systems = {
    time: createTimeSystem(),
    economy: createEconomySystem(),
    production: createProductionSystem(),
    pipeline: createPipelineSystem(),
    wage: createWageSystem(),
    shop: createShopSystem(),
    save: createSaveSystem(),
    modifier: createModifierSystem(),
    orders: createOrdersSystem(),
  };

  const ctx: GameContext = {
    dom,
    systems,
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    rebuildUI,
    saveGame,
    exitToMenu,
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
      activeEvent: systems.orders.currentEvent(state) ?? null,
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

    // A station breaking mid-tick changes the factory UI structure (repair
    // button appears), so rebuild when the broken count changes.
    const brokenBefore = brokenStationCount(state);

    const timeResult = systems.time.update(state, dtSeconds);
    systems.pipeline.update(state, mods, dtSeconds);

    // Rush orders live in real time: they pop up mid-day and expire fast.
    // Rebuild only when one spawns or lapses (the list changed).
    if (systems.orders.update(state, dtSeconds)) {
      rebuildUI();
    }

    // New day → refresh order offers / age active orders (rebuild lists if so)
    if (systems.orders.ensureDay(state)) {
      rebuildUI();
    }

    if (brokenStationCount(state) !== brokenBefore) {
      rebuildUI();
    }

    if (timeResult.dayEnded) {
      systems.wage.payEndOfDayWages(state);

      // Start a fresh "today" for the day-stat counters (Metrics tab)
      state.dayStats.giftsMade = 0;
      state.dayStats.giftsSold = 0;
      state.dayStats.moneyEarned = 0;
      state.dayStats.ruined = 0;
      state.dayStats.moneyStart = state.resources.money;

      // New day: spent shifts free up again
      resetSpentShifts(state);

      // Wages change money/elves, so shop buttons etc. must refresh
      rebuildUI();
    }

    if (state.time.day > SEASON_DAYS) state.meta.isRunOver = true;

    renderFrame();
  });

  // 5. Save / exit lifecycle
  function autoSave() {
    systems.save.save(state, opts.slot);
  }
  function saveGame() {
    const ok = systems.save.save(state, opts.slot);
    state.meta.statusText = ok ? "Game saved." : "Couldn't save — storage may be full.";
  }
  function onVisibility() {
    if (document.hidden) autoSave(); // save when the tab/app is backgrounded
  }
  function teardown() {
    stopped = true;
    if (autosaveTimer !== undefined) window.clearInterval(autosaveTimer);
    window.removeEventListener("beforeunload", autoSave);
    document.removeEventListener("visibilitychange", onVisibility);
  }
  function exitToMenu() {
    autoSave(); // never lose progress on the way out
    teardown();
    opts.onExit();
  }

  return {
    start() {
      systems.orders.ensureDay(state); // day-1 offers before the first render
      rebuildUI();

      // Autosave: on an interval, when backgrounded, and on refresh/close.
      autosaveTimer = window.setInterval(autoSave, AUTOSAVE_INTERVAL_MS);
      window.addEventListener("beforeunload", autoSave);
      document.addEventListener("visibilitychange", onVisibility);

      loop.start(() => stopped || state.meta.isRunOver);
    },
  };
}
