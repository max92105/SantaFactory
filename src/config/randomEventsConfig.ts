/**
 * Random events — every ~2 days the game freezes and offers THREE choices.
 * All three are the same polarity (all good, or all bad), so the pick is a real
 * decision, not a no-brainer. Effects are built from small primitives (below)
 * so new events are easy to add: drop an entry in `randomEvents`.
 *
 * Cadence + polarity odds live in the constants; the logic is in EventSystem.
 */

import type { TimedMod } from "../state/GameState";

/** Guarantee an event at least this often (max days between events). */
export const EVENT_MAX_GAP_DAYS = 2;
/** On non-forced days, chance an event fires anyway. */
export const EVENT_DAILY_CHANCE = 0.4;
/** Chance a fired event is GOOD (vs BAD). */
export const EVENT_GOOD_CHANCE = 0.5;
/** How many choices to show (of the chosen polarity). */
export const EVENT_CHOICES = 3;

export type EventEffect =
  // Flat cash +/- (clamped at 0). `netWorthPct` scales it with progress: the
  // magnitude becomes at least that share of the player's net worth, so a
  // $1,500 fine still stings on day 60. The sign of `amount` is kept.
  | { kind: "money"; amount: number; netWorthPct?: number }
  | { kind: "moneyPct"; pct: number } // cash ×(1+pct), e.g. -0.2 loses 20%
  // + finished gifts of a random unlocked toy. `daysWorth` scales it with
  // progress: at least that many days of the player's average output.
  | { kind: "gifts"; amount: number; daysWorth?: number }
  | { kind: "loseGiftsPct"; pct: number } // finished stock ×(1-pct) for every toy
  | { kind: "breakStations"; count: number } // break up to N random working stations
  | { kind: "fixAll" } // repair every broken station
  | { kind: "mendAll" } // turn all broken toys into finished gifts
  | { kind: "timed"; days: number; mod: TimedMod }; // temporary modifier for N days

export type RandomEventDef = {
  id: string;
  polarity: "good" | "bad";
  icon: string;
  title: string;
  /** Short player-facing summary of what this choice does. */
  desc: string;
  effects: EventEffect[];
};

export const randomEvents: RandomEventDef[] = [
  // ─────────────────────────────── GOOD ───────────────────────────────
  { id: "magic_surge", polarity: "good", icon: "✨", title: "Magic Surge",
    desc: "Enchanted tools — all production runs ×3 speed today.",
    effects: [{ kind: "timed", days: 1, mod: { speed: 3 } }] },
  { id: "toy_fad", polarity: "good", icon: "🧦", title: "Toy Fad",
    desc: "Collectors go wild — everything sells for ×1.8 today.",
    effects: [{ kind: "timed", days: 1, mod: { sell: 1.8 } }] },
  { id: "sugar_rush", polarity: "good", icon: "⚡", title: "Sugar Rush",
    desc: "Wired elves — clicks make ×3 gifts today.",
    effects: [{ kind: "timed", days: 1, mod: { gpc: 3 } }] },
  { id: "free_shipment", polarity: "good", icon: "📦", title: "Surprise Shipment",
    desc: "A mystery crate arrives: +{gifts} finished gifts.",
    effects: [{ kind: "gifts", amount: 250, daysWorth: 0.6 }] },
  { id: "investor", polarity: "good", icon: "💰", title: "Generous Investor",
    desc: "A backer drops +{amount} in your lap.",
    effects: [{ kind: "money", amount: 2000, netWorthPct: 0.1 }] },
  { id: "high_morale", polarity: "good", icon: "🎶", title: "High Morale",
    desc: "Inspired elves — mistakes cut in half today.",
    effects: [{ kind: "timed", days: 1, mod: { mistake: 0.5 } }] },
  { id: "overtime_grant", polarity: "good", icon: "🕗", title: "Overtime Grant",
    desc: "Extra hands — output ×1.5 for 2 days.",
    effects: [{ kind: "timed", days: 2, mod: { output: 1.5 } }] },
  { id: "volunteer_mechs", polarity: "good", icon: "🔧", title: "Volunteer Mechanics",
    desc: "Every broken station is repaired for free.",
    effects: [{ kind: "fixAll" }] },
  { id: "toy_drive", polarity: "good", icon: "🎁", title: "Charity Toy Drive",
    desc: "Donations pour in: +{amount} and +{gifts} gifts.",
    effects: [{ kind: "money", amount: 800, netWorthPct: 0.05 }, { kind: "gifts", amount: 100, daysWorth: 0.25 }] },
  { id: "wage_holiday", polarity: "good", icon: "🏖️", title: "Wage Holiday",
    desc: "Elves work for the fun of it — no wages tomorrow.",
    effects: [{ kind: "timed", days: 1, mod: { wage: 0 } }] },
  { id: "traveling_menders", polarity: "good", icon: "🪡", title: "Traveling Menders",
    desc: "Wandering menders fix every broken toy into a gift.",
    effects: [{ kind: "mendAll" }] },
  { id: "market_boom", polarity: "good", icon: "📈", title: "Market Boom",
    desc: "Prices soar — sell rate ×1.4 for 3 days.",
    effects: [{ kind: "timed", days: 3, mod: { sell: 1.4 } }] },

  // ─────────────────────────────── BAD ────────────────────────────────
  { id: "blizzard", polarity: "bad", icon: "🥶", title: "Blizzard",
    desc: "Frozen workshop — production ×0.5 for 2 days.",
    effects: [{ kind: "timed", days: 2, mod: { speed: 0.5 } }] },
  { id: "power_outage", polarity: "bad", icon: "🔌", title: "Power Outage",
    desc: "Lights out — production crawls at ×0.25 today.",
    effects: [{ kind: "timed", days: 1, mod: { speed: 0.25 } }] },
  { id: "sticky_fingers", polarity: "bad", icon: "🧤", title: "Butterfingers Day",
    desc: "Clumsy shift — mistakes doubled today.",
    effects: [{ kind: "timed", days: 1, mod: { mistake: 2 } }] },
  { id: "machine_jam", polarity: "bad", icon: "⚙️", title: "Machine Jam",
    desc: "Gears seize — 2 random stations break down.",
    effects: [{ kind: "breakStations", count: 2 }] },
  { id: "tax_man", polarity: "bad", icon: "🧾", title: "The Tax Man",
    desc: "Auditors take 20% of your cash.",
    effects: [{ kind: "moneyPct", pct: -0.2 }] },
  { id: "warehouse_mice", polarity: "bad", icon: "🐭", title: "Warehouse Mice",
    desc: "Vermin ruin 25% of your finished stock.",
    effects: [{ kind: "loseGiftsPct", pct: 0.25 }] },
  { id: "wage_demands", polarity: "bad", icon: "✊", title: "Wage Demands",
    desc: "Union deal — wages ×1.5 for 3 days.",
    effects: [{ kind: "timed", days: 3, mod: { wage: 1.5 } }] },
  { id: "market_slump", polarity: "bad", icon: "📉", title: "Market Slump",
    desc: "Prices crash — sell rate ×0.6 for 2 days.",
    effects: [{ kind: "timed", days: 2, mod: { sell: 0.6 } }] },
  { id: "sugar_crash", polarity: "bad", icon: "😴", title: "Sugar Crash",
    desc: "Groggy elves — clicks make half as many today.",
    effects: [{ kind: "timed", days: 1, mod: { gpc: 0.5 } }] },
  { id: "supply_shortage", polarity: "bad", icon: "🚚", title: "Supply Shortage",
    desc: "Thin materials — output ×0.5 for 2 days.",
    effects: [{ kind: "timed", days: 2, mod: { output: 0.5 } }] },
  { id: "safety_fine", polarity: "bad", icon: "🚨", title: "Safety Fine",
    desc: "Inspectors slap you with a {amount} fine.",
    effects: [{ kind: "money", amount: -1500, netWorthPct: 0.08 }] },
  { id: "gremlins", polarity: "bad", icon: "👺", title: "Gremlin Infestation",
    desc: "Chaos! 3 stations break and mistakes spike today.",
    effects: [{ kind: "breakStations", count: 3 }, { kind: "timed", days: 1, mod: { mistake: 1.5 } }] },
];

export function getRandomEvent(id: string): RandomEventDef | undefined {
  return randomEvents.find((e) => e.id === id);
}
