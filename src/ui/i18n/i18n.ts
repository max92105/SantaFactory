/**
 * i18n — tiny localization layer. One `t(key, params)` reads from the current
 * locale's dictionary (config/messages.ts), falling back to English then the
 * raw key. `applyTranslations(root)` fills static markup tagged with:
 *   data-i18n="key"        → element.textContent
 *   data-i18n-ph="key"     → input.placeholder
 *   data-i18n-title="key"  → element.title
 *
 * Locale is persisted in localStorage and defaults to the browser language.
 * Dynamic (TS-built) strings call t() directly and are re-rendered on switch.
 */

import { messages, type Locale } from "./messages";

export type { Locale };

const LOCALE_KEY = "santa_factory_locale";

function detectDefault(): Locale {
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en") || "en";
  return nav.toLowerCase().startsWith("fr") ? "fr" : "en";
}

let current: Locale = (() => {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem(LOCALE_KEY) : null;
  return saved === "en" || saved === "fr" ? saved : detectDefault();
})();

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  current = locale;
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* private mode / blocked storage — locale still applies for the session */
  }
}

function fill(s: string, params?: Record<string, string | number>): string {
  if (params) for (const p in params) s = s.split(`{${p}}`).join(String(params[p]));
  return s;
}

/** Translate a key, substituting {name} placeholders from `params`. */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = messages[current];
  return fill(dict[key] ?? messages.en[key] ?? key, params);
}

/**
 * Like t(), but returns `fallback` (usually the config's English string) when
 * the key is absent from both dictionaries — used for config-driven names so a
 * newly-added toy/elf/event still shows something sensible.
 */
export function tOr(key: string, fallback: string, params?: Record<string, string | number>): string {
  const dict = messages[current];
  const raw = dict[key] ?? messages.en[key];
  return fill(raw ?? fallback, params);
}

/** Fill all tagged static markup under `root` for the current locale. */
export function applyTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
  root.querySelectorAll<HTMLInputElement>("[data-i18n-ph]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPh!);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle!);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria!));
  });
}
