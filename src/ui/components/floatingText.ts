/**
 * floatingText — short-lived "+N" / "+$X" popups.
 * Styles: floatingText.css. Elements clean themselves up when the
 * CSS animation ends.
 */

import "./floatingText.css";

/** Green "+N" that floats up near the click button. Pass `at` (pixel coords
 *  inside the layer) to pop it where the button actually is — it moves! */
export function spawnClickFloat(layer: HTMLDivElement, text: string, at?: { x: number; y: number }): void {
  const el = document.createElement("div");
  el.className = "float-text";
  el.textContent = text;

  if (at) {
    // jitter around the given point so rapid clicks don't stack exactly
    el.style.left = `${at.x + (Math.random() * 40 - 20)}px`;
    el.style.top = `${at.y + (Math.random() * 20 - 25)}px`;
  } else {
    // random-ish position near center of the layer
    el.style.left = `${50 + (Math.random() * 60 - 30)}%`;
    el.style.top = `${55 + (Math.random() * 30 - 15)}%`;
  }

  layer.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

/** Gold "+$X" that floats up from the sell button. */
export function spawnSellFloat(layer: HTMLDivElement, text: string): void {
  const el = document.createElement("div");
  el.className = "sell-float";
  el.textContent = text;

  layer.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}
