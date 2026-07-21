/**
 * notifySettingsModal — "🔔 Notifications" settings screen, opened from the
 * ☰ menu. Lets the player mute individual corner-toast categories (e.g.
 * station breakdowns, which can fire often once mechanics are handling them
 * automatically) without touching the underlying game — footer status text,
 * badges and the events themselves are unaffected; this only silences the
 * pop-up. A plain settings screen, so it's non-blocking by construction (no
 * game state involved). Styles: notifySettingsModal.css.
 */

import "./notifySettingsModal.css";

import { isNotifyEnabled, setNotifyEnabled, type NotifyKey } from "../settings";
import { t } from "../i18n/i18n";

const OVERLAY_CLASS = "notify-modal-overlay";

const ROWS: { key: NotifyKey; icon: string }[] = [
  { key: "stationBroke", icon: "🔧" },
  { key: "dayOff", icon: "😴" },
  { key: "rushOrder", icon: "⚡" },
  { key: "grinch", icon: "😈" },
];

export function openNotifySettingsModal(): void {
  document.querySelector(`.${OVERLAY_CLASS}`)?.remove();

  const overlay = document.createElement("div");
  overlay.className = OVERLAY_CLASS;
  const sheet = document.createElement("div");
  sheet.className = "notify-modal-sheet";
  overlay.appendChild(sheet);

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);
  overlay.onclick = close;
  sheet.onclick = (e) => e.stopPropagation();

  sheet.innerHTML = `
    <div class="notify-modal-head">
      <div class="notify-modal-head-text">
        <div class="notify-modal-title">${t("notify.title")}</div>
        <div class="notify-modal-sub">${t("notify.sub")}</div>
      </div>
      <button class="notify-modal-close" aria-label="Close" type="button">✕</button>
    </div>
    <div class="notify-list"></div>
    <div class="notify-modal-foot">
      <button class="notify-done" type="button">${t("notify.done")}</button>
    </div>
  `;
  sheet.querySelector<HTMLButtonElement>(".notify-modal-close")!.onclick = close;
  sheet.querySelector<HTMLButtonElement>(".notify-done")!.onclick = close;

  const list = sheet.querySelector<HTMLElement>(".notify-list")!;
  for (const row of ROWS) {
    const el = document.createElement("div");
    el.className = "notify-row";
    el.innerHTML = `
      <span class="notify-row-icon">${row.icon}</span>
      <div class="notify-row-text">
        <span class="notify-row-label">${t(`notify.${row.key}.label`)}</span>
        <span class="notify-row-desc">${t(`notify.${row.key}.desc`)}</span>
      </div>
    `;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.setAttribute("role", "switch");
    const refresh = () => {
      const on = isNotifyEnabled(row.key);
      toggle.className = "notify-toggle" + (on ? " on" : "");
      toggle.setAttribute("aria-checked", String(on));
      toggle.textContent = on ? t("notify.on") : t("notify.off");
    };
    toggle.onclick = () => {
      setNotifyEnabled(row.key, !isNotifyEnabled(row.key));
      refresh();
    };
    refresh();
    el.appendChild(toggle);
    list.appendChild(el);
  }

  document.body.appendChild(overlay);
}
