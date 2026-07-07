import { createLoop } from "./loop";
import { createInitialState, type GameState } from "../state/GameState";
import { SEASON_DAYS } from "../state/defaults";

import { createTimeSystem } from "../systems/TimeSystem";
import { createEconomySystem } from "../systems/EconomySystem";
import { createProductionSystem } from "../systems/ProductionSystem";
import { createPipelineSystem } from "../systems/PipelineSystem";
import { createWageSystem } from "../systems/WageSystem";
import { createShopSystem } from "../systems/ShopSystem";
import { createSaveSystem } from "../systems/SaveSystem";
import { createModifierSystem } from "../systems/ModifierSystem";

import { getDom } from "../ui/dom";
import { render } from "../ui/render";
import { bindHandlers } from "../ui/handlers";

export type Game = { start(): void };

export function createGame(): Game {
  let state: GameState = createInitialState();

  const timeSystem = createTimeSystem();
  const economySystem = createEconomySystem();
  const productionSystem = createProductionSystem();
  const pipelineSystem = createPipelineSystem();
  const wageSystem = createWageSystem();
  const shopSystem = createShopSystem();
  const saveSystem = createSaveSystem();
  const modifierSystem = createModifierSystem();

  const dom = getDom();

  let handlerContext: { getCurrentSellType: () => string; getSellTypeLabel: () => string; rebuildSellButtons: () => void; rebuildClickToySelector: () => void } | null = null;

  // Data-only render (called every frame) - doesn't rebuild buttons
  const renderData = () => {
    const mods = modifierSystem.getModifiers(state);
    const sellType = handlerContext?.getCurrentSellType() ?? "plushy";
    const sellLabel = handlerContext?.getSellTypeLabel() ?? "items";
    render(dom, state, {
      time: timeSystem.getView(state),
      economy: economySystem.getView(state, mods),
      production: productionSystem.getView(state, mods),
      pipeline: pipelineSystem.getView(state, mods),
      wagesDue: wageSystem.calcDailyWages(state),
      wageRuleText: wageSystem.getWageRuleText(),
    }, { type: sellType, label: sellLabel });
  };

  // Full UI rebuild (called on user actions)
  const rebuildUI = () => {
    renderData();
    shopSystem.renderProducers(dom, state, rebuildUI);
    shopSystem.renderUpgrades(dom, state, rebuildUI);
    shopSystem.renderPipeline(dom, state, pipelineSystem, rebuildUI);
  };

  handlerContext = bindHandlers({
    dom,
    getState: () => state,
    setState: (next) => (state = next),
    systems: {
      economySystem,
      productionSystem,
      pipelineSystem,
      shopSystem,
      saveSystem,
      modifierSystem,
    },
    rerender: rebuildUI,
  });

  const loop = createLoop((dt) => {
    if (state.meta.isRunOver) return;

    const mods = modifierSystem.getModifiers(state);

    const timeResult = timeSystem.update(state, dt);
    productionSystem.update(state, mods, dt);
    pipelineSystem.update(state, mods, dt);

    if (timeResult.dayEnded) {
      wageSystem.payEndOfDayWages(state);

      // Rebuild UI after wage changes
      rebuildUI();
    }

    if (state.time.day > SEASON_DAYS) state.meta.isRunOver = true;

    renderData();
  });

  return {
    start() {
      // initial lists
      rebuildUI();

      loop.start(() => state.meta.isRunOver);
    },
  };
}