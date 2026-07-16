/**
 * eventModal — the freeze-the-game "choose one of three" random-event dialog.
 * Non-dismissable: no close button, no click-outside, no Escape — the player
 * must pick. Good events glow green, bad ones red. Styles: eventModal.css.
 */

import "./eventModal.css";

import type { PendingEvent } from "../../state/GameState";
import { t } from "../i18n/i18n";
import { randomEventTitle, randomEventDesc } from "../i18n/localize";

const EVENT_OVERLAY_CLASS = "event-overlay";

/** Is the event modal currently on screen? */
export function eventModalOpen(): boolean {
  return document.querySelector(`.${EVENT_OVERLAY_CLASS}`) !== null;
}

export function removeEventModal(): void {
  document.querySelector(`.${EVENT_OVERLAY_CLASS}`)?.remove();
}

/** Show the modal for a pending event. `onChoose(id)` is called on a pick. */
export function showEventModal(pending: PendingEvent, onChoose: (choiceId: string) => void): void {
  removeEventModal();

  const good = pending.polarity === "good";

  const overlay = document.createElement("div");
  overlay.className = `${EVENT_OVERLAY_CLASS} ${good ? "good" : "bad"}`;

  const sheet = document.createElement("div");
  sheet.className = "event-sheet";
  overlay.appendChild(sheet);

  const head = document.createElement("div");
  head.className = "event-head";
  head.innerHTML = good
    ? `<div class="event-kicker">${t("eventModal.goodKicker")}</div><div class="event-sub">${t("eventModal.goodSub")}</div>`
    : `<div class="event-kicker">${t("eventModal.badKicker")}</div><div class="event-sub">${t("eventModal.badSub")}</div>`;
  sheet.appendChild(head);

  const list = document.createElement("div");
  list.className = "event-choices";
  for (const c of pending.choices) {
    const btn = document.createElement("button");
    btn.className = "event-choice";
    btn.innerHTML = `
      <span class="event-choice-icon">${c.icon}</span>
      <span class="event-choice-text">
        <span class="event-choice-title">${randomEventTitle(c.id)}</span>
        <span class="event-choice-desc">${randomEventDesc(c.id, c.params)}</span>
      </span>
    `;
    btn.onclick = () => onChoose(c.id);
    list.appendChild(btn);
  }
  sheet.appendChild(list);

  document.body.appendChild(overlay);
}
