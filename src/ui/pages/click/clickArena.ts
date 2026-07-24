/**
 * clickArena — the interactive click surface on the Click tab.
 *
 * Owns every clickable button inside `.click-area` and all their behaviour:
 *  - the main button (always) + a second permanent button (upgrade),
 *  - transient golden buttons that appear, pay a big burst, and vanish (upgrade),
 *  - a click combo that multiplies gifts on rapid clicks (upgrade),
 *  - OVERLAP triggering: one press fires every button under the pointer,
 *  - button size from the Bigger Button upgrades,
 *  - persisted positions (each permanent button returns to where it was on reload).
 *
 * The page drives it: `update()` every frame (golden lifecycle, combo decay,
 * icons, positions) and `refresh()` on any state change (button set + sizes).
 * All tuning is in config/clickConfig.ts.
 */

import type { GameContext } from "../../../core/GameContext";
import { getToyType } from "../../../config/toyTypesConfig";
import {
  MAIN_BUTTON,
  SECOND_BUTTON,
  CLICK_BUTTON_BASE,
  CLICK_BUTTON_BASE_MOBILE,
  GOLDEN_BUTTON_SIZE,
  GOLDEN,
  COMBO,
  CLICK_UPGRADES,
  comboMultiplier,
} from "../../../config/clickConfig";
import { spawnClickFloat } from "../../components/floatingText";
import { t } from "../../i18n/i18n";

type Kind = "main" | "second" | "golden";
type ArenaButton = { id: string; kind: Kind; el: HTMLButtonElement; spawnMs?: number };

export type ClickArena = { update(): void; refresh(): void };

export type ClickArenaEls = {
  arena: HTMLElement;
  mainBtn: HTMLButtonElement;
  floatLayer: HTMLDivElement;
  combo: HTMLElement;
};

export function createClickArena(ctx: GameContext, els: ClickArenaEls): ClickArena {
  const { arena, floatLayer } = els;
  const buttons: ArenaButton[] = [{ id: MAIN_BUTTON, kind: "main", el: els.mainBtn }];

  // Combo runtime (not persisted — a fresh session starts at zero).
  let combo = 0;
  let lastClickMs = 0;
  // Golden runtime.
  let nextGoldenMs = performance.now() + goldenDelay();
  let goldenSeq = 0;

  const nowMs = () => performance.now();
  const comboOn = () => !!ctx.getState().owned.upgrades[CLICK_UPGRADES.combo];
  const goldenOn = () => !!ctx.getState().owned.upgrades[CLICK_UPGRADES.golden];
  const arenaVisible = () => arena.clientWidth > 0 && arena.clientHeight > 0;

  function goldenDelay(): number {
    return (GOLDEN.minInterval + Math.random() * (GOLDEN.maxInterval - GOLDEN.minInterval)) * 1000;
  }

  function buttonBase(): number {
    return window.matchMedia("(max-width: 640px)").matches ? CLICK_BUTTON_BASE_MOBILE : CLICK_BUTTON_BASE;
  }

  // ── Positions (fractions of the arena, persisted per button id) ──
  function posOf(id: string, fallback: { x: number; y: number }): { x: number; y: number } {
    const saved = ctx.getState().clicker.positions[id];
    if (saved && typeof saved.x === "number" && typeof saved.y === "number") return saved;
    ctx.getState().clicker.positions[id] = { ...fallback };
    return ctx.getState().clicker.positions[id];
  }

  /** Place a button at a fractional position, clamped so it never leaves the arena. */
  function applyPos(el: HTMLElement, frac: { x: number; y: number }): void {
    const aw = arena.clientWidth;
    const ah = arena.clientHeight;
    const halfW = el.offsetWidth / 2 || buttonBase() / 2;
    const halfH = el.offsetHeight / 2 || buttonBase() / 2;
    const x = Math.max(halfW, Math.min(aw - halfW, frac.x * aw));
    const y = Math.max(halfH, Math.min(ah - halfH, frac.y * ah));
    el.style.setProperty("--btn-x", `${Math.round(x)}px`);
    el.style.setProperty("--btn-y", `${Math.round(y)}px`);
  }

  /** Random in-bounds fractional position for a button of this size. */
  function randomFrac(el: HTMLElement): { x: number; y: number } {
    const aw = arena.clientWidth || 1;
    const ah = arena.clientHeight || 1;
    const marginX = (el.offsetWidth / 2 || buttonBase() / 2) / aw;
    const marginY = (el.offsetHeight / 2 || buttonBase() / 2) / ah;
    return {
      x: marginX + Math.random() * (1 - 2 * marginX),
      y: marginY + Math.random() * (1 - 2 * marginY),
    };
  }

  function moveButton(b: ArenaButton): void {
    const frac = randomFrac(b.el);
    if (b.kind !== "golden") ctx.getState().clicker.positions[b.id] = frac; // persist permanent buttons
    applyPos(b.el, frac);
  }

  // ── Combo ──
  function bumpCombo(): number {
    if (!comboOn()) return 1;
    const now = nowMs();
    combo = now - lastClickMs <= COMBO.window * 1000 ? Math.min(combo + 1, COMBO.maxSteps) : 0;
    lastClickMs = now;
    return comboMultiplier(combo);
  }

  function renderCombo(): void {
    if (!comboOn() || combo <= 0) {
      els.combo.hidden = true;
      return;
    }
    const remaining = Math.max(0, 1 - (nowMs() - lastClickMs) / (COMBO.window * 1000));
    els.combo.hidden = false;
    els.combo.innerHTML = `
      <div class="combo-label">${t("click.combo", { n: combo, mult: comboMultiplier(combo).toFixed(1) })}</div>
      <div class="combo-bar"><div class="combo-bar-fill" style="width:${Math.floor(remaining * 100)}%"></div></div>
    `;
  }

  // ── Triggering ──
  function trigger(b: ArenaButton, mult: number): void {
    const state = ctx.getState();
    const mods = ctx.systems.modifier.getModifiers(state);
    const at = { x: b.el.offsetLeft, y: b.el.offsetTop };

    if (b.kind === "golden") {
      const amount = ctx.systems.production.makeClick(state, mods, mult * GOLDEN.giftMult);
      spawnClickFloat(floatLayer, `🌟 +${amount}`, at);
      state.meta.statusText = t("click.status.golden", { n: amount });
      removeGolden(b);
    } else {
      const amount = ctx.systems.production.makeClick(state, mods, mult);
      spawnClickFloat(floatLayer, `+${amount}`, at);
      moveButton(b); // permanent buttons dart to a new spot
    }
  }

  function pointInButton(b: ArenaButton, cx: number, cy: number): boolean {
    const r = b.el.getBoundingClientRect();
    const bx = r.left + r.width / 2;
    const by = r.top + r.height / 2;
    const radius = r.width / 2;
    return (cx - bx) ** 2 + (cy - by) ** 2 <= radius * radius;
  }

  // One press fires EVERY button under it (overlap = multi-trigger). Combo
  // advances once per press, not once per button.
  arena.addEventListener("pointerdown", (e) => {
    const hits = buttons.filter((b) => pointInButton(b, e.clientX, e.clientY));
    if (hits.length === 0) return;
    e.preventDefault();
    const mult = bumpCombo();
    for (const b of hits) trigger(b, mult);
    ctx.rebuildUI();
  });

  // ── Golden buttons ──
  function spawnGolden(): void {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "click-btn golden";
    el.setAttribute("aria-label", "Golden gift");
    el.textContent = "🌟";
    const size = GOLDEN_BUTTON_SIZE;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.fontSize = `${Math.round(size * 0.5)}px`;
    arena.appendChild(el);
    const b: ArenaButton = { id: `golden-${goldenSeq++}`, kind: "golden", el, spawnMs: nowMs() };
    applyPos(el, randomFrac(el));
    buttons.push(b);
  }

  function removeGolden(b: ArenaButton): void {
    const i = buttons.indexOf(b);
    if (i >= 0) buttons.splice(i, 1);
    b.el.classList.add("leaving");
    const el = b.el;
    setTimeout(() => el.remove(), 200);
  }

  // ── Per-frame + per-rebuild ──
  function update(): void {
    if (!arenaVisible()) return;

    const state = ctx.getState();
    const icon = getToyType(state.selectedClickToyType)?.icon ?? "🎁";
    for (const b of buttons) {
      if (b.kind === "golden") continue;
      if (b.el.textContent !== icon) b.el.textContent = icon;
      applyPos(b.el, ctx.getState().clicker.positions[b.id] ?? { x: 0.5, y: 0.5 });
    }

    // Golden lifecycle
    const now = nowMs();
    const goldens = buttons.filter((b) => b.kind === "golden");
    for (const g of goldens) {
      if (now - (g.spawnMs ?? now) > GOLDEN.lifetime * 1000) removeGolden(g);
    }
    if (goldenOn() && goldens.length === 0 && now >= nextGoldenMs) {
      spawnGolden();
      nextGoldenMs = now + goldenDelay();
    } else if (!goldenOn()) {
      nextGoldenMs = now + goldenDelay();
    }

    // Combo decay
    if (comboOn() && combo > 0 && now - lastClickMs > COMBO.window * 1000) combo = 0;
    renderCombo();
  }

  function refresh(): void {
    const state = ctx.getState();
    const mods = ctx.systems.modifier.getModifiers(state);
    const size = Math.round(buttonBase() * mods.clickButtonScale);

    // Ensure the second button exists iff its upgrade is owned.
    const hasSecond = buttons.some((b) => b.id === SECOND_BUTTON);
    const wantSecond = !!state.owned.upgrades[CLICK_UPGRADES.secondButton];
    if (wantSecond && !hasSecond) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "click-btn second";
      el.setAttribute("aria-label", "Craft gift (second)");
      arena.appendChild(el);
      buttons.push({ id: SECOND_BUTTON, kind: "second", el });
      applyPos(el, posOf(SECOND_BUTTON, randomFrac(el)));
    } else if (!wantSecond && hasSecond) {
      const i = buttons.findIndex((b) => b.id === SECOND_BUTTON);
      buttons[i].el.remove();
      buttons.splice(i, 1);
    }

    // Size the persistent buttons (golden keeps its fixed size).
    for (const b of buttons) {
      if (b.kind === "golden") continue;
      b.el.style.width = `${size}px`;
      b.el.style.height = `${size}px`;
      b.el.style.fontSize = `${Math.round(size * 0.55)}px`;
    }

    // Seed a default position for the main button (centre) if unset.
    posOf(MAIN_BUTTON, { x: 0.5, y: 0.5 });
  }

  refresh();
  return { update, refresh };
}
