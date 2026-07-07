/**
 * GameLoop — requestAnimationFrame ticker that feeds delta time (seconds)
 * to the game. Delta is capped at 0.25s so a background tab doesn't
 * fast-forward the game when it regains focus.
 */

export type GameLoop = {
  start(shouldStop?: () => boolean): void;
};

const MAX_DT_SECONDS = 0.25;

export function createGameLoop(onTick: (dtSeconds: number) => void): GameLoop {
  let last = performance.now();

  function frame(now: number, shouldStop?: () => boolean) {
    if (shouldStop?.()) return;

    const dtMs = now - last;
    last = now;

    const dtSeconds = Math.min(dtMs / 1000, MAX_DT_SECONDS);

    onTick(dtSeconds);
    requestAnimationFrame((t) => frame(t, shouldStop));
  }

  return {
    start(shouldStop) {
      last = performance.now();
      requestAnimationFrame((t) => frame(t, shouldStop));
    },
  };
}
