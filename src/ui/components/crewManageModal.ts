/**
 * crewManageModal — the station's crew console.
 *
 * Replaces both the old inline card wall (one card per type+shift combination,
 * which hit ~30 cards on a busy line) and the fire-and-forget assign modal that
 * closed on every single assignment.
 *
 * Two halves, one window:
 *   ROSTER  — a type × shift matrix. Fixed size no matter how many elves: one
 *             row per elf type on the line, one column per shift, counts in the
 *             cells. Cells are live buttons (+ / −) so a single elf can be added
 *             to or pulled from one shift without touching the rest.
 *   ADD CREW — pick a type, pick its shifts, pick a quantity, assign. The window
 *             STAYS OPEN: counts update in place, the roster above redraws, and
 *             a running log records each batch so you can undo the last one.
 *
 * Every restriction shown here comes from helpers/elfRules.ts — the same source
 * the hiring shop reads, so a rule can never be taught to one screen only.
 *
 * NON-BLOCKING: nothing sets meta.isPaused, so the factory keeps running behind
 * it. Game.ts's isUserBusy() defers background rebuilds while it's open so a day
 * rollover can't yank it away mid-schedule.
 *
 * Styles: crewManageModal.css.
 */

import "./crewManageModal.css";

import type { GameContext } from "../../core/GameContext";
import type { ElfRole } from "../../config/elfTypesConfig";
import { getElfType } from "../../config/elfTypesConfig";
import { shiftSlots, currentShiftSlot } from "../../config/shiftsConfig";
import {
  idleOfType,
  totalIdle,
  spentCount,
  spentOfType,
  requiredShifts,
  slotAvailability,
  openSlotsFor,
  eligibleElfTypesForStep,
  stepRequiredSpecialty,
  crewMatrix,
  elfIdsOnStepSlot,
  scheduledOnStep,
  stepSlotCoverage,
  type SlotRestriction,
} from "../../helpers/workforceHelpers";
import { createStepper } from "./stepper";
import { formatInt } from "../../helpers/formatHelpers";
import { t } from "../i18n/i18n";
import { elfName, slotName, specialtyLabel, elfRuleChips, slotRestrictionText } from "../i18n/localize";
import { elfIconHtml } from "../elfIcons";

const OVERLAY_CLASS = "crew-modal-overlay";

export type CrewManageTarget = {
  /** The pipeline step (or MAINTENANCE_STEP / REPAIR_STEP) elves join. */
  stepId: string;
  role: ElfRole;
  /** Icon + name for the header, computed by the caller (it already knows how
   *  to label a toy line vs. a virtual Maintenance/Repair line). */
  icon: string;
  label: string;
};

/** One completed assignment, so the last batch can be undone. */
type LogEntry = { typeId: string; slots: string[]; count: number; ids: number[] };

function roleCopy(role: ElfRole, stepId: string): { sub: string; empty: string } {
  const specialty = stepRequiredSpecialty(stepId);
  if (specialty) {
    return {
      sub: t("assignModal.subSpecialist", { specialty: specialtyLabel(specialty) }),
      empty: t("assignModal.emptySpecialist", { specialty: specialtyLabel(specialty) }),
    };
  }
  if (role === "mechanic") return { sub: t("assignModal.subMech"), empty: t("factory.pickerEmptyMech") };
  if (role === "mender") return { sub: t("assignModal.subMender"), empty: t("factory.pickerEmptyMender") };
  return { sub: t("assignModal.subWorker"), empty: t("factory.pickerEmptyWorker") };
}

export function openCrewManageModal(ctx: GameContext, target: CrewManageTarget): void {
  document.querySelector(`.${OVERLAY_CLASS}`)?.remove();

  const { stepId, role, icon, label } = target;
  let selectedType: string | null = null;
  let selectedSlots: string[] = [];
  let qty = 1;
  const log: LogEntry[] = [];

  const overlay = document.createElement("div");
  overlay.className = OVERLAY_CLASS;
  const sheet = document.createElement("div");
  sheet.className = "crew-sheet";
  overlay.appendChild(sheet);

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    ctx.rebuildUI(); // the line summary behind us reflects everything done here
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);
  overlay.onclick = close;
  sheet.onclick = (e) => e.stopPropagation();

  /** Default a freshly-picked type to its first N open shifts. */
  function defaultSlotsFor(typeId: string): string[] {
    const open = openSlotsFor(ctx.getState(), typeId, stepId);
    return open.slice(0, Math.min(requiredShifts(typeId), open.length));
  }

  /** Assign the current selection. Does NOT close — that's the whole point. */
  function doAssign(): void {
    if (!selectedType) return;
    const state = ctx.getState();
    const before = new Set(
      state.workforce.elves.filter((e) => e.step === stepId).map((e) => e.id)
    );
    const n = ctx.systems.pipeline.assignElves(state, selectedType, stepId, selectedSlots, qty);
    if (n <= 0) return;
    const ids = state.workforce.elves
      .filter((e) => e.step === stepId && !before.has(e.id))
      .map((e) => e.id);
    log.unshift({ typeId: selectedType, slots: [...selectedSlots], count: n, ids });
    // Keep the type selected so "assign another batch" is one click away, but
    // clamp the quantity to what's actually left idle.
    qty = Math.max(1, Math.min(qty, Math.max(1, idleOfType(ctx.getState(), selectedType))));
    render();
  }

  /** Put the most recent batch back in the idle pool (not "sent home" — these
   *  elves never started, so undo must not burn their day). */
  function undoLast(): void {
    const last = log.shift();
    if (!last) return;
    const state = ctx.getState();
    for (const id of last.ids) {
      const elf = state.workforce.elves.find((e) => e.id === id);
      if (elf) {
        elf.step = null;
        elf.slots = [];
        elf.spent = false; // undo of a mistake, not a shift worked
      }
    }
    render();
  }

  render();
  document.body.appendChild(overlay);

  function render(): void {
    const state = ctx.getState();
    const copy = roleCopy(role, stepId);
    const nowSlot = currentShiftSlot(state.time.dayProgress);
    sheet.innerHTML = "";

    // ── Header: station + the three workforce numbers that actually matter ──
    const head = document.createElement("div");
    head.className = "crew-head";
    head.innerHTML = `
      <span class="crew-head-icon">${icon}</span>
      <div class="crew-head-text">
        <div class="crew-head-title">${label}</div>
        <div class="crew-head-sub">${copy.sub}</div>
      </div>
      <div class="crew-head-stats">
        <div class="crew-hstat"><span>${t("crew.onLine")}</span><strong>${formatInt(scheduledOnStep(state, stepId))}</strong></div>
        <div class="crew-hstat"><span>${t("crew.idle")}</span><strong>${formatInt(totalIdle(state))}</strong></div>
        <div class="crew-hstat home"><span>${t("crew.atHome")}</span><strong>${formatInt(spentCount(state))}</strong></div>
      </div>
    `;
    const x = document.createElement("button");
    x.type = "button";
    x.className = "crew-close";
    x.setAttribute("aria-label", t("crew.done"));
    x.textContent = "✕";
    x.onclick = close;
    head.appendChild(x);
    sheet.appendChild(head);

    const body = document.createElement("div");
    body.className = "crew-body";
    sheet.appendChild(body);

    body.appendChild(buildRoster(state, nowSlot));
    body.appendChild(buildAdder(state, copy.empty, nowSlot));

    // ── Footer: what you just did, with an undo for the last batch ──
    const foot = document.createElement("div");
    foot.className = "crew-foot";

    const logWrap = document.createElement("div");
    logWrap.className = "crew-log";
    if (log.length === 0) {
      logWrap.innerHTML = `<span class="crew-log-empty">${t("crew.logEmpty")}</span>`;
    } else {
      for (const e of log.slice(0, 3)) {
        const item = document.createElement("span");
        item.className = "crew-log-item";
        item.textContent = t("crew.logLine", {
          n: e.count,
          name: elfName(e.typeId),
          slots: e.slots.map((s) => slotName(s)).join(" "),
        });
        logWrap.appendChild(item);
      }
      const undo = document.createElement("button");
      undo.type = "button";
      undo.className = "crew-undo";
      undo.textContent = t("crew.undo");
      undo.onclick = undoLast;
      logWrap.appendChild(undo);
    }
    foot.appendChild(logWrap);

    const done = document.createElement("button");
    done.type = "button";
    done.className = "crew-done";
    done.textContent = t("crew.done");
    done.onclick = close;
    foot.appendChild(done);

    sheet.appendChild(foot);
  }

  // ── Roster: the type × shift matrix ────────────────────────────────────
  function buildRoster(state: ReturnType<GameContext["getState"]>, nowSlot: string): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "crew-section";
    wrap.innerHTML = `<div class="crew-section-title">${t("crew.roster")}</div>`;

    const rows = crewMatrix(state, stepId);
    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "crew-empty-state";
      empty.textContent = t("crew.rosterEmpty");
      wrap.appendChild(empty);
      return wrap;
    }

    const table = document.createElement("div");
    table.className = "roster";
    table.style.setProperty("--slot-count", String(shiftSlots.length));

    // Header row: shift columns, with the live one marked.
    const header = document.createElement("div");
    header.className = "roster-row roster-head";
    header.innerHTML =
      `<span class="roster-cell roster-label"></span>` +
      shiftSlots
        .map(
          (s) =>
            `<span class="roster-cell roster-slot${s.id === nowSlot ? " now" : ""}" title="${slotName(s.id)}">
               <span class="roster-slot-icon">${s.icon}</span>
               <span class="roster-slot-name">${slotName(s.id)}</span>
             </span>`
        )
        .join("") +
      `<span class="roster-cell roster-total">${t("crew.total")}</span>`;
    table.appendChild(header);

    for (const row of rows) {
      const def = getElfType(row.type);
      const tr = document.createElement("div");
      tr.className = "roster-row";

      const nameCell = document.createElement("span");
      nameCell.className = "roster-cell roster-label";
      const offBadge =
        row.dayOff > 0 ? `<span class="roster-off" title="${t("crew.dayOffTitle")}">😴${row.dayOff}</span>` : "";
      nameCell.innerHTML = `
        <span class="roster-icon">${elfIconHtml(row.type, def?.icon ?? "🧝")}</span>
        <span class="roster-name">${elfName(row.type)}</span>${offBadge}
      `;
      tr.appendChild(nameCell);

      const avail = slotAvailability(state, row.type, stepId);
      for (const s of shiftSlots) {
        const n = row.perSlot[s.id] ?? 0;
        const restriction = avail.find((a) => a.slotId === s.id)?.restriction ?? null;
        tr.appendChild(buildRosterCell(row.type, s.id, n, restriction, s.id === nowSlot));
      }

      const totalCell = document.createElement("span");
      totalCell.className = "roster-cell roster-total";
      totalCell.textContent = formatInt(row.total);
      tr.appendChild(totalCell);

      table.appendChild(tr);
    }

    // Footer row: total bodies covering each shift — the coverage gaps.
    const footer = document.createElement("div");
    footer.className = "roster-row roster-foot";
    footer.innerHTML =
      `<span class="roster-cell roster-label">${t("crew.onShift")}</span>` +
      shiftSlots
        .map((s) => {
          const n = stepSlotCoverage(state, stepId, s.id);
          return `<span class="roster-cell roster-cover${n === 0 ? " gap" : ""}${
            s.id === nowSlot ? " now" : ""
          }">${formatInt(n)}</span>`;
        })
        .join("") +
      `<span class="roster-cell roster-total"></span>`;
    table.appendChild(footer);

    wrap.appendChild(table);
    return wrap;
  }

  /**
   * One cell: the count, plus − / + that move a SINGLE elf in or out of just
   * this shift. `+` assigns a fresh idle elf covering this shift (auto-filling
   * its remaining shifts where this station is thinnest); `−` sends one home.
   */
  function buildRosterCell(
    typeId: string,
    slotId: string,
    count: number,
    restriction: SlotRestriction | null,
    isNow: boolean
  ): HTMLElement {
    const cell = document.createElement("span");
    cell.className = `roster-cell roster-count${isNow ? " now" : ""}${count === 0 ? " zero" : ""}`;

    if (restriction === "blocked") {
      cell.classList.add("blocked");
      cell.innerHTML = `<span class="roster-blocked" title="${slotRestrictionText(restriction)}">🚫</span>`;
      return cell;
    }

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "roster-btn minus";
    minus.textContent = "−";
    minus.disabled = count <= 0;
    minus.title = t("crew.pullOne", { slot: slotName(slotId) });
    minus.onclick = () => {
      const ids = elfIdsOnStepSlot(ctx.getState(), stepId, typeId, slotId);
      if (ids.length === 0) return;
      ctx.systems.pipeline.removeElves(ctx.getState(), [ids[0]]);
      render();
    };

    const value = document.createElement("span");
    value.className = "roster-value";
    value.textContent = String(count);

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "roster-btn plus";
    plus.textContent = "+";
    const idle = idleOfType(ctx.getState(), typeId);
    plus.disabled = idle <= 0 || restriction !== null;
    plus.title = restriction
      ? slotRestrictionText(restriction)
      : idle <= 0
      ? t("crew.noneIdle", { name: elfName(typeId) })
      : t("crew.addOne", { slot: slotName(slotId) });
    plus.onclick = () => {
      quickAdd(typeId, slotId);
      render();
    };

    cell.append(minus, value, plus);
    return cell;
  }

  /**
   * Add one elf covering `slotId`. An elf must cover `requiredShifts` slots, so
   * the rest are auto-picked from the open ones this station covers LEAST —
   * a single click both fills the shift you asked for and patches the thinnest gap.
   */
  function quickAdd(typeId: string, slotId: string): void {
    const state = ctx.getState();
    const open = openSlotsFor(state, typeId, stepId).filter((s) => s !== slotId);
    const need = requiredShifts(typeId);
    const extras = open
      .sort((a, b) => stepSlotCoverage(state, stepId, a) - stepSlotCoverage(state, stepId, b))
      .slice(0, Math.max(0, need - 1));
    const slots = [slotId, ...extras];
    const before = new Set(state.workforce.elves.filter((e) => e.step === stepId).map((e) => e.id));
    const n = ctx.systems.pipeline.assignElves(state, typeId, stepId, slots, 1);
    if (n > 0) {
      const ids = ctx
        .getState()
        .workforce.elves.filter((e) => e.step === stepId && !before.has(e.id))
        .map((e) => e.id);
      log.unshift({ typeId, slots, count: n, ids });
    }
  }

  // ── Adder: pick type → shifts → quantity, assign without closing ────────
  function buildAdder(
    state: ReturnType<GameContext["getState"]>,
    emptyText: string,
    nowSlot: string
  ): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "crew-section crew-adder";
    wrap.innerHTML = `<div class="crew-section-title">${t("crew.addCrew")}</div>`;

    const options = eligibleElfTypesForStep(state, stepId);
    if (options.length === 0) {
      const empty = document.createElement("div");
      empty.className = "crew-empty-state";
      empty.textContent = emptyText;
      wrap.appendChild(empty);
      return wrap;
    }

    // Type picker — compact chips so the whole flow (type → shifts → assign)
    // fits without scrolling. Types with somebody idle sort first; the rest stay
    // visible but disabled, so "I own Veterans but they're all out" is readable
    // rather than the option silently vanishing.
    const sorted = [...options].sort((a, b) => idleOfType(state, b.id) - idleOfType(state, a.id));
    const grid = document.createElement("div");
    grid.className = "crew-types";
    for (const def of sorted) {
      const idle = idleOfType(state, def.id);
      const home = spentOfType(state, def.id);
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "crew-type" + (selectedType === def.id ? " active" : "") + (idle <= 0 ? " exhausted" : "");
      card.disabled = idle <= 0;
      card.title = home > 0 ? t("crew.homeTitle", { n: home }) : "";
      card.innerHTML = `
        <span class="crew-type-icon">${elfIconHtml(def.id, def.icon)}</span>
        <span class="crew-type-name">${elfName(def.id)}</span>
        <span class="crew-type-n">${formatInt(idle)}</span>
        ${home > 0 ? `<span class="crew-type-home">🏠${formatInt(home)}</span>` : ""}
      `;
      card.onclick = () => {
        selectedType = def.id;
        selectedSlots = defaultSlotsFor(def.id);
        qty = 1;
        render();
      };
      grid.appendChild(card);
    }
    wrap.appendChild(grid);

    if (!selectedType) {
      const hint = document.createElement("div");
      hint.className = "crew-hint";
      hint.textContent = t("crew.pickTypeHint");
      wrap.appendChild(hint);
      return wrap;
    }

    // The chosen type's work rules, full size and right above the shift picker —
    // exactly where they change what you're about to click.
    const def = getElfType(selectedType)!;
    const chips = elfRuleChips(selectedType);
    if (chips.length) {
      const rulesBar = document.createElement("div");
      rulesBar.className = "crew-rules-bar";
      rulesBar.innerHTML =
        `<span class="crew-rules-who">${elfIconHtml(selectedType, def.icon)} ${elfName(selectedType)}</span>` +
        chips.map((c) => `<span class="rule-chip tone-${c.tone}">${c.icon} ${c.text}</span>`).join("");
      wrap.appendChild(rulesBar);
    }

    // Shift picker — every slot, with a lock + reason on the ones ruled out.
    const avail = slotAvailability(state, selectedType, stepId);
    const openCount = avail.filter((a) => a.restriction === null).length;
    const need = Math.min(requiredShifts(selectedType), openCount);
    selectedSlots = selectedSlots.filter((s) => avail.some((a) => a.slotId === s && a.restriction === null));

    const shiftRow = document.createElement("div");
    shiftRow.className = "crew-shift-pick";

    if (need === 0) {
      shiftRow.innerHTML = `<div class="crew-warning">⚠️ ${t("factory.noOpenShifts")}</div>`;
      const reasons = [...new Set(avail.map((a) => a.restriction).filter((r): r is SlotRestriction => !!r))];
      for (const r of reasons) {
        const line = document.createElement("div");
        line.className = "crew-warning-line";
        line.textContent = slotRestrictionText(r);
        shiftRow.appendChild(line);
      }
      wrap.appendChild(shiftRow);
      return wrap;
    }

    const pickLabel = document.createElement("div");
    pickLabel.className = "crew-pick-label";
    pickLabel.innerHTML = `${t("crew.chooseShifts")} <strong>${selectedSlots.length}/${need}</strong>`;
    shiftRow.appendChild(pickLabel);

    const slotsWrap = document.createElement("div");
    slotsWrap.className = "crew-slots";
    for (const s of shiftSlots) {
      const restriction = avail.find((a) => a.slotId === s.id)?.restriction ?? null;
      const on = selectedSlots.includes(s.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "crew-slot" + (on ? " on" : "") + (restriction ? " locked" : "") + (s.id === nowSlot ? " now" : "");
      btn.disabled = restriction !== null;
      const covered = stepSlotCoverage(state, stepId, s.id);
      btn.innerHTML = `
        ${restriction ? `<span class="crew-slot-lock">🔒</span>` : ""}
        <span class="crew-slot-icon">${s.icon}</span>
        <span class="crew-slot-name">${slotName(s.id)}</span>
        <span class="crew-slot-cover">${t("crew.covered", { n: covered })}</span>
      `;
      if (restriction) btn.title = slotRestrictionText(restriction);
      btn.onclick = () => {
        if (on) selectedSlots = selectedSlots.filter((x) => x !== s.id);
        else if (selectedSlots.length < need) selectedSlots = [...selectedSlots, s.id];
        else selectedSlots = [...selectedSlots.slice(1), s.id]; // full → roll the oldest out
        render();
      };
      slotsWrap.appendChild(btn);
    }
    shiftRow.appendChild(slotsWrap);
    wrap.appendChild(shiftRow);

    // Quantity + assign. Managers are one-per-station-per-shift, so never batch.
    const idle = idleOfType(state, selectedType);
    const maxQty = def.managerMult ? Math.min(1, idle) : idle;
    qty = Math.max(1, Math.min(qty, Math.max(1, maxQty)));
    const ready = selectedSlots.length === need && maxQty > 0;

    const actionRow = document.createElement("div");
    actionRow.className = "crew-action-row";
    actionRow.appendChild(
      createStepper({
        value: qty,
        min: 1,
        max: Math.max(1, maxQty),
        withMax: true,
        onChange: (v) => {
          qty = v;
          render();
        },
      })
    );

    const assign = document.createElement("button");
    assign.type = "button";
    assign.className = "crew-assign";
    assign.disabled = !ready;
    assign.textContent = ready
      ? t("crew.assignN", { n: qty, name: elfName(selectedType) })
      : t("crew.assignPickShifts");
    assign.onclick = doAssign;
    actionRow.appendChild(assign);

    wrap.appendChild(actionRow);

    const keepOpen = document.createElement("div");
    keepOpen.className = "crew-hint";
    keepOpen.textContent = t("crew.staysOpenHint");
    wrap.appendChild(keepOpen);

    return wrap;
  }
}

/** Is the crew console open? (Game.ts defers rebuilds while it is.) */
export function crewManageOpen(): boolean {
  return document.querySelector(`.${OVERLAY_CLASS}`) !== null;
}
