/**
 * mainMenu — the title screen shown before a game starts. Offers save slots
 * (continue / new game / delete) and the language toggle. Selecting a slot
 * boots the game into it. Markup is built here; styles in mainMenu.css.
 */

import "./mainMenu.css";

import type { SaveSystem, SlotSummary } from "../../systems/SaveSystem";
import { SLOT_COUNT } from "../../config/saveConfig";
import { SEASON_DAYS } from "../../config/timeConfig";
import { formatInt, formatMoney } from "../../helpers/formatHelpers";
import { t } from "../i18n/i18n";
import { createLangSelect } from "../components/langSelect";

/** "just now" / "5m ago" / "2h ago" / "3d ago" — localized. */
function ago(ts?: number | null): string {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return t("time.justNow");
  const m = Math.floor(s / 60);
  if (m < 60) return t("time.mAgo", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("time.hAgo", { n: h });
  return t("time.dAgo", { n: Math.floor(h / 24) });
}

export function showMainMenu(root: HTMLElement, save: SaveSystem, onPlay: (slot: number) => void): void {
  root.innerHTML = "";

  const screen = document.createElement("div");
  screen.className = "menu-screen";

  screen.innerHTML = `
    <div class="menu-ribbon"></div>
    <div class="menu-lang-corner"></div>
    <div class="menu-hero">
      <div class="menu-logo">🎅</div>
      <h1 class="menu-title">Santa&nbsp;Factory</h1>
      <p class="menu-tagline">${t("menu.tagline")}</p>
    </div>
    <div class="menu-slots"></div>
    <p class="menu-foot">${t("menu.foot")}</p>
  `;

  // Language toggle re-renders the whole menu in the new language.
  screen
    .querySelector<HTMLElement>(".menu-lang-corner")!
    .appendChild(createLangSelect(() => showMainMenu(root, save, onPlay)));

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

  const name = t("menu.slot", { n: slot });

  if (!info.exists) {
    card.innerHTML = `
      <div class="slot-top"><span class="slot-name">${name}</span></div>
      <div class="slot-empty">${t("menu.empty")}</div>
      <div class="slot-cta">${t("menu.newGame")}</div>
    `;
  } else if (info.corrupt) {
    card.innerHTML = `
      <div class="slot-top"><span class="slot-name">${name}</span></div>
      <div class="slot-empty">${t("menu.unreadable")}</div>
      <div class="slot-cta danger">${t("menu.newGameOverwrite")}</div>
    `;
  } else {
    card.innerHTML = `
      <div class="slot-top">
        <span class="slot-name">${name}</span>
        <span class="slot-when">${ago(info.savedAt)}</span>
      </div>
      <div class="slot-stats">
        <span>${t("menu.day", { day: formatInt(info.day ?? 1), total: SEASON_DAYS })}</span>
        <span>💰 ${formatMoney(info.money ?? 0)}</span>
        <span>🧝 ${formatInt(info.elves ?? 0)}</span>
      </div>
      <div class="slot-cta">${t("menu.continue")}</div>
    `;

    const del = document.createElement("button");
    del.className = "slot-delete";
    del.title = t("menu.deleteTitle");
    del.textContent = "🗑️";
    del.onclick = (e) => {
      e.stopPropagation();
      if (confirm(t("menu.deleteConfirm", { n: slot }))) {
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
