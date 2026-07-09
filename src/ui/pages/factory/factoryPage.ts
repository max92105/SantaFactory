/**
 * factoryPage — the "Factory" tab.
 *
 * Layout: a workforce bar on top, a rail of production lines on the left
 * (Crafting per toy, then shared Processing steps), and a focused detail panel
 * on the right for the selected line.
 *
 * The elf is the unit of scheduling. You "+ Assign elf" — pick an idle elf and
 * choose ALL of its shift slots at once — and it joins the line's crew as a
 * card. Pulling that card sends the whole elf home (idle until tomorrow), so
 * moving elves around costs you.
 *
 * Logic: PipelineSystem (scheduling, throughput, mistakes, breakdowns).
 */

import factoryPageHtml from "./factoryPage.html?raw";
import "./factoryPage.css";

import type { Page } from "../Page";
import type { FrameViews, GameContext } from "../../../core/GameContext";
import type { StepProgress } from "../../../systems/PipelineSystem";
import type { ElfInstance } from "../../../state/GameState";
import {
  getOrderedSteps,
  getPipelineStep,
  PRODUCTION_STAGES,
  type PipelineStepDef,
} from "../../../config/pipelineConfig";
import { getToyType } from "../../../config/toyTypesConfig";
import { getElfType } from "../../../config/elfTypesConfig";
import { shiftSlots } from "../../../config/shiftsConfig";
import { getUnlockedToyTypes, isToyUnlocked } from "../../../helpers/unlockHelpers";
import { ensureInventory } from "../../../helpers/inventoryHelpers";
import {
  totalElves,
  totalIdle,
  idleOfType,
  onShiftCount,
  ownedElfTypes,
  elvesOnStep,
  scheduledOnStep,
  canWorkSlot,
  allowedSlots,
  requiredShifts,
} from "../../../helpers/workforceHelpers";
import { isStationBroken } from "../../../helpers/stationHelpers";
import { STATION_REPAIR_COST } from "../../../config/stationsConfig";
import { formatInt, formatCost } from "../../../helpers/formatHelpers";

type Status = { cls: string; label: string };

function statusOf(view: StepProgress | undefined, scheduled: number): Status {
  if (!view) return { cls: "idle", label: "Unstaffed" };
  if (view.broken) return { cls: "broken", label: "Broken" };
  if (view.elvesAssigned > 0 && view.isBottlenecked) return { cls: "starved", label: "No input" };
  if (view.elvesAssigned > 0) return { cls: "working", label: "Working" };
  if (scheduled > 0) return { cls: "scheduled", label: "Off shift" };
  return { cls: "idle", label: "Unstaffed" };
}

function visibleSteps(ctx: GameContext): PipelineStepDef[] {
  const state = ctx.getState();
  return getOrderedSteps().filter((s) => !s.toyType || isToyUnlocked(state, s.toyType));
}

export function createFactoryPage(): Page {
  let selectedStepId: string | null = null;

  return {
    mount(container) {
      container.insertAdjacentHTML("beforeend", factoryPageHtml);
    },

    bind() {
      // Interactive elements are (re)built in rebuild()
    },

    rebuild(ctx) {
      const steps = visibleSteps(ctx);
      if (!selectedStepId || !steps.some((s) => s.id === selectedStepId)) {
        selectedStepId = steps[0]?.id ?? null;
      }

      buildIdleChips(ctx);
      buildRail(ctx, selectedStepId, (id) => {
        selectedStepId = id;
        ctx.rebuildUI();
      });
      buildDetail(ctx, selectedStepId);
    },

    renderFrame(ctx, views: FrameViews) {
      const state = ctx.getState();
      const slot = views.pipeline.activeSlot;

      ctx.dom.totalElves.textContent = formatInt(totalElves(state));
      ctx.dom.assignedElves.textContent = formatInt(onShiftCount(state, slot));
      ctx.dom.unassignedElves.textContent = formatInt(totalIdle(state));

      const viewById = new Map(views.pipeline.steps.map((s) => [s.stepId, s]));

      // Rail status dots
      ctx.dom.factoryRail.querySelectorAll<HTMLElement>(".rail-item").forEach((item) => {
        const id = item.dataset.stepId!;
        const st = statusOf(viewById.get(id), scheduledOnStep(state, id));
        const dot = item.querySelector<HTMLElement>(".rail-status")!;
        dot.className = `rail-status status-${st.cls}`;
        dot.title = st.label;
      });

      // Active shift-slot highlight (crew-card pips)
      ctx.dom.factoryDetail.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => {
        el.classList.toggle("active-slot", el.dataset.slot === slot);
      });

      // Detail live values for the shown step
      const shownId = ctx.dom.factoryDetail.querySelector<HTMLElement>("[data-step-id]")?.dataset.stepId;
      if (!shownId) return;

      const view = viewById.get(shownId);
      const badge = ctx.dom.factoryDetail.querySelector<HTMLElement>(".detail-status");
      if (badge) {
        const st = statusOf(view, scheduledOnStep(state, shownId));
        badge.className = `detail-status status-${st.cls}`;
        badge.textContent = st.label;
      }
      const rate = ctx.dom.factoryDetail.querySelector<HTMLElement>('[data-detail="rate"]');
      if (rate) rate.textContent = `${(view?.outputPerSecond ?? 0).toFixed(2)}/s`;
      const ruin = ctx.dom.factoryDetail.querySelector<HTMLElement>('[data-detail="ruin"]');
      if (ruin) ruin.textContent = `${Math.round((view?.mistakeChance ?? 0) * 100)}%`;
      const bar = ctx.dom.factoryDetail.querySelector<HTMLElement>('[data-detail="progress"]');
      if (bar) bar.style.width = `${Math.floor((view?.progress ?? 0) * 100)}%`;

      for (const t of getUnlockedToyTypes(state)) {
        const inv = ensureInventory(state, t.id);
        for (const stage of PRODUCTION_STAGES) {
          const cell = ctx.dom.factoryDetail.querySelector<HTMLElement>(`[data-flow="${t.id}:${stage.id}"]`);
          if (cell) cell.textContent = formatInt(inv[stage.id]);
        }
      }
    },
  };
}

/** One chip per elf type showing how many are idle (available to assign). */
function buildIdleChips(ctx: GameContext): void {
  const state = ctx.getState();
  const host = ctx.dom.unassignedTypes;
  host.innerHTML = "";

  const owned = ownedElfTypes(state);
  if (owned.length === 0) {
    host.innerHTML = `<span class="unassigned-hint">Hire elves in the Upgrades tab →</span>`;
    return;
  }
  for (const t of owned) {
    const chip = document.createElement("span");
    chip.className = "elf-chip";
    chip.title = `${t.name} — ${idleOfType(state, t.id)} idle (of ${t.icon})`;
    chip.innerHTML = `${t.icon} <strong>${formatInt(idleOfType(state, t.id))}</strong>`;
    host.appendChild(chip);
  }
}

// ── Rail ────────────────────────────────────────────────────────────────
function buildRail(ctx: GameContext, selectedId: string | null, onSelect: (id: string) => void): void {
  const state = ctx.getState();
  const rail = ctx.dom.factoryRail;
  rail.innerHTML = "";

  const steps = getOrderedSteps();
  const craft = steps.filter((s) => s.toyType && isToyUnlocked(state, s.toyType));
  const shared = steps.filter((s) => !s.toyType);

  appendRailGroup(rail, "Crafting", craft, selectedId, onSelect);
  appendRailGroup(rail, "Processing", shared, selectedId, onSelect);
}

function appendRailGroup(
  rail: HTMLElement,
  label: string,
  steps: PipelineStepDef[],
  selectedId: string | null,
  onSelect: (id: string) => void
): void {
  if (steps.length === 0) return;

  const head = document.createElement("div");
  head.className = "rail-group-label";
  head.textContent = label;
  rail.appendChild(head);

  for (const step of steps) {
    const toy = step.toyType ? getToyType(step.toyType) : null;
    const item = document.createElement("button");
    item.className = "rail-item" + (step.id === selectedId ? " active" : "");
    item.dataset.stepId = step.id;
    item.innerHTML = `
      <span class="rail-status status-idle"></span>
      <span class="rail-icon">${toy ? toy.icon : "⚙️"}</span>
      <span class="rail-name">${step.name}</span>
    `;
    item.onclick = () => onSelect(step.id);
    rail.appendChild(item);
  }
}

// ── Detail ──────────────────────────────────────────────────────────────
function buildDetail(ctx: GameContext, stepId: string | null): void {
  const detail = ctx.dom.factoryDetail;
  detail.innerHTML = "";

  const step = stepId ? getPipelineStep(stepId) : null;
  if (!step) {
    detail.innerHTML = `<div class="detail-empty">No production lines yet.</div>`;
    return;
  }

  const state = ctx.getState();
  const toy = step.toyType ? getToyType(step.toyType) : null;
  const icon = toy ? toy.icon : "⚙️";
  const broken = isStationBroken(state, step.id);

  const root = document.createElement("div");
  root.className = "detail-root";
  root.dataset.stepId = step.id;

  const header = document.createElement("div");
  header.className = "detail-header";
  header.innerHTML = `
    <span class="detail-icon">${icon}</span>
    <div class="detail-title-wrap">
      <div class="detail-title">${step.name} <span class="detail-status status-idle">Unstaffed</span></div>
      <div class="detail-sub">${step.description}</div>
    </div>
  `;
  root.appendChild(header);

  const meta = document.createElement("div");
  meta.className = "detail-meta";
  meta.innerHTML = `
    <div class="detail-stat"><span>Output</span><strong data-detail="rate">0.00/s</strong></div>
    <div class="detail-stat"><span>Ruin rate</span><strong data-detail="ruin">0%</strong></div>
    <div class="detail-stat"><span>Base time</span><strong>${step.baseTime}s</strong></div>
    <div class="detail-progress"><div class="detail-progress-fill" data-detail="progress"></div></div>
  `;
  root.appendChild(meta);

  if (broken) {
    const banner = document.createElement("div");
    banner.className = "detail-broken";
    banner.innerHTML = `<span>⚠️ This station broke down and is halted.</span>`;
    const repair = document.createElement("button");
    repair.className = "repair-btn";
    repair.textContent = `🔧 Repair (${formatCost(STATION_REPAIR_COST)})`;
    repair.disabled = state.resources.money < STATION_REPAIR_COST;
    repair.onclick = () => {
      ctx.systems.pipeline.repairStation(ctx.getState(), step.id);
      ctx.rebuildUI();
    };
    banner.appendChild(repair);
    root.appendChild(banner);
  } else {
    root.appendChild(buildScheduler(ctx, step.id));
  }

  root.appendChild(buildFlow(ctx, step));
  detail.appendChild(root);
}

/** Crew of the line (one card per assigned elf) + an "+ Assign elf" flow. */
function buildScheduler(ctx: GameContext, stepId: string): HTMLElement {
  const state = ctx.getState();

  const wrap = document.createElement("div");
  wrap.className = "sched";

  const title = document.createElement("div");
  title.className = "sched-title";
  title.textContent = "Crew on this line";
  wrap.appendChild(title);

  if (ownedElfTypes(state).length === 0) {
    const hint = document.createElement("div");
    hint.className = "detail-empty";
    hint.textContent = "No elves yet — hire some in the Upgrades tab.";
    wrap.appendChild(hint);
    return wrap;
  }

  const crew = document.createElement("div");
  crew.className = "crew-list";
  const onStep = elvesOnStep(state, stepId);
  if (onStep.length === 0) {
    crew.innerHTML = `<span class="crew-empty">No elves on this line yet.</span>`;
  } else {
    for (const elf of onStep) crew.appendChild(buildCrewCard(ctx, elf));
  }
  wrap.appendChild(crew);

  const addBtn = document.createElement("button");
  addBtn.className = "assign-open";
  addBtn.textContent = "+ Assign elf";
  addBtn.onclick = () => {
    if (wrap.querySelector(".assign-panel")) return; // one panel at a time
    addBtn.disabled = true;
    wrap.appendChild(
      buildAssignPanel(ctx, stepId, () => {
        wrap.querySelector(".assign-panel")?.remove();
        addBtn.disabled = false;
      })
    );
  };
  wrap.appendChild(addBtn);

  return wrap;
}

/** One assigned elf: type + the slots it covers; ✕ sends it home (spent). */
function buildCrewCard(ctx: GameContext, elf: ElfInstance): HTMLElement {
  const def = getElfType(elf.type);
  const card = document.createElement("div");
  card.className = "elf-card";

  const pips = shiftSlots
    .map((s) => {
      const on = elf.slots.includes(s.id);
      return `<span class="slot-pip${on ? " on" : ""}" data-slot="${s.id}" title="${s.name}">${s.icon}</span>`;
    })
    .join("");

  card.innerHTML = `
    <span class="elf-card-icon">${def?.icon ?? "🧝"}</span>
    <div class="elf-card-info">
      <span class="elf-card-name">${def?.name ?? "Elf"}</span>
      <span class="elf-card-slots">${pips}</span>
    </div>
  `;

  const remove = document.createElement("button");
  remove.className = "elf-remove";
  remove.textContent = "✕";
  remove.title = "Send home (idle until tomorrow)";
  remove.onclick = () => openRemoveConfirm(ctx, card, elf.id, def?.name ?? "elf");
  card.appendChild(remove);

  return card;
}

/**
 * Assign flow: pick an idle elf type, then choose ALL of its shift slots, then
 * confirm. The elf works exactly its type's shift count (drunken skips night).
 */
function buildAssignPanel(ctx: GameContext, stepId: string, onClose: () => void): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "assign-panel";

  let selectedType: string | null = null;
  let selectedSlots: string[] = [];

  function render(): void {
    const state = ctx.getState();
    const options = ownedElfTypes(state).filter((t) => idleOfType(state, t.id) > 0);
    panel.innerHTML = "";

    const head = document.createElement("div");
    head.className = "assign-title";
    head.textContent = "Assign an elf — pick who, then choose their shifts";
    panel.appendChild(head);

    if (options.length === 0) {
      const empty = document.createElement("div");
      empty.className = "picker-empty";
      empty.textContent = "No idle elves — hire more or wait until tomorrow.";
      panel.appendChild(empty);
    } else {
      // Step 1: pick elf type
      const typeRow = document.createElement("div");
      typeRow.className = "assign-types";
      for (const t of options) {
        const btn = document.createElement("button");
        btn.className = "assign-type" + (selectedType === t.id ? " active" : "");
        btn.innerHTML = `<span>${t.icon} ${t.name}</span><span class="picker-free">${idleOfType(
          state,
          t.id
        )} idle</span>`;
        btn.onclick = () => {
          selectedType = t.id;
          selectedSlots = allowedSlots(t.id).slice(0, requiredShifts(t.id)); // sensible default
          render();
        };
        typeRow.appendChild(btn);
      }
      panel.appendChild(typeRow);

      // Step 2: choose the elf's shifts
      if (selectedType) {
        const need = requiredShifts(selectedType);
        const shiftHead = document.createElement("div");
        shiftHead.className = "assign-shift-head";
        shiftHead.textContent = `Choose ${need} shift${need > 1 ? "s" : ""} (${selectedSlots.length}/${need})`;
        panel.appendChild(shiftHead);

        const slotRow = document.createElement("div");
        slotRow.className = "assign-slots";
        for (const slot of shiftSlots) {
          const allowed = canWorkSlot(selectedType, slot.id);
          const on = selectedSlots.includes(slot.id);
          const btn = document.createElement("button");
          btn.className = "assign-slot" + (on ? " on" : "");
          btn.disabled = !allowed;
          btn.innerHTML = `${slot.icon}<small>${slot.name}</small>`;
          if (!allowed) btn.title = "Won't work this slot";
          btn.onclick = () => {
            if (on) {
              selectedSlots = selectedSlots.filter((s) => s !== slot.id);
            } else if (selectedSlots.length < need) {
              selectedSlots = [...selectedSlots, slot.id];
            }
            render();
          };
          slotRow.appendChild(btn);
        }
        panel.appendChild(slotRow);
      }
    }

    // Footer
    const footer = document.createElement("div");
    footer.className = "assign-footer";
    const assign = document.createElement("button");
    assign.className = "assign-confirm";
    assign.textContent = "Assign";
    assign.disabled =
      !selectedType || selectedSlots.length !== requiredShifts(selectedType);
    assign.onclick = () => {
      if (!selectedType) return;
      ctx.systems.pipeline.assignElf(ctx.getState(), selectedType, stepId, selectedSlots);
      ctx.rebuildUI();
    };
    const cancel = document.createElement("button");
    cancel.className = "assign-cancel";
    cancel.textContent = "Cancel";
    cancel.onclick = () => onClose();
    footer.append(assign, cancel);
    panel.appendChild(footer);
  }

  render();
  return panel;
}

/** Confirm before sending an elf home — it loses its whole schedule for the day. */
function openRemoveConfirm(ctx: GameContext, anchor: HTMLElement, elfId: number, name: string): void {
  ctx.dom.factoryDetail.querySelectorAll(".confirm-pop").forEach((p) => p.remove());

  const pop = document.createElement("div");
  pop.className = "confirm-pop";
  pop.innerHTML = `<div class="confirm-text">Send this ${name} home? They lose all their shifts and are <strong>idle until tomorrow</strong>.</div>`;

  const actions = document.createElement("div");
  actions.className = "confirm-actions";

  const yes = document.createElement("button");
  yes.className = "confirm-yes";
  yes.textContent = "Send home";
  yes.onclick = () => {
    ctx.systems.pipeline.removeElf(ctx.getState(), elfId);
    ctx.rebuildUI();
  };

  const no = document.createElement("button");
  no.className = "confirm-no";
  no.textContent = "Cancel";
  no.onclick = () => pop.remove();

  actions.append(yes, no);
  pop.appendChild(actions);
  anchor.appendChild(pop);
}

/** Input→output flow for the step, per unlocked toy. */
function buildFlow(ctx: GameContext, step: PipelineStepDef): HTMLElement {
  const state = ctx.getState();
  const wrap = document.createElement("div");
  wrap.className = "detail-flow";

  const title = document.createElement("div");
  title.className = "sched-title";
  title.textContent = "Work in progress";
  wrap.appendChild(title);

  const inStage = step.inputStage ? PRODUCTION_STAGES.find((s) => s.id === step.inputStage) : null;
  const outStage = PRODUCTION_STAGES.find((s) => s.id === step.outputStage)!;
  const toys = getUnlockedToyTypes(state).filter((t) => !step.toyType || t.id === step.toyType);

  for (const t of toys) {
    const row = document.createElement("div");
    row.className = "flow-row";
    const inPart = inStage
      ? `<span class="flow-stage">${inStage.icon} <b data-flow="${t.id}:${inStage.id}">0</b></span><span class="flow-arrow">→</span>`
      : "";
    row.innerHTML = `
      <span class="flow-toy">${t.icon} ${t.name}</span>
      <span class="flow-io">${inPart}<span class="flow-stage out">${outStage.icon} <b data-flow="${t.id}:${outStage.id}">0</b></span></span>
    `;
    wrap.appendChild(row);
  }

  return wrap;
}
