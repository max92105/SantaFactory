/**
 * EventSystem — random "choose one of three" events.
 *
 * On a day change the game may fire an event (guaranteed at least every
 * EVENT_MAX_GAP_DAYS). It picks a polarity, samples three same-polarity choices,
 * stashes them in state.events.pending and FREEZES the game (meta.isPaused).
 * The UI shows a modal; the player's pick is applied via choose(). Timed
 * modifiers live in state.events.active and are folded in by ModifierSystem;
 * they expire on later day changes via expireMods().
 *
 * Catalog + tuning: config/randomEventsConfig.ts
 */

import type { GameState } from "../state/GameState";
import {
  randomEvents,
  getRandomEvent,
  EVENT_MAX_GAP_DAYS,
  EVENT_DAILY_CHANCE,
  EVENT_GOOD_CHANCE,
  EVENT_CHOICES,
  type EventEffect,
  type RandomEventDef,
} from "../config/randomEventsConfig";
import { pipelineSteps } from "../config/pipelineConfig";
import { addToStage, ensureInventory, getBrokenStock, removeBroken } from "../helpers/inventoryHelpers";
import { getUnlockedToyTypes, isToyUnlocked } from "../helpers/unlockHelpers";
import { isStationBroken, setStationBroken, brokenStepIds } from "../helpers/stationHelpers";
import { scaledMoney, scaledGifts } from "../helpers/progressHelpers";
import { formatInt, formatMoney } from "../helpers/formatHelpers";
import { t } from "../ui/i18n/i18n";
import { randomEventTitle, randomEventDesc } from "../ui/i18n/localize";

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick up to `n` distinct random items from a list. */
function sample<T>(items: T[], n: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) out.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  return out;
}

export function createEventSystem() {
  /** Resolve a money effect's real signed amount for the CURRENT state
   *  (progress-scaled when the effect declares netWorthPct). */
  function resolveMoney(state: GameState, e: Extract<EventEffect, { kind: "money" }>): number {
    const magnitude = e.netWorthPct ? scaledMoney(state, Math.abs(e.amount), e.netWorthPct) : Math.abs(e.amount);
    return e.amount < 0 ? -magnitude : magnitude;
  }

  /** Resolve a gifts effect's real count for the CURRENT state. */
  function resolveGifts(state: GameState, e: Extract<EventEffect, { kind: "gifts" }>): number {
    return e.daysWorth ? scaledGifts(state, e.amount, e.daysWorth) : e.amount;
  }

  /**
   * Display params for a choice's description ({amount}/{gifts} placeholders).
   * The game is frozen while the modal is up, so resolving again at apply time
   * yields the same numbers the player was shown.
   */
  function choiceParams(state: GameState, def: RandomEventDef): Record<string, string> {
    const params: Record<string, string> = {};
    for (const e of def.effects) {
      if (e.kind === "money") params.amount = formatMoney(Math.abs(resolveMoney(state, e)));
      if (e.kind === "gifts") params.gifts = formatInt(resolveGifts(state, e));
    }
    return params;
  }

  /**
   * Called on a day change: maybe start an event. Returns true if one fired
   * (in which case the game is now paused awaiting a choice).
   */
  function maybeTrigger(state: GameState): boolean {
    if (state.events.pending) return false; // already waiting
    state.events.daysSince += 1;

    const forced = state.events.daysSince >= EVENT_MAX_GAP_DAYS;
    if (!forced && Math.random() >= EVENT_DAILY_CHANCE) return false;

    const polarity: "good" | "bad" = Math.random() < EVENT_GOOD_CHANCE ? "good" : "bad";
    const pool = randomEvents.filter((e) => e.polarity === polarity);
    const picks = sample(pool, EVENT_CHOICES);
    if (picks.length === 0) return false;

    state.events.pending = {
      polarity,
      choices: picks.map((p) => ({
        id: p.id,
        icon: p.icon,
        title: p.title,
        desc: p.desc,
        params: choiceParams(state, p),
      })),
    };
    state.events.daysSince = 0;
    state.meta.isPaused = true;
    state.meta.statusText = polarity === "good" ? t("event.status.good") : t("event.status.bad");
    return true;
  }

  /** Apply the player's chosen option, clear the event and unfreeze the game. */
  function choose(state: GameState, choiceId: string): boolean {
    const pending = state.events.pending;
    if (!pending || !pending.choices.some((c) => c.id === choiceId)) return false;

    const def = getRandomEvent(choiceId);
    // Snapshot the scaled amounts BEFORE applying (applying changes the state
    // they're computed from) — the status line must echo what really happened.
    const params = def ? choiceParams(state, def) : {};
    if (def) applyEffects(state, def);

    state.events.pending = null;
    state.meta.isPaused = false;
    if (def) {
      state.meta.statusText = t("event.status.chosen", {
        icon: def.icon,
        title: randomEventTitle(def.id),
        desc: randomEventDesc(def.id, params),
      });
    }
    return true;
  }

  /** Drop timed modifiers that have run out (call on each day change). */
  function expireMods(state: GameState): void {
    state.events.active = state.events.active.filter((m) => m.expiresDay >= state.time.day);
  }

  function applyEffects(state: GameState, def: RandomEventDef): void {
    for (const e of def.effects) applyEffect(state, def, e);
  }

  function applyEffect(state: GameState, def: RandomEventDef, e: EventEffect): void {
    switch (e.kind) {
      case "money":
        state.resources.money = Math.max(0, state.resources.money + resolveMoney(state, e));
        break;
      case "moneyPct":
        state.resources.money = Math.max(0, Math.round(state.resources.money * (1 + e.pct)));
        break;
      case "gifts": {
        const toys = getUnlockedToyTypes(state);
        if (toys.length > 0) addToStage(state, toys[randInt(0, toys.length - 1)].id, "finished", resolveGifts(state, e));
        break;
      }
      case "loseGiftsPct":
        for (const t of getUnlockedToyTypes(state)) {
          const inv = ensureInventory(state, t.id);
          inv.finished = Math.floor(inv.finished * (1 - e.pct));
        }
        break;
      case "breakStations": {
        const candidates = pipelineSteps.filter(
          (s) => (!s.toyType || isToyUnlocked(state, s.toyType)) && !isStationBroken(state, s.id)
        );
        for (const step of sample(candidates, e.count)) setStationBroken(state, step.id, true);
        break;
      }
      case "fixAll":
        for (const id of brokenStepIds(state)) setStationBroken(state, id, false);
        break;
      case "mendAll":
        for (const t of getUnlockedToyTypes(state)) {
          const n = getBrokenStock(state, t.id);
          if (n > 0) {
            removeBroken(state, t.id, n);
            addToStage(state, t.id, "finished", n);
          }
        }
        break;
      case "timed":
        state.events.active.push({
          id: def.id,
          icon: def.icon,
          label: def.title,
          expiresDay: state.time.day + e.days - 1,
          mod: e.mod,
        });
        break;
    }
  }

  return { maybeTrigger, choose, expireMods };
}

export type EventSystem = ReturnType<typeof createEventSystem>;
