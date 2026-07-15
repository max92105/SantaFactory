/**
 * appLayout — the app shell around the pages: header (menu, HUD resources,
 * time), main tab navigation, and the status footer.
 * Markup: appLayout.html · Styles: appLayout.css
 */

import appLayoutHtml from "./appLayout.html?raw";
import "./appLayout.css";

import type { FrameViews, GameContext } from "../../core/GameContext";
import { ensureInventory, getTotalFinished } from "../../helpers/inventoryHelpers";
import { getUnlockedToyTypes } from "../../helpers/unlockHelpers";
import { totalElves, countOfType, onShiftCount, totalIdle, ownedElfTypes } from "../../helpers/workforceHelpers";
import { currentShiftSlot } from "../../config/shiftsConfig";
import { brokenStationCount } from "../../helpers/stationHelpers";
import { spawnToast } from "../components/toast";
import { spawnCelebration } from "../components/celebration";
import { showEventModal, removeEventModal, eventModalOpen } from "../components/eventModal";
import { showGrinchCard, updateGrinchCard, removeGrinchCard, grinchCardOpen } from "../components/grinchCard";
import { isMuted, toggleMute, playCash } from "../audio";
import { formatInt, formatMoney } from "../../helpers/formatHelpers";

/** Emoji for each time-of-day label (single source for the HUD clock). */
const TIME_OF_DAY_ICON: Record<string, string> = {
  Morning: "🌅",
  Afternoon: "☀️",
  Evening: "🌆",
  Night: "🌙",
};

/** Inject the layout shell into the app root. Must run before any page mounts. */
export function mountAppLayout(root: HTMLElement): void {
  root.innerHTML = appLayoutHtml;
}

/** Wire menu, tab switching, gifts dropdown and save/load/reset. */
export function bindAppLayout(ctx: GameContext): void {
  const { dom } = ctx;

  // Main tabs
  dom.tabButtons.forEach((btn) => {
    btn.onclick = () => {
      dom.tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      dom.tabClick.classList.toggle("active", tab === "click");
      dom.tabFactory.classList.toggle("active", tab === "factory");
      dom.tabShop.classList.toggle("active", tab === "shop");
      dom.tabStorage.classList.toggle("active", tab === "storage");
      dom.tabOrders.classList.toggle("active", tab === "orders");
      dom.tabMetrics.classList.toggle("active", tab === "metrics");
    };
  });

  // Resource breakdowns (Gifts, Elves): only the arrow toggles; one open at a
  // time; click again or outside to close.
  const closeAllDropdowns = () => {
    dom.giftsDropdown.classList.remove("open");
    dom.giftsToggle.setAttribute("aria-expanded", "false");
    dom.elvesDropdown.classList.remove("open");
    dom.elvesToggle.setAttribute("aria-expanded", "false");
  };
  const toggleDropdown = (drop: HTMLElement, toggle: HTMLElement) => {
    const willOpen = !drop.classList.contains("open");
    closeAllDropdowns();
    if (willOpen) {
      drop.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
    }
  };
  dom.giftsToggle.onclick = (e) => {
    e.stopPropagation();
    toggleDropdown(dom.giftsDropdown, dom.giftsToggle);
  };
  dom.elvesToggle.onclick = (e) => {
    e.stopPropagation();
    toggleDropdown(dom.elvesDropdown, dom.elvesToggle);
  };
  // Clicks inside a panel shouldn't close it
  dom.giftsDropdown.onclick = (e) => e.stopPropagation();
  dom.elvesDropdown.onclick = (e) => e.stopPropagation();
  document.addEventListener("click", closeAllDropdowns);

  // Menu toggle
  const closeMenu = () => dom.menuPanel.classList.add("hidden");

  dom.menuBtn.onclick = (e) => {
    e.stopPropagation();
    dom.menuPanel.classList.toggle("hidden");
  };
  dom.menuPanel.onclick = (e) => e.stopPropagation();
  document.addEventListener("click", () => closeMenu());

  // Menu actions
  dom.saveBtn.onclick = () => {
    closeMenu();
    ctx.saveGame();
    ctx.rebuildUI();
  };

  // Music mute toggle (stays open so the state change is visible)
  dom.muteBtn.textContent = muteLabel();
  dom.muteBtn.onclick = (e) => {
    e.stopPropagation();
    toggleMute();
    dom.muteBtn.textContent = muteLabel();
  };

  dom.mainMenuBtn.onclick = () => {
    closeMenu();
    ctx.exitToMenu();
  };
}

function muteLabel(): string {
  return isMuted() ? "🔇 Music: off" : "🔊 Music: on";
}

/** Per-frame refresh of the HUD (resources, gift breakdown, time) and status bar. */
export function renderAppLayout(ctx: GameContext, views: FrameViews): void {
  const { dom } = ctx;
  const state = ctx.getState();

  dom.hudGifts.textContent = formatInt(getTotalFinished(state));
  dom.hudMoney.textContent = formatMoney(state.resources.money);
  dom.hudElves.textContent = formatInt(totalElves(state));

  // Gift breakdown dropdown (per unlocked toy type)
  dom.giftsDropdown.innerHTML = "";
  const header = document.createElement("div");
  header.className = "dropdown-header";
  header.textContent = "Gifts in stock";
  dom.giftsDropdown.appendChild(header);
  for (const t of getUnlockedToyTypes(state)) {
    const inv = ensureInventory(state, t.id);
    const item = document.createElement("div");
    item.className = "dropdown-item";
    item.innerHTML = `<span>${t.icon} ${t.name}</span><strong>${formatInt(inv.finished)}</strong>`;
    dom.giftsDropdown.appendChild(item);
  }

  // Elf breakdown dropdown (per elf type, with idle/working summary)
  dom.elvesDropdown.innerHTML = "";
  const elvesHeader = document.createElement("div");
  elvesHeader.className = "dropdown-header";
  elvesHeader.textContent = "Elves by type";
  dom.elvesDropdown.appendChild(elvesHeader);

  const owned = ownedElfTypes(state);
  if (owned.length === 0) {
    const empty = document.createElement("div");
    empty.className = "dropdown-item dropdown-empty";
    empty.textContent = "No elves hired yet";
    dom.elvesDropdown.appendChild(empty);
  } else {
    for (const t of owned) {
      const item = document.createElement("div");
      item.className = "dropdown-item";
      item.innerHTML = `<span>${t.icon} ${t.name}</span><strong>${formatInt(countOfType(state, t.id))}</strong>`;
      dom.elvesDropdown.appendChild(item);
    }
    const slot = currentShiftSlot(state.time.dayProgress);
    const footer = document.createElement("div");
    footer.className = "dropdown-footer";
    footer.textContent = `${formatInt(onShiftCount(state, slot))} on shift now · ${formatInt(totalIdle(state))} idle`;
    dom.elvesDropdown.appendChild(footer);
  }

  // Season clock
  dom.hudDay.textContent = String(views.time.day);
  dom.hudTimeOfDay.textContent = views.time.timeOfDayLabel;
  dom.hudTimeIcon.textContent = TIME_OF_DAY_ICON[views.time.timeOfDayLabel] ?? "⏰";
  dom.hudDaysLeft.textContent = String(Math.max(0, views.time.seasonDays - views.time.day));
  dom.timeBarFill.style.width = `${Math.floor(views.time.dayProgress * 100)}%`;

  dom.statusText.textContent = state.meta.statusText;

  // Factory tab badge: number of broken stations needing attention
  const broken = brokenStationCount(state);
  dom.factoryBadge.hidden = broken === 0;
  dom.factoryBadge.textContent = String(broken);

  // Orders tab badge: rush orders waiting to be grabbed (time-pressured)
  const rushWaiting = state.orders.offers.reduce((n, o) => n + (o.rush ? 1 : 0), 0);
  dom.ordersBadge.hidden = rushWaiting === 0;
  dom.ordersBadge.textContent = String(rushWaiting);

  // Drain queued alerts into corner toasts (fires each event once)
  if (state.pendingAlerts.length > 0) {
    for (const msg of state.pendingAlerts) spawnToast(dom.toastLayer, msg, "warning");
    state.pendingAlerts.length = 0;
  }

  // Drain payout celebrations: confetti + counting money pop + cha-ching
  if (state.pendingCelebrations.length > 0) {
    for (const c of state.pendingCelebrations) {
      spawnCelebration(dom.fxLayer, c);
      playCash();
    }
    state.pendingCelebrations.length = 0;
  }

  // The Grinch: a non-blocking heist card with a live countdown.
  if (state.grinch.active) {
    if (!grinchCardOpen()) {
      showGrinchCard(state.grinch.active, {
        onPay: () => {
          ctx.systems.grinch.payToll(ctx.getState());
          removeGrinchCard();
          ctx.rebuildUI();
        },
        onGive: () => {
          ctx.systems.grinch.deliverDemand(ctx.getState());
          ctx.rebuildUI();
        },
      });
    }
    updateGrinchCard(state);
  } else if (grinchCardOpen()) {
    removeGrinchCard();
  }

  // Random-event freeze modal: show while a choice is pending, remove after.
  if (state.events.pending) {
    if (!eventModalOpen()) {
      showEventModal(state.events.pending, (choiceId) => {
        ctx.systems.event.choose(ctx.getState(), choiceId);
        removeEventModal();
        ctx.rebuildUI();
      });
    }
  } else if (eventModalOpen()) {
    removeEventModal();
  }
}
