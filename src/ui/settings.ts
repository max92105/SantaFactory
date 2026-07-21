/**
 * settings — small, persistent player prefs that live outside the save file
 * (same pattern as audio.ts's mute flag: a plain localStorage value, so it
 * survives reloads and applies across every save slot).
 *
 * Currently just which corner-toast categories to show. Some events fire
 * often (a station breaking down, a workaholic's day off) and can feel like
 * spam once the player already has automation handling them (e.g. mechanics
 * on duty) — this lets them mute the toast without losing the underlying
 * status text / badges, which are unaffected.
 */

export type NotifyKey = "stationBroke" | "dayOff" | "rushOrder" | "grinch";

const STORAGE_KEY = "santa_factory_notify_settings";

const DEFAULTS: Record<NotifyKey, boolean> = {
  stationBroke: true,
  dayOff: true,
  rushOrder: true,
  grinch: true,
};

function load(): Record<NotifyKey, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

let settings = load();

export function isNotifyEnabled(key: NotifyKey): boolean {
  return settings[key];
}

export function setNotifyEnabled(key: NotifyKey, value: boolean): void {
  settings = { ...settings, [key]: value };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** All current values, e.g. to render a settings list. */
export function getNotifySettings(): Record<NotifyKey, boolean> {
  return settings;
}
