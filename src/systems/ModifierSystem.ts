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
  /** Multiplies elf mistake chance (>1 worse, <1 better). Event-driven. */
  mistakeMult: number;
  /** Multiplies end-of-day wages (0 = free day). Event-driven. */
  wageMult: number;

  /** Click button size multiplier (Bigger Button upgrades). */
  clickButtonScale: number;
};

const DEFAULT_MODS: Modifiers = {
  gpcFlat: 0,
  gpcMult: 1,

  gpsMult: 1,
  producerOutputMult: 1,
  producerSpeedMult: 1,

  sellRateMult: 1,
  mistakeMult: 1,
  wageMult: 1,

  clickButtonScale: 1,
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

        case "click_button_scale":
          mods.clickButtonScale *= e.amount;
          break;

        case "unlock":
          break; // pure gate — checked elsewhere, no modifier effect

        default: {
          // Exhaustiveness guard (fails to compile when a new effect type is unhandled)
          const _never: never = e;
          void _never;
        }
      }
    }

    // Fold in active random-event timed modifiers (still within their day window).
    for (const a of state.events?.active ?? []) {
      if (a.expiresDay < state.time.day) continue;
      const m = a.mod;
      if (m.speed != null) mods.producerSpeedMult *= m.speed;
      if (m.output != null) mods.producerOutputMult *= m.output;
      if (m.sell != null) mods.sellRateMult *= m.sell;
      if (m.gpc != null) mods.gpcMult *= m.gpc;
      if (m.mistake != null) mods.mistakeMult *= m.mistake;
      if (m.wage != null) mods.wageMult *= m.wage;
    }

    return mods;
  }

  return { getModifiers };
}

export type ModifierSystem = ReturnType<typeof createModifierSystem>;
