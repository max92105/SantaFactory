export function spawnSellFloat(layer: HTMLDivElement, text: string) {
  const el = document.createElement("div");
  el.className = "sell-float";
  el.textContent = text;

  layer.appendChild(el);

  el.addEventListener("animationend", () => {
    el.remove();
  });
}