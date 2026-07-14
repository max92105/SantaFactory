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
import type { QueueMode } from "../../../state/GameState";
import {
  getOrderedSteps,
  getPipelineStep,
  PRODUCTION_STAGES,
  type PipelineStepDef,
} from "../../../config/pipelineConfig";
import { getToyType, type ToyTypeDef } from "../../../config/toyTypesConfig";
import { getElfType, type ElfRole } from "../../../config/elfTypesConfig";
import { shiftSlots } from "../../../config/shiftsConfig";
import { getUnlockedToyTypes } from "../../../helpers/unlockHelpers";
import { ensureInventory, getBrokenStock, getTotalBroken } from "../../../helpers/inventoryHelpers";
import {
  totalElves,
  totalIdle,
  idleOfType,
  onShiftCount,
  ownedElfTypes,
  scheduledOnStep,
  activeMechanics,
  activeMenders,
  canWorkSlot,
  allowedSlots,
  requiredShifts,
  crewGroups,
  type CrewGroup,
} from "../../../helpers/workforceHelpers";
import { isStationBroken, brokenStationCount, brokenStepIds } from "../../../helpers/stationHelpers";
import { STATION_REPAIR_COST, MAINTENANCE_STEP, REPAIR_STEP } from "../../../config/stationsConfig";
import { formatInt, formatCost } from "../../../helpers/formatHelpers";

type Status = { cls: string; label: string };

/** Per-role wording for the crew scheduler / assign panel (workers/mechanics/menders). */
const ROLE_TEXT: Record<ElfRole, {
  crewTitle: string;
  addBtn: string;
  noneHired: string;
  crewEmpty: string;
  assignHead: string;
  pickerEmpty: string;
}> = {
  worker: {
    crewTitle: "Crew on this line",
    addBtn: "+ Assign elf",
    noneHired: "No workers yet — hire some in the Upgrades tab.",
    crewEmpty: "No elves on this line yet.",
    assignHead: "Assign elves — pick who, choose their shifts, set how many",
    pickerEmpty: "No idle workers — hire more or wait until tomorrow.",
  },
  mechanic: {
    crewTitle: "Mechanics on maintenance",
    addBtn: "+ Assign mechanic",
    noneHired: "No mechanics yet — hire some under Maintenance Crew in the Upgrades tab.",
    crewEmpty: "No mechanics scheduled yet.",
    assignHead: "Assign mechanics — pick who, choose their shifts, set how many",
    pickerEmpty: "No idle mechanics — hire more or wait until tomorrow.",
  },
  mender: {
    crewTitle: "Menders on the repair bench",
    addBtn: "+ Assign mender",
    noneHired: "No menders yet — hire some under Repair Crew in the Upgrades tab.",
    crewEmpty: "No menders scheduled yet.",
    assignHead: "Assign menders — pick who, choose their shifts, set how many",
    pickerEmpty: "No idle menders — hire more or wait until tomorrow.",
  },
};

function statusOf(view: StepProgress | undefined, scheduled: number): Status {
  if (!view) return { cls: "idle", label: "Unstaffed" };
  if (view.broken) return { cls: "broken", label: "Broken" };
  if (view.elvesAssigned > 0 && view.isBottlenecked) return { cls: "starved", label: "No input" };
  if (view.elvesAssigned > 0) return { cls: "working", label: "Working" };
  if (scheduled > 0) return { cls: "scheduled", label: "Off shift" };
  return { cls: "idle", label: "Unstaffed" };
}

/** Rail status for the virtual Maintenance line. */
function maintenanceStatus(state: ReturnType<GameContext["getState"]>, slot: string): Status {
  const broken = brokenStationCount(state);
  const onShift = activeMechanics(state, slot).length;
  const scheduled = scheduledOnStep(state, MAINTENANCE_STEP);
  if (broken > 0 && onShift > 0) return { cls: "working", label: `Repairing ${broken}` };
  if (broken > 0) return { cls: "broken", label: `${broken} down` };
  if (onShift > 0) return { cls: "working", label: "On call" };
  if (scheduled > 0) return { cls: "scheduled", label: "Off shift" };
  return { cls: "idle", label: "No mechanics" };
}

/** Rail status for the virtual Repair Bench line. */
function repairBenchStatus(state: ReturnType<GameContext["getState"]>, slot: string): Status {
  const broken = Math.floor(getTotalBroken(state));
  const onShift = activeMenders(state, slot).length;
  const scheduled = scheduledOnStep(state, REPAIR_STEP);
  if (broken > 0 && onShift > 0) return { cls: "working", label: `Mending ${broken}` };
  if (onShift > 0) return { cls: "working", label: "On call" };
  if (broken > 0) return { cls: "starved", label: `${broken} to mend` };
  if (scheduled > 0) return { cls: "scheduled", label: "Off shift" };
  return { cls: "idle", label: "No menders" };
}

/** Aggregate rail status for a toy line (rolls up all its production steps). */
function toyLineStatus(
  state: ReturnType<GameContext["getState"]>,
  viewById: Map<string, StepProgress>,
  toyId: string
): Status {
  let broken = false;
  let working = false;
  let starved = false;
  let scheduled = false;
  for (const s of getOrderedSteps().filter((st) => st.toyType === toyId)) {
    const v = viewById.get(s.id);
    if (v?.broken) broken = true;
    else if (v && v.elvesAssigned > 0) v.isBottlenecked ? (starved = true) : (working = true);
    if (scheduledOnStep(state, s.id) > 0) scheduled = true;
  }
  if (broken) return { cls: "broken", label: "Broken" };
  if (working) return { cls: "working", label: "Working" };
  if (starved) return { cls: "starved", label: "No input" };
  if (scheduled) return { cls: "scheduled", label: "Off shift" };
  return { cls: "idle", label: "Unstaffed" };
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
      // Crafting is now selected per TOY (one rail entry per toy line); shared
      // steps + Maintenance + Repair are still selected by step id.
      const toyIds = getUnlockedToyTypes(ctx.getState()).map((t) => t.id);
      const sharedIds = getOrderedSteps()
        .filter((s) => !s.toyType)
        .map((s) => s.id);
      const validIds = [...toyIds, ...sharedIds, MAINTENANCE_STEP, REPAIR_STEP];
      if (!selectedStepId || !validIds.includes(selectedStepId)) {
        selectedStepId = validIds[0] ?? null;
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

      // Rail status dots (toy-line items aggregate their steps)
      ctx.dom.factoryRail.querySelectorAll<HTMLElement>(".rail-item").forEach((item) => {
        let st: Status;
        if (item.dataset.toyId) {
          st = toyLineStatus(state, viewById, item.dataset.toyId);
        } else {
          const id = item.dataset.stepId!;
          st =
            id === MAINTENANCE_STEP
              ? maintenanceStatus(state, slot)
              : id === REPAIR_STEP
              ? repairBenchStatus(state, slot)
              : statusOf(viewById.get(id), scheduledOnStep(state, id));
        }
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

      // Maintenance line has its own live values
      if (shownId === MAINTENANCE_STEP) {
        const st = maintenanceStatus(state, slot);
        const mBadge = ctx.dom.factoryDetail.querySelector<HTMLElement>(".detail-status");
        if (mBadge) {
          mBadge.className = `detail-status status-${st.cls}`;
          mBadge.textContent = st.label;
        }
        const onShiftEl = ctx.dom.factoryDetail.querySelector<HTMLElement>('[data-detail="onshift"]');
        if (onShiftEl) onShiftEl.textContent = formatInt(activeMechanics(state, slot).length);
        const brokenEl = ctx.dom.factoryDetail.querySelector<HTMLElement>('[data-detail="brokencount"]');
        if (brokenEl) brokenEl.textContent = formatInt(brokenStationCount(state));
        ctx.dom.factoryDetail.querySelectorAll<HTMLElement>("[data-repair]").forEach((bar) => {
          const pct = ctx.systems.pipeline.repairProgressOf(bar.dataset.repair!) * 100;
          bar.style.width = `${Math.floor(pct)}%`;
        });
        return;
      }

      // Repair Bench line has its own live values
      if (shownId === REPAIR_STEP) {
        const st = repairBenchStatus(state, slot);
        const rBadge = ctx.dom.factoryDetail.querySelector<HTMLElement>(".detail-status");
        if (rBadge) {
          rBadge.className = `detail-status status-${st.cls}`;
          rBadge.textContent = st.label;
        }
        const mEl = ctx.dom.factoryDetail.querySelector<HTMLElement>('[data-detail="menders"]');
        if (mEl) mEl.textContent = formatInt(activeMenders(state, slot).length);
        const bEl = ctx.dom.factoryDetail.querySelector<HTMLElement>('[data-detail="brokentoys"]');
        if (bEl) bEl.textContent = formatInt(Math.floor(getTotalBroken(state)));
        // Live per-toy rows: count ticks down each mend; row stays (dimmed) at 0.
        ctx.dom.factoryDetail.querySelectorAll<HTMLElement>("[data-refurb-row]").forEach((row) => {
          const toyId = row.dataset.refurbRow!;
          const broken = getBrokenStock(state, toyId);
          const countEl = row.querySelector<HTMLElement>("[data-refurb-count]");
          if (countEl) countEl.textContent = formatInt(broken);
          const bar = row.querySelector<HTMLElement>("[data-refurb]");
          if (bar) bar.style.width = broken > 0 ? `${Math.floor(ctx.systems.pipeline.refurbishProgressOf(toyId) * 100)}%` : "0%";
          row.classList.toggle("mended", broken <= 0);
        });
        return;
      }

      // Toy-line or shared-step detail: update every step-control block.
      ctx.dom.factoryDetail.querySelectorAll<HTMLElement>(".detail-step[data-step-id]").forEach((block) => {
        const id = block.dataset.stepId!;
        const view = viewById.get(id);

        const badge = block.querySelector<HTMLElement>(".detail-status");
        if (badge) {
          const st = statusOf(view, scheduledOnStep(state, id));
          badge.className = `detail-status status-${st.cls}`;
          badge.textContent = st.label;
        }
        const rate = block.querySelector<HTMLElement>('[data-detail="rate"]');
        if (rate) rate.textContent = `${(view?.outputPerSecond ?? 0).toFixed(2)}/s`;
        const ruin = block.querySelector<HTMLElement>('[data-detail="ruin"]');
        if (ruin) ruin.textContent = `${Math.round((view?.mistakeChance ?? 0) * 100)}%`;
        const pbar = block.querySelector<HTMLElement>('[data-detail="progress"]');
        if (pbar) pbar.style.width = `${Math.floor((view?.progress ?? 0) * 100)}%`;

        // Broken? show this station's mechanic auto-repair progress inline.
        const repairFill = block.querySelector<HTMLElement>("[data-repair]");
        if (repairFill) {
          const pct = Math.floor(ctx.systems.pipeline.repairProgressOf(id) * 100);
          repairFill.style.width = `${pct}%`;
          const hint = block.querySelector<HTMLElement>("[data-repair-hint]");
          if (hint) {
            const mechs = activeMechanics(state, slot).length;
            hint.classList.toggle("working", mechs > 0);
            hint.textContent =
              mechs > 0
                ? `🔧 ${formatInt(mechs)} mechanic${mechs > 1 ? "s" : ""} on the job — repairing… ${pct}%`
                : "No mechanic on shift — repair manually, or assign mechanics under Upkeep.";
          }
        }
      });

      // WIP flow counts (a stage cell can appear in several step blocks → update all)
      for (const t of getUnlockedToyTypes(state)) {
        const inv = ensureInventory(state, t.id);
        for (const stage of PRODUCTION_STAGES) {
          ctx.dom.factoryDetail
            .querySelectorAll<HTMLElement>(`[data-flow="${t.id}:${stage.id}"]`)
            .forEach((cell) => (cell.textContent = formatInt(inv[stage.id])));
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

  // Crafting: one entry per unlocked toy — its whole line lives in the detail.
  const toys = getUnlockedToyTypes(state);
  if (toys.length > 0) {
    const head = document.createElement("div");
    head.className = "rail-group-label";
    head.textContent = "Crafting";
    rail.appendChild(head);

    for (const toy of toys) {
      const item = document.createElement("button");
      item.className = "rail-item" + (selectedId === toy.id ? " active" : "");
      item.dataset.toyId = toy.id;
      item.innerHTML = `
        <span class="rail-status status-idle"></span>
        <span class="rail-icon">${toy.icon}</span>
        <span class="rail-name">${toy.name}</span>
      `;
      item.onclick = () => onSelect(toy.id);
      rail.appendChild(item);
    }
  }

  // Processing: shared steps that handle every toy (Quality Control, Packaging).
  const shared = getOrderedSteps().filter((s) => !s.toyType);
  appendRailGroup(rail, "Processing", shared, selectedId, onSelect);

  // Virtual Maintenance line (mechanics auto-repair broken stations)
  const maintHead = document.createElement("div");
  maintHead.className = "rail-group-label";
  maintHead.textContent = "Upkeep";
  rail.appendChild(maintHead);

  const maint = document.createElement("button");
  maint.className = "rail-item" + (selectedId === MAINTENANCE_STEP ? " active" : "");
  maint.dataset.stepId = MAINTENANCE_STEP;
  maint.innerHTML = `
    <span class="rail-status status-idle"></span>
    <span class="rail-icon">🔧</span>
    <span class="rail-name">Maintenance</span>
  `;
  maint.onclick = () => onSelect(MAINTENANCE_STEP);
  rail.appendChild(maint);

  // Virtual Repair Bench line (menders refurbish broken toys)
  const repair = document.createElement("button");
  repair.className = "rail-item" + (selectedId === REPAIR_STEP ? " active" : "");
  repair.dataset.stepId = REPAIR_STEP;
  repair.innerHTML = `
    <span class="rail-status status-idle"></span>
    <span class="rail-icon">🪡</span>
    <span class="rail-name">Repair Bench</span>
  `;
  repair.onclick = () => onSelect(REPAIR_STEP);
  rail.appendChild(repair);
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
function buildDetail(ctx: GameContext, selectedId: string | null): void {
  const detail = ctx.dom.factoryDetail;
  detail.innerHTML = "";

  if (selectedId === MAINTENANCE_STEP) {
    buildMaintenanceDetail(ctx);
    return;
  }
  if (selectedId === REPAIR_STEP) {
    buildRepairDetail(ctx);
    return;
  }

  // A toy id selects that toy's whole line; a step id selects a shared step.
  const toy = selectedId ? getToyType(selectedId) : null;
  if (toy) {
    buildToyLineDetail(ctx, toy);
    return;
  }

  const step = selectedId ? getPipelineStep(selectedId) : null;
  if (!step) {
    detail.innerHTML = `<div class="detail-empty">No production lines yet.</div>`;
    return;
  }
  buildSharedStepDetail(ctx, step);
}

/** A toy's line: a header + one repeatable step control per production step. */
function buildToyLineDetail(ctx: GameContext, toy: ToyTypeDef): void {
  const detail = ctx.dom.factoryDetail;
  const steps = getOrderedSteps().filter((s) => s.toyType === toy.id);

  const head = document.createElement("div");
  head.className = "detail-toyhead";
  head.innerHTML = `
    <span class="detail-toyhead-icon">${toy.icon}</span>
    <div class="detail-toyhead-text">
      <div class="detail-toyhead-name">${toy.name}</div>
      <div class="detail-toyhead-sub">${steps.length} production step${
        steps.length === 1 ? "" : "s"
      } → Quality Control → Packaging · sells ${formatCost(toy.baseSellValue)} ea</div>
    </div>
  `;
  detail.appendChild(head);

  for (const step of steps) detail.appendChild(buildStepControl(ctx, step));
}

/** A shared processing step (Quality Control / Packaging): its control + queue mode. */
function buildSharedStepDetail(ctx: GameContext, step: PipelineStepDef): void {
  const detail = ctx.dom.factoryDetail;
  detail.appendChild(buildStepControl(ctx, step));
  if (!step.toyType && step.inputStage && getUnlockedToyTypes(ctx.getState()).length > 1) {
    detail.appendChild(buildQueueMode(ctx, step.id));
  }
}

/** One production step's control block: header, live meta, crew/repair, WIP flow. */
function buildStepControl(ctx: GameContext, step: PipelineStepDef): HTMLElement {
  const state = ctx.getState();
  const toy = step.toyType ? getToyType(step.toyType) : null;
  const icon = toy ? toy.icon : "⚙️";
  const broken = isStationBroken(state, step.id);

  const block = document.createElement("div");
  block.className = "detail-step";
  block.dataset.stepId = step.id;

  const header = document.createElement("div");
  header.className = "detail-header";
  header.innerHTML = `
    <span class="detail-icon">${icon}</span>
    <div class="detail-title-wrap">
      <div class="detail-title">${step.name} <span class="detail-status status-idle">Unstaffed</span></div>
      <div class="detail-sub">${step.description}</div>
    </div>
  `;
  block.appendChild(header);

  const meta = document.createElement("div");
  meta.className = "detail-meta";
  meta.innerHTML = `
    <div class="detail-stat"><span>Output</span><strong data-detail="rate">0.00/s</strong></div>
    <div class="detail-stat"><span>Ruin rate</span><strong data-detail="ruin">0%</strong></div>
    <div class="detail-stat"><span>Base time</span><strong>${step.baseTime}s</strong></div>
    <div class="detail-progress"><div class="detail-progress-fill" data-detail="progress"></div></div>
  `;
  block.appendChild(meta);

  if (broken) {
    block.appendChild(brokenBanner(ctx, step.id, "This station broke down and is halted."));
  } else {
    block.appendChild(buildScheduler(ctx, step.id, "worker"));
  }

  block.appendChild(buildFlow(ctx, step));
  return block;
}

/** Queue-mode picker for a shared/virtual step: how it chooses which toy next. */
function buildQueueMode(
  ctx: GameContext,
  stepId: string,
  titleText = "Queue mode — which toy to work next"
): HTMLElement {
  const state = ctx.getState();
  const setting = ctx.systems.pipeline.getQueueMode(state, stepId);
  const unlocked = getUnlockedToyTypes(state);

  const wrap = document.createElement("div");
  wrap.className = "queue-mode";

  const title = document.createElement("div");
  title.className = "sched-title";
  title.textContent = titleText;
  wrap.appendChild(title);

  const modes: { id: QueueMode; label: string; desc: string }[] = [
    { id: "order", label: "In order", desc: "Finishes the top toy's queue before starting the next." },
    { id: "balanced", label: "Balanced", desc: "Takes one of each toy in turn — every queue advances together." },
    { id: "focus", label: "Focus a toy", desc: "Always works the chosen toy first; the rest in order when it's empty." },
  ];

  const seg = document.createElement("div");
  seg.className = "queue-seg";
  for (const m of modes) {
    const btn = document.createElement("button");
    btn.className = "queue-seg-btn" + (setting.mode === m.id ? " active" : "");
    btn.textContent = m.label;
    btn.onclick = () => {
      const focus = m.id === "focus" ? setting.focus ?? unlocked[0]?.id : undefined;
      ctx.systems.pipeline.setQueueMode(ctx.getState(), stepId, m.id, focus);
      ctx.rebuildUI();
    };
    seg.appendChild(btn);
  }
  wrap.appendChild(seg);

  if (setting.mode === "focus") {
    const toys = document.createElement("div");
    toys.className = "queue-toys";
    for (const t of unlocked) {
      const chip = document.createElement("button");
      chip.className = "queue-toy" + (setting.focus === t.id ? " active" : "");
      chip.innerHTML = `${t.icon} <span>${t.name}</span>`;
      chip.onclick = () => {
        ctx.systems.pipeline.setQueueMode(ctx.getState(), stepId, "focus", t.id);
        ctx.rebuildUI();
      };
      toys.appendChild(chip);
    }
    wrap.appendChild(toys);
  }

  const desc = document.createElement("div");
  desc.className = "queue-desc";
  if (setting.mode === "focus") {
    const ft = unlocked.find((t) => t.id === setting.focus);
    desc.textContent = ft
      ? `Always works ${ft.icon} ${ft.name} first; the rest in order when it's empty.`
      : modes[2].desc;
  } else {
    desc.textContent = modes.find((m) => m.id === setting.mode)!.desc;
  }
  wrap.appendChild(desc);

  return wrap;
}

/**
 * A red banner for a broken station: manual-repair button plus a live
 * mechanic auto-repair progress bar (fills as mechanics on shift work it).
 * The bar + hint are refreshed each frame in renderFrame.
 */
function brokenBanner(ctx: GameContext, stepId: string, text: string): HTMLElement {
  const state = ctx.getState();
  const banner = document.createElement("div");
  banner.className = "detail-broken";

  const top = document.createElement("div");
  top.className = "detail-broken-top";
  top.innerHTML = `<span>⚠️ ${text}</span>`;
  const repair = document.createElement("button");
  repair.className = "repair-btn";
  repair.textContent = `🔧 Repair (${formatCost(STATION_REPAIR_COST)})`;
  repair.disabled = state.resources.money < STATION_REPAIR_COST;
  repair.onclick = () => {
    ctx.systems.pipeline.repairStation(ctx.getState(), stepId);
    ctx.rebuildUI();
  };
  top.appendChild(repair);
  banner.appendChild(top);

  const auto = document.createElement("div");
  auto.className = "repair-auto";
  auto.innerHTML = `
    <div class="repair-track"><div class="repair-fill" data-repair="${stepId}"></div></div>
    <span class="repair-hint" data-repair-hint>…</span>
  `;
  banner.appendChild(auto);

  return banner;
}

// ── Maintenance line ──────────────────────────────────────────────────────
/** Detail for the virtual Maintenance line: schedule mechanics + repair status. */
function buildMaintenanceDetail(ctx: GameContext): void {
  const state = ctx.getState();
  const detail = ctx.dom.factoryDetail;

  const root = document.createElement("div");
  root.className = "detail-root";
  root.dataset.stepId = MAINTENANCE_STEP;

  root.innerHTML = `
    <div class="detail-header">
      <span class="detail-icon">🔧</span>
      <div class="detail-title-wrap">
        <div class="detail-title">Maintenance <span class="detail-status status-idle">…</span></div>
        <div class="detail-sub">Mechanics on shift auto-repair broken stations — no repair fee.</div>
      </div>
    </div>
    <div class="detail-meta">
      <div class="detail-stat"><span>Mechanics on shift</span><strong data-detail="onshift">0</strong></div>
      <div class="detail-stat"><span>Stations down</span><strong data-detail="brokencount">0</strong></div>
    </div>
  `;

  // Broken-station repair list
  const repairs = document.createElement("div");
  repairs.className = "detail-repairs";
  repairs.innerHTML = `<div class="sched-title">Broken stations</div>`;
  const broken = brokenStepIds(state);
  if (broken.length === 0) {
    const ok = document.createElement("div");
    ok.className = "crew-empty";
    ok.textContent = "All stations running. 🟢";
    repairs.appendChild(ok);
  } else {
    for (const stepId of broken) {
      const step = getPipelineStep(stepId);
      const toy = step?.toyType ? getToyType(step.toyType) : null;
      const row = document.createElement("div");
      row.className = "repair-row";
      row.innerHTML = `
        <span class="repair-icon">${toy ? toy.icon : "⚙️"}</span>
        <div class="repair-info">
          <div class="repair-name">${step?.name ?? stepId}</div>
          <div class="repair-track"><div class="repair-fill" data-repair="${stepId}"></div></div>
        </div>
      `;
      const btn = document.createElement("button");
      btn.className = "repair-btn small";
      btn.textContent = `Repair ${formatCost(STATION_REPAIR_COST)}`;
      btn.disabled = state.resources.money < STATION_REPAIR_COST;
      btn.onclick = () => {
        ctx.systems.pipeline.repairStation(ctx.getState(), stepId);
        ctx.rebuildUI();
      };
      row.appendChild(btn);
      repairs.appendChild(row);
    }
  }
  root.appendChild(repairs);

  // Mechanic scheduler (reuses the crew UI, filtered to mechanics)
  root.appendChild(buildScheduler(ctx, MAINTENANCE_STEP, "mechanic"));

  detail.appendChild(root);
}

// ── Repair Bench line ───────────────────────────────────────────────────────
/** Detail for the virtual Repair Bench: schedule menders + broken-toy status. */
function buildRepairDetail(ctx: GameContext): void {
  const state = ctx.getState();
  const detail = ctx.dom.factoryDetail;

  const root = document.createElement("div");
  root.className = "detail-root";
  root.dataset.stepId = REPAIR_STEP;

  root.innerHTML = `
    <div class="detail-header">
      <span class="detail-icon">🪡</span>
      <div class="detail-title-wrap">
        <div class="detail-title">Repair Bench <span class="detail-status status-idle">…</span></div>
        <div class="detail-sub">Menders on shift refurbish broken toys back into finished gifts — you only pay their wage.</div>
      </div>
    </div>
    <div class="detail-meta">
      <div class="detail-stat"><span>Menders on shift</span><strong data-detail="menders">0</strong></div>
      <div class="detail-stat"><span>Broken toys waiting</span><strong data-detail="brokentoys">0</strong></div>
    </div>
  `;

  // Broken-toy list — one row per unlocked toy, kept visible so counts can
  // tick down live (and rows don't vanish the instant a pile is cleared).
  const list = document.createElement("div");
  list.className = "detail-repairs";
  list.innerHTML = `<div class="sched-title">Broken toys</div>`;
  for (const toy of getUnlockedToyTypes(state)) {
    const broken = getBrokenStock(state, toy.id);
    const row = document.createElement("div");
    row.className = "repair-row" + (broken <= 0 ? " mended" : "");
    row.dataset.refurbRow = toy.id;
    row.innerHTML = `
      <span class="repair-icon">${toy.icon}</span>
      <div class="repair-info">
        <div class="repair-name">${toy.name} — <strong data-refurb-count="${toy.id}">${formatInt(broken)}</strong> broken</div>
        <div class="repair-track"><div class="repair-fill" data-refurb="${toy.id}"></div></div>
      </div>
    `;
    list.appendChild(row);
  }
  root.appendChild(list);

  // Mender scheduler (reuses the crew UI, filtered to menders)
  root.appendChild(buildScheduler(ctx, REPAIR_STEP, "mender"));

  // Same order / balanced / focus modes as Quality Control/Packaging, over broken piles.
  if (getUnlockedToyTypes(state).length > 1) {
    root.appendChild(buildQueueMode(ctx, REPAIR_STEP, "Queue mode — which toy to mend next"));
  }

  detail.appendChild(root);
}

/** Crew of the line (one card per assigned elf) + an "+ Assign elf" flow. */
function buildScheduler(ctx: GameContext, stepId: string, role: ElfRole): HTMLElement {
  const state = ctx.getState();
  const T = ROLE_TEXT[role];

  const wrap = document.createElement("div");
  wrap.className = "sched";

  const title = document.createElement("div");
  title.className = "sched-title";
  title.textContent = T.crewTitle;
  wrap.appendChild(title);

  const ownedOfRole = ownedElfTypes(state).filter((t) => t.role === role);
  if (ownedOfRole.length === 0) {
    const hint = document.createElement("div");
    hint.className = "detail-empty";
    hint.textContent = T.noneHired;
    wrap.appendChild(hint);
    return wrap;
  }

  const crew = document.createElement("div");
  crew.className = "crew-list";
  const groups = crewGroups(state, stepId);
  if (groups.length === 0) {
    crew.innerHTML = `<span class="crew-empty">${T.crewEmpty}</span>`;
  } else {
    for (const g of groups) crew.appendChild(buildCrewGroupCard(ctx, g));
  }
  wrap.appendChild(crew);

  const addBtn = document.createElement("button");
  addBtn.className = "assign-open";
  addBtn.textContent = T.addBtn;
  addBtn.onclick = () => {
    if (wrap.querySelector(".assign-panel")) return; // one panel at a time
    addBtn.disabled = true;
    wrap.appendChild(
      buildAssignPanel(ctx, stepId, role, () => {
        wrap.querySelector(".assign-panel")?.remove();
        addBtn.disabled = false;
      })
    );
  };
  wrap.appendChild(addBtn);

  return wrap;
}

/** A crew group (same type + same shifts): shows the count; ✕ opens batch remove. */
function buildCrewGroupCard(ctx: GameContext, group: CrewGroup): HTMLElement {
  const def = getElfType(group.type);
  const count = group.ids.length;
  const card = document.createElement("div");
  card.className = "elf-card";

  const pips = shiftSlots
    .map((s) => {
      const on = group.slots.includes(s.id);
      return `<span class="slot-pip${on ? " on" : ""}" data-slot="${s.id}" title="${s.name}">${s.icon}</span>`;
    })
    .join("");

  card.innerHTML = `
    <span class="elf-card-icon">${def?.icon ?? "🧝"}</span>
    <div class="elf-card-info">
      <span class="elf-card-name">${def?.name ?? "Elf"}${count > 1 ? ` <span class="elf-card-count">×${count}</span>` : ""}</span>
      <span class="elf-card-slots">${pips}</span>
    </div>
  `;

  const remove = document.createElement("button");
  remove.className = "elf-remove";
  remove.textContent = "✕";
  remove.title = count > 1 ? "Send some / all home" : "Send home (idle until tomorrow)";
  remove.onclick = () => openRemoveConfirm(ctx, card, group);
  card.appendChild(remove);

  return card;
}

/**
 * Assign flow: pick an idle elf type, then choose ALL of its shift slots, then
 * confirm. The elf works exactly its type's shift count (drunken skips night).
 */
function buildAssignPanel(
  ctx: GameContext,
  stepId: string,
  role: ElfRole,
  onClose: () => void
): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "assign-panel";

  let selectedType: string | null = null;
  let selectedSlots: string[] = [];
  let qty = 1;

  function render(): void {
    const state = ctx.getState();
    const options = ownedElfTypes(state).filter((t) => t.role === role && idleOfType(state, t.id) > 0);
    panel.innerHTML = "";

    const head = document.createElement("div");
    head.className = "assign-title";
    head.textContent = ROLE_TEXT[role].assignHead;
    panel.appendChild(head);

    if (options.length === 0) {
      const empty = document.createElement("div");
      empty.className = "picker-empty";
      empty.textContent = ROLE_TEXT[role].pickerEmpty;
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
          qty = 1;
          render();
        };
        typeRow.appendChild(btn);
      }
      panel.appendChild(typeRow);

      // Step 2: choose the shifts + how many
      if (selectedType) {
        const need = requiredShifts(selectedType);
        const idle = idleOfType(state, selectedType);
        qty = Math.max(1, Math.min(qty, idle));

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
            if (on) selectedSlots = selectedSlots.filter((s) => s !== slot.id);
            else if (selectedSlots.length < need) selectedSlots = [...selectedSlots, slot.id];
            render();
          };
          slotRow.appendChild(btn);
        }
        panel.appendChild(slotRow);

        // Quantity stepper
        const qtyRow = document.createElement("div");
        qtyRow.className = "assign-qty";
        qtyRow.append(
          stepper(qty, 1, idle, (v) => {
            qty = v;
            render();
          }),
          maxBtn(() => {
            qty = idle;
            render();
          }),
          note(`of ${idle} idle`)
        );
        panel.appendChild(qtyRow);
      }
    }

    // Footer
    const ready = !!selectedType && selectedSlots.length === (selectedType ? requiredShifts(selectedType) : 0);
    const footer = document.createElement("div");
    footer.className = "assign-footer";
    const assign = document.createElement("button");
    assign.className = "assign-confirm";
    assign.textContent = ready ? `Assign ${qty}` : "Assign";
    assign.disabled = !ready;
    assign.onclick = () => {
      if (!selectedType) return;
      ctx.systems.pipeline.assignElves(ctx.getState(), selectedType, stepId, selectedSlots, qty);
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

/** A small − N + stepper. */
function stepper(value: number, min: number, max: number, onChange: (v: number) => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "qty-stepper";
  const dec = document.createElement("button");
  dec.textContent = "−";
  dec.disabled = value <= min;
  dec.onclick = () => onChange(Math.max(min, value - 1));
  const val = document.createElement("span");
  val.className = "qty-val";
  val.textContent = String(value);
  const inc = document.createElement("button");
  inc.textContent = "+";
  inc.disabled = value >= max;
  inc.onclick = () => onChange(Math.min(max, value + 1));
  wrap.append(dec, val, inc);
  return wrap;
}

function maxBtn(onClick: () => void): HTMLElement {
  const b = document.createElement("button");
  b.className = "qty-max";
  b.textContent = "Max";
  b.onclick = onClick;
  return b;
}

function note(text: string): HTMLElement {
  const s = document.createElement("span");
  s.className = "qty-note";
  s.textContent = text;
  return s;
}

/** Confirm before sending elves home (batch) — they're spent until tomorrow. */
function openRemoveConfirm(ctx: GameContext, anchor: HTMLElement, group: CrewGroup): void {
  ctx.dom.factoryDetail.querySelectorAll(".confirm-pop").forEach((p) => p.remove());
  const def = getElfType(group.type);
  const total = group.ids.length;
  let qty = total; // default: send the whole group home

  const pop = document.createElement("div");
  pop.className = "confirm-pop";
  anchor.appendChild(pop);

  const render = () => {
    qty = Math.max(1, Math.min(qty, total));
    pop.innerHTML = "";

    const text = document.createElement("div");
    text.className = "confirm-text";
    text.innerHTML =
      total > 1
        ? `Send home how many ${def?.name ?? "elves"}? They're <strong>idle until tomorrow</strong>.`
        : `Send this ${def?.name ?? "elf"} home? They're <strong>idle until tomorrow</strong>.`;
    pop.appendChild(text);

    if (total > 1) {
      const qtyRow = document.createElement("div");
      qtyRow.className = "confirm-qty";
      qtyRow.append(
        stepper(qty, 1, total, (v) => {
          qty = v;
          render();
        }),
        note(`of ${total}`)
      );
      pop.appendChild(qtyRow);
    }

    const actions = document.createElement("div");
    actions.className = "confirm-actions";
    const yes = document.createElement("button");
    yes.className = "confirm-yes";
    yes.textContent = total > 1 ? `Send ${qty} home` : "Send home";
    yes.onclick = () => {
      ctx.systems.pipeline.removeElves(ctx.getState(), group.ids.slice(0, qty));
      ctx.rebuildUI();
    };
    const no = document.createElement("button");
    no.className = "confirm-no";
    no.textContent = "Cancel";
    no.onclick = () => pop.remove();
    actions.append(yes, no);
    pop.appendChild(actions);
  };

  render();
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
