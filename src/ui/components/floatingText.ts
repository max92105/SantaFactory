/**
 * floatingText — short-lived "+N" / "+$X" popups.
 * Styles: floatingText.css. Elements clean themselves up when the
 * CSS animation ends.
 */

import "./floatingText.css";

/** Green "+N" that floats up from a random spot near the click button. */
export function spawnClickFloat(layer: HTMLDivElement, text: string): void {
  const el = document.createElement("div");
  el.className = "float-text";
  el.textContent = text;

  // random-ish position near center of the layer
  const x = 50 + (Math.random() * 60 - 30);
  const y = 55 + (Math.random() * 30 - 15);

  el.style.left = `${x}%`;
  el.style.top = `${y}%`;

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
