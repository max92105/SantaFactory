/**
 * mainMenu — the title screen shown before a game starts. Offers save slots
 * (continue / new game / delete). Selecting a slot boots the game into it.
 * Markup is built here; styles in mainMenu.css.
 */

import "./mainMenu.css";

import type { SaveSystem, SlotSummary } from "../../systems/SaveSystem";
import { SLOT_COUNT } from "../../config/saveConfig";
import { formatInt, formatMoney } from "../../helpers/formatHelpers";

/** "just now" / "5m ago" / "2h ago" / "3d ago". */
function ago(ts?: number | null): string {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function showMainMenu(
  root: HTMLElement,
  save: SaveSystem,
  onPlay: (slot: number) => void
): void {
  root.innerHTML = "";

  const screen = document.createElement("div");
  screen.className = "menu-screen";

  screen.innerHTML = `
    <div class="menu-ribbon"></div>
    <div class="menu-hero">
      <div class="menu-logo">🎅</div>
      <h1 class="menu-title">Santa&nbsp;Factory</h1>
      <p class="menu-tagline">Run Santa's workshop and race the clock to Christmas.</p>
    </div>
    <div class="menu-slots"></div>
    <p class="menu-foot">Choose a save slot — your game autosaves as you play.</p>
  `;

  const slots = screen.querySelector<HTMLElement>(".menu-slots")!;
  for (let i = 1; i <= SLOT_COUNT; i++) {
    slots.appendChild(buildSlotCard(i, save, onPlay));
  }

  root.appendChild(screen);
}

function buildSlotCard(slot: number, save: SaveSystem, onPlay: (slot: number) => void): HTMLElement {
  const info: SlotSummary = save.peek(slot);
  const card = document.createElement("div");
  card.className = "slot-card " + (info.exists ? "filled" : "empty");
  card.setAttribute("role", "button");
  card.tabIndex = 0;

  if (!info.exists) {
    card.innerHTML = `
      <div class="slot-top"><span class="slot-name">Slot ${slot}</span></div>
      <div class="slot-empty">Empty slot</div>
      <div class="slot-cta">＋ New game</div>
    `;
  } else if (info.corrupt) {
    card.innerHTML = `
      <div class="slot-top"><span class="slot-name">Slot ${slot}</span></div>
      <div class="slot-empty">Unreadable save</div>
      <div class="slot-cta danger">＋ New game (overwrite)</div>
    `;
  } else {
    card.innerHTML = `
      <div class="slot-top">
        <span class="slot-name">Slot ${slot}</span>
        <span class="slot-when">${ago(info.savedAt)}</span>
      </div>
      <div class="slot-stats">
        <span>🗓️ Day ${formatInt(info.day ?? 1)} / 365</span>
        <span>💰 ${formatMoney(info.money ?? 0)}</span>
        <span>🧝 ${formatInt(info.elves ?? 0)}</span>
      </div>
      <div class="slot-cta">Continue ▸</div>
    `;

    const del = document.createElement("button");
    del.className = "slot-delete";
    del.title = "Delete this save";
    del.textContent = "🗑️";
    del.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Delete the save in Slot ${slot}? This can't be undone.`)) {
        save.clear(slot);
        showMainMenu(document.getElementById("app")!, save, onPlay);
      }
    };
    card.appendChild(del);
  }

  const play = () => onPlay(slot);
  card.onclick = play;
  card.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      play();
    }
  };

  return card;
}
