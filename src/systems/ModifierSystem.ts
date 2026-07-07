/**
 * ModifierSystem — folds all owned upgrades into one Modifiers object
 * that other systems consume. Add new effect types in config/upgradesConfig.ts;
 * the exhaustive switch below will force you to handle them here.
 */

import type { GameState } from "../state/GameState";
import { upgrades } from "../config/upgradesConfig";

export type Modifiers = {
  gpcFlat: number;
  gpcMult: number;

  gpsMult: number;
  producerOutputMult: number;
  producerSpeedMult: number;

  sellRateMult: number;
};

const DEFAULT_MODS: Modifiers = {
  gpcFlat: 0,
  gpcMult: 1,

  gpsMult: 1,
  producerOutputMult: 1,
  producerSpeedMult: 1,

  sellRateMult: 1,
};

export function createModifierSystem() {
  function getModifiers(state: GameState): Modifiers {
    const mods: Modifiers = { ...DEFAULT_MODS };

    for (const up of upgrades) {
      if (!state.owned.upgrades[up.id]) continue;

      const e = up.effect;
      switch (e.type) {
        case "gpc_flat":
          mods.gpcFlat += e.amount;
          break;
        case "gpc_mult":
          mods.gpcMult *= e.amount;
          break;

        case "gps_mult":
          mods.gpsMult *= e.amount;
          break;
        case "producer_output_mult":
          mods.producerOutputMult *= e.amount;
          break;
        case "producer_speed_mult":
          mods.producerSpeedMult *= e.amount;
          break;

        case "sell_rate_mult":
          mods.sellRateMult *= e.amount;
          break;

        default: {
          // Exhaustiveness guard (fails to compile when a new effect type is unhandled)
          const _never: never = e;
          void _never;
        }
      }
    }

    return mods;
  }

  return { getModifiers };
}

export type ModifierSystem = ReturnType<typeof createModifierSystem>;
