/**
 * crewAssignModal — the dedicated "assign crew" window.
 *
 * Elf assignment picked up a lot of rules over time (shift restrictions, one
 * manager per station per shift, shy elves only working with other shy elves,
 * day-off odds…) so the whole flow lives in its own focused, step-by-step
 * window instead of a cramped inline panel — each elf type's constraints are
 * shown as chips before you pick it, and any shift you can't use says why.
 *
 * It's a NON-BLOCKING overlay: nothing here sets meta.isPaused, so the factory
 * keeps ticking behind it exactly like the order/Grinch deal modals. Game.ts's
 * isUserBusy() just defers background UI rebuilds while it's open, so a day
 * rollover or rush pop-up can't yank it away mid-pick.
 *
 * Styles: crewAssignModal.css.
 */

import "./crewAssignModal.css";

import type { GameContext } from "../../core/GameContext";
import type { ElfRole } from "../../config/elfTypesConfig";
import { getElfType } from "../../config/elfTypesConfig";
import { shiftSlots } from "../../config/shiftsConfig";
import {
  ownedElfTypes,
  idleOfType,
  requiredShifts,
  slotRestriction,
  type SlotRestriction,
} from "../../helpers/workforceHelpers";
import { createStepper } from "./stepper";
import { t } from "../i18n/i18n";
import { elfName, slotName, elfTraitChips } from "../i18n/localize";

const OVERLAY_CLASS = "crew-modal-overlay";

export type CrewAssignTarget = {
  /** The pipeline step (or MAINTENANCE_STEP / REPAIR_STEP) elves join. */
  stepId: string;
  role: ElfRole;
  /** Icon + name shown in the header, computed by the caller (it already
   *  knows how to label a toy line vs. a virtual line). */
  icon: string;
  label: string;
};

function roleCopy(role: ElfRole): { sub: string; empty: string } {
  if (role === "mechanic") return { sub: t("assignModal.subMech"), empty: t("factory.pickerEmptyMech") };
  if (role === "mender") return { sub: t("assignModal.subMender"), empty: t("factory.pickerEmptyMender") };
  return { sub: t("assignModal.subWorker"), empty: t("factory.pickerEmptyWorker") };
}

function restrictionReason(r: SlotRestriction): string {
  switch (r) {
    case "blocked":
      return t("factory.wontWork");
    case "manager_taken":
      return t("factory.slotManagerTaken");
    case "shy_mixed":
      return t("factory.slotShyMixed");
    case "shy_blocked":
      return t("factory.slotShyBlocked");
  }
}

/** Distinct STATION-level reasons (not the elf's own blockedSlots) currently
 *  affecting some shift for this type on this station — for the warning box. */
function stationWarnings(ctx: GameContext, typeId: string, stepId: string): string[] {
  const state = ctx.getState();
  const seen = new Set<SlotRestriction>();
  for (const slot of shiftSlots) {
    const r = slotRestriction(state, typeId, stepId, slot.id);
    if (r && r !== "blocked") seen.add(r);
  }
  return [...seen].map(restrictionReason);
}

export function openCrewAssignModal(ctx: GameContext, target: CrewAssignTarget): void {
  document.querySelector(`.${OVERLAY_CLASS}`)?.remove();

  const { stepId, role, icon, label } = target;
  let selectedType: string | null = null;
  let selectedSlots: string[] = [];
  let qty = 1;

  const overlay = document.createElement("div");
  overlay.className = OVERLAY_CLASS;
  const sheet = document.createElement("div");
  sheet.className = "crew-modal-sheet";
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

  render();
  document.body.appendChild(overlay);

  function render(): void {
    const state = ctx.getState();
    const copy = roleCopy(role);
    sheet.innerHTML = "";

    // ── Header ──
    const head = document.createElement("div");
    head.className = "crew-modal-head";
    head.innerHTML = `
      <span class="crew-modal-icon">${icon}</span>
      <div class="crew-modal-head-text">
        <div class="crew-modal-title">${label}</div>
        <div class="crew-modal-sub">${copy.sub}</div>
      </div>
    `;
    const x = document.createElement("button");
    x.type = "button";
    x.className = "crew-modal-close";
    x.setAttribute("aria-label", "Close");
    x.textContent = "✕";
    x.onclick = close;
    head.appendChild(x);
    sheet.appendChild(head);

    const body = document.createElement("div");
    body.className = "crew-modal-body";
    sheet.appendChild(body);

    // ── Step 1 — pick a type ──
    const options = ownedElfTypes(state).filter((d) => d.role === role && idleOfType(state, d.id) > 0);
    const step1 = document.createElement("div");
    step1.className = "crew-step";
    step1.innerHTML = `<div class="crew-step-label"><span class="crew-step-num">1</span>${t("assignModal.pickType")}</div>`;
    body.appendChild(step1);

    if (options.length === 0) {
      const empty = document.createElement("div");
      empty.className = "crew-empty-state";
      empty.textContent = copy.empty;
      step1.appendChild(empty);
    } else {
      const grid = document.createElement("div");
      grid.className = "crew-type-grid";
      for (const def of options) {
        const chips = elfTraitChips(def.id, { includeBlockedSlots: true });
        const card = document.createElement("button");
        card.type = "button";
        card.className = "crew-type-card" + (selectedType === def.id ? " active" : "");
        card.innerHTML = `
          <div class="crew-type-head">
            <span class="crew-type-icon">${def.icon}</span>
            <div class="crew-type-text">
              <span class="crew-type-name">${elfName(def.id)}</span>
              <span class="crew-type-idle">${t("factory.idleCount", { n: idleOfType(state, def.id) })}</span>
            </div>
          </div>
          ${chips.length ? `<div class="crew-type-chips">${chips.map((c) => `<span class="crew-chip">${c}</span>`).join("")}</div>` : ""}
        `;
        card.onclick = () => {
          selectedType = def.id;
          const open = shiftSlots
            .filter((s) => slotRestriction(ctx.getState(), def.id, stepId, s.id) === null)
            .map((s) => s.id);
          selectedSlots = open.slice(0, Math.min(requiredShifts(def.id), open.length));
          qty = 1;
          render();
        };
        grid.appendChild(card);
      }
      step1.appendChild(grid);
    }

    // ── Step 2 (shifts) + 3 (quantity), once a type is picked ──
    if (selectedType) {
      const def = getElfType(selectedType)!;
      const openSlots = shiftSlots.filter((s) => slotRestriction(state, selectedType!, stepId, s.id) === null);
      const need = Math.min(requiredShifts(selectedType), openSlots.length);
      selectedSlots = selectedSlots.filter((s) => openSlots.some((o) => o.id === s));
      const idle = idleOfType(state, selectedType);
      // Managers are one-per-station-per-shift, so batching several is never valid.
      const maxQty = def.managerMult ? Math.min(1, idle) : idle;
      qty = Math.max(1, Math.min(qty, maxQty));

      const step2 = document.createElement("div");
      step2.className = "crew-step";
      body.appendChild(step2);

      if (need === 0) {
        step2.innerHTML = `<div class="crew-step-label"><span class="crew-step-num">2</span>${t("factory.noOpenShifts")}</div>`;
        const reasons = stationWarnings(ctx, selectedType, stepId);
        if (reasons.length) {
          const warn = document.createElement("div");
          warn.className = "crew-warning";
          warn.innerHTML = reasons.map((w) => `<div>⚠️ ${w}</div>`).join("");
          step2.appendChild(warn);
        }
      } else {
        step2.innerHTML = `<div class="crew-step-label"><span class="crew-step-num">2</span>${t("factory.chooseShifts", {
          n: need,
          sel: selectedSlots.length,
        })}</div>`;

        const reasons = stationWarnings(ctx, selectedType, stepId);
        if (reasons.length) {
          const warn = document.createElement("div");
          warn.className = "crew-warning subtle";
          warn.innerHTML = reasons.map((w) => `<div>ℹ️ ${w}</div>`).join("");
          step2.appendChild(warn);
        }

        const slotRow = document.createElement("div");
        slotRow.className = "crew-slots";
        for (const slot of shiftSlots) {
          const restriction = slotRestriction(state, selectedType, stepId, slot.id);
          const on = selectedSlots.includes(slot.id);
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "crew-slot" + (on ? " on" : "") + (restriction ? " locked" : "");
          btn.disabled = restriction !== null;
          btn.innerHTML = `${restriction ? '<span class="crew-slot-lock">🔒</span>' : ""}<span class="crew-slot-icon">${
            slot.icon
          }</span><small>${slotName(slot.id)}</small>`;
          if (restriction) btn.title = restrictionReason(restriction);
          btn.onclick = () => {
            if (on) selectedSlots = selectedSlots.filter((s) => s !== slot.id);
            else if (selectedSlots.length < need) selectedSlots = [...selectedSlots, slot.id];
            render();
          };
          slotRow.appendChild(btn);
        }
        step2.appendChild(slotRow);

        const step3 = document.createElement("div");
        step3.className = "crew-step";
        step3.innerHTML = `<div class="crew-step-label"><span class="crew-step-num">3</span>${t("assignModal.pickQty")}</div>`;
        const qtyRow = document.createElement("div");
        qtyRow.className = "crew-qty-row";
        qtyRow.appendChild(
          createStepper({
            value: qty,
            min: 1,
            max: maxQty,
            withMax: true,
            onChange: (v) => {
              qty = v;
              render();
            },
          })
        );
        const note = document.createElement("span");
        note.className = "crew-qty-note";
        note.textContent = t("factory.ofIdle", { n: idle });
        qtyRow.appendChild(note);
        step3.appendChild(qtyRow);
        body.appendChild(step3);
      }
    }

    // ── Footer: live summary + confirm/cancel ──
    const ready = ((): boolean => {
      if (!selectedType) return false;
      const openCount = shiftSlots.filter((s) => slotRestriction(ctx.getState(), selectedType!, stepId, s.id) === null).length;
      const need = Math.min(requiredShifts(selectedType), openCount);
      return need > 0 && selectedSlots.length === need;
    })();

    const foot = document.createElement("div");
    foot.className = "crew-modal-foot";
    const summary = document.createElement("div");
    summary.className = "crew-summary";
    summary.textContent = ready
      ? t("assignModal.summary", {
          n: qty,
          name: elfName(selectedType!),
          station: label,
          slots: selectedSlots.map((s) => slotName(s)).join(", "),
        })
      : t("assignModal.summaryEmpty");
    foot.appendChild(summary);

    const actions = document.createElement("div");
    actions.className = "crew-modal-actions";
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "crew-confirm";
    confirm.textContent = ready ? t("factory.assignN", { n: qty }) : t("factory.assign");
    confirm.disabled = !ready;
    confirm.onclick = () => {
      if (!selectedType) return;
      ctx.systems.pipeline.assignElves(ctx.getState(), selectedType, stepId, selectedSlots, qty);
      close();
      ctx.rebuildUI();
    };
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "crew-cancel";
    cancel.textContent = t("factory.cancel");
    cancel.onclick = close;
    actions.append(cancel, confirm);
    foot.appendChild(actions);
    sheet.appendChild(foot);
  }
}
