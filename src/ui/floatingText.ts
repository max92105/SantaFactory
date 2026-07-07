export function spawnFloatingText(layer: HTMLDivElement, text: string) {
  const el = document.createElement("div");
  el.className = "float-text";
  el.textContent = text;

  // random-ish position near center
  const x = 50 + (Math.random() * 60 - 30);
  const y = 55 + (Math.random() * 30 - 15);

  el.style.left = `${x}%`;
  el.style.top = `${y}%`;

  layer.appendChild(el);

  el.addEventListener("animationend", () => {
    el.remove();
  });
}