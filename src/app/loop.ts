export type Loop = {
  start(shouldStop?: () => boolean): void;
};

export function createLoop(onTick: (dtSeconds: number) => void): Loop {
  let last = performance.now();

  function frame(now: number, shouldStop?: () => boolean) {
    if (shouldStop?.()) return;

    const dtMs = now - last;
    last = now;

    const dtSeconds = Math.min(dtMs / 1000, 0.25);

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