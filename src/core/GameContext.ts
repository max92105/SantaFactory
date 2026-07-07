/**
 * Shared types passed around the game: the systems bundle, the per-frame
 * view data, and the context handed to every UI page.
 */

import type { GameState } from "../state/GameState";
import type { DomRefs } from "../ui/domRegistry";

import type { TimeSystem, TimeView } from "../systems/TimeSystem";
import type { EconomySystem, EconomyView } from "../systems/EconomySystem";
import type { ProductionSystem, ProductionView } from "../systems/ProductionSystem";
import type { PipelineSystem, PipelineView } from "../systems/PipelineSystem";
import type { WageSystem } from "../systems/WageSystem";
import type { ShopSystem } from "../systems/ShopSystem";
import type { SaveSystem } from "../systems/SaveSystem";
import type { ModifierSystem } from "../systems/ModifierSystem";

/** All game systems, wired once in core/Game.ts. */
export type Systems = {
  time: TimeSystem;
  economy: EconomySystem;
  production: ProductionSystem;
  pipeline: PipelineSystem;
  wage: WageSystem;
  shop: ShopSystem;
  save: SaveSystem;
  modifier: ModifierSystem;
};

/** Read-only snapshot of system views, computed once per frame and shared by all pages. */
export type FrameViews = {
  time: TimeView;
  economy: EconomyView;
  production: ProductionView;
  pipeline: PipelineView;
  wagesDue: number;
  wageRuleText: string;
};

/** Everything a UI page needs to read state, trigger game actions, and refresh the screen. */
export type GameContext = {
  dom: DomRefs;
  systems: Systems;
  getState(): GameState;
  setState(state: GameState): void;
  /**
   * Rebuild all interactive lists (shop rows, selectors, pipeline controls)
   * and refresh every on-screen value. Call after any user action.
   */
  rebuildUI(): void;
};
