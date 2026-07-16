/**
 * langSelect — a compact EN / FR toggle. On change it persists the locale and
 * calls `onChange` so the caller can re-render (apply translations + rebuild).
 * Styles: langSelect.css.
 */

import "./langSelect.css";

import { getLocale, setLocale, type Locale } from "../i18n/i18n";

const LOCALES: Locale[] = ["en", "fr"];

export function createLangSelect(onChange: () => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "lang-select";
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", "Language");

  for (const loc of LOCALES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lang-btn" + (getLocale() === loc ? " active" : "");
    btn.textContent = loc.toUpperCase();
    btn.onclick = () => {
      if (getLocale() === loc) return;
      setLocale(loc);
      wrap.querySelectorAll<HTMLElement>(".lang-btn").forEach((b) => b.classList.toggle("active", b === btn));
      onChange();
    };
    wrap.appendChild(btn);
  }
  return wrap;
}
