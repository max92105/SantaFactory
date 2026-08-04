/**
 * conveyor — the throughput readout for a production step.
 *
 * A plain 0–100% progress bar stops meaning anything once a step finishes ten
 * items a second: the fill just strobes. So the bar changes what it shows based
 * on how fast the line is actually running:
 *
 *   < CONVEYOR_DISCRETE_RATE  → the real accumulator fill. Early game, where
 *                               one toy takes seconds, you watch it being made.
 *   ≥ CONVEYOR_DISCRETE_RATE  → a moving belt. The fill is meaningless at that
 *                               speed, so the stripes scroll instead and their
 *                               SPEED encodes the rate (faster line = faster
 *                               belt), with the number as the precise value.
 *   halted                    → stripes freeze and the belt greys out, so a
 *                               stopped line never looks like a running one.
 *
 * Styles: conveyor.css.
 */

import "./conveyor.css";

/** Below this many items/second the discrete fill is still readable. */
export const CONVEYOR_DISCRETE_RATE = 1.5;

/** Belt scroll period (seconds per stripe cycle) at the slowest / fastest ends.
 *  Clamped so a very fast line still reads as motion rather than a blur. */
const BELT_SLOWEST_PERIOD = 1.6;
const BELT_FASTEST_PERIOD = 0.18;

/** Rate at which the belt hits its fastest scroll — beyond this only the
 *  number keeps climbing, which keeps 50/s and 5000/s visually distinct from
 *  each other by label rather than by an unreadable strobe. */
const BELT_MAX_RATE = 40;

export type ConveyorState = {
  /** Items per second this step is currently producing. */
  rate: number;
  /** 0..1 accumulator toward the next item (only used at low rates). */
  progress: number;
  /** Line stopped for a reason the player must fix (broken / no room). */
  halted?: boolean;
};

/** Create a conveyor element. Feed it with `updateConveyor` each frame. */
export function createConveyor(): HTMLElement {
  const el = document.createElement("div");
  el.className = "conveyor";
  el.innerHTML = `
    <div class="conveyor-track">
      <div class="conveyor-belt" data-belt></div>
      <div class="conveyor-fill" data-fill></div>
    </div>
  `;
  return el;
}

/** Map a rate to a stripe period, so the belt visibly speeds up with output. */
function beltPeriod(rate: number): number {
  const k = Math.min(1, Math.max(0, (rate - CONVEYOR_DISCRETE_RATE) / (BELT_MAX_RATE - CONVEYOR_DISCRETE_RATE)));
  return BELT_SLOWEST_PERIOD + (BELT_FASTEST_PERIOD - BELT_SLOWEST_PERIOD) * k;
}

/** Per-frame refresh. Cheap: a class toggle, a width and a CSS variable. */
export function updateConveyor(el: HTMLElement, s: ConveyorState): void {
  const belt = el.querySelector<HTMLElement>("[data-belt]");
  const fill = el.querySelector<HTMLElement>("[data-fill]");
  if (!belt || !fill) return;

  const halted = !!s.halted;
  const running = !halted && s.rate > 0;
  const fast = running && s.rate >= CONVEYOR_DISCRETE_RATE;

  el.classList.toggle("halted", halted);
  el.classList.toggle("running", running);
  el.classList.toggle("fast", fast);

  if (fast) {
    // Belt mode: stripes carry the meaning, the fill stays out of the way.
    belt.style.animationDuration = `${beltPeriod(s.rate).toFixed(3)}s`;
    fill.style.width = "0%";
  } else {
    belt.style.animationDuration = "";
    fill.style.width = `${Math.floor(Math.min(1, Math.max(0, s.progress)) * 100)}%`;
  }
}
