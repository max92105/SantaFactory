/**
 * Calendar events — used by OrdersSystem (they modulate the daily order offers)
 * and shown in the Orders tab.
 *
 * Days are day-of-run (1..SEASON_DAYS). The run ends on Christmas (day 365), so
 * roughly: day 365 = Dec 25, count backwards for autumn/winter events, and the
 * early days sit in mid-winter/spring. Tweak startDay/endDay freely — these are
 * just placements. To add a holiday, drop a new entry in `gameEvents`.
 */

export type GameEvent = {
  id: string;
  name: string;
  icon: string;
  description: string;

  /** Inclusive day-of-run window the event is active. */
  startDay: number;
  endDay: number;

  /** Order rewards are multiplied by this while the event runs. */
  orderPayMult: number;
  /** Extra order offers per day during the event. */
  extraOffers: number;

  /** A toy that's in higher demand (favoured when generating offers). */
  featuredToy?: string;
};

export const gameEvents: GameEvent[] = [
  {
    id: "valentines",
    name: "Valentine's Day",
    icon: "💝",
    description: "Everyone wants something soft and cuddly.",
    startDay: 48,
    endDay: 52,
    orderPayMult: 1.4,
    extraOffers: 1,
    featuredToy: "plushy",
  },
  {
    id: "black_friday",
    name: "Black Friday",
    icon: "🛍️",
    description: "Shopping frenzy — orders everywhere, and they pay well.",
    startDay: 328,
    endDay: 331,
    orderPayMult: 1.6,
    extraOffers: 3,
  },
  {
    id: "christmas_rush",
    name: "Christmas Rush",
    icon: "🎄",
    description: "The final push before Christmas. Demand is through the roof.",
    startDay: 350,
    endDay: 365,
    orderPayMult: 1.8,
    extraOffers: 3,
  },
];

/** The event active on a given day-of-run, if any. */
export function getActiveEvent(day: number): GameEvent | undefined {
  return gameEvents.find((e) => day >= e.startDay && day <= e.endDay);
}
