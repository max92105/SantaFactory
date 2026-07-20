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
  requiredShifts,
  slotRestriction,
  stepCrewSpeedMult,
  crewGroups,
  type CrewGroup,
  type SlotRestriction,
} from "../../../helpers/workforceHelpers";
import { isStationBroken, brokenStationCount, brokenStepIds } from "../../../helpers/stationHelpers";
import { REPAIR_HOLD_SECONDS, MAINTENANCE_STEP, REPAIR_STEP } from "../../../config/stationsConfig";
import { formatInt, formatCost } from "../../../helpers/formatHelpers";
import { t } from "../../i18n/i18n";
import { toyName, elfName, stepName, stepDesc, slotName } from "../../i18n/localize";

type Status = { cls: string; label: string };

/** Per-role, localized wording for the crew scheduler / assign panel. */
function roleText(role: ElfRole): {
  crewTitle: string;
  addBtn: string;
  noneHired: string;
  crewEmpty: string;
  assignHead: string;
  pickerEmpty: string;
} {
  const cap = role === "mechanic" ? "Mech" : role === "mender" ? "Mender" : "Worker";
  return {
    crewTitle: t(role === "mechanic" ? "factory.mechsOnMaint" : role === "mender" ? "factory.mendersOnBench" : "factory.crewOnLine"),
    addBtn: t(role === "mechanic" ? "factory.assignMech" : role === "mender" ? "factory.assignMender" : "factory.assignElf"),
    noneHired: t(role === "mechanic" ? "factory.noMechanics" : role === "mender" ? "factory.noMenders" : "factory.noWorkers"),
    crewEmpty: t(`factory.crewEmpty${cap}`),
    assignHead: t(`factory.assignHead${cap}`),
    pickerEmpty: t(`factory.pickerEmpty${cap}`),
  };
}

/** One-line description of a specialist type's work rules (empty = no quirks). */
function elfTraitText(typeId: string): string {
  const def = getElfType(typeId);
  if (!def) return "";
  const bits: string[] = [];
  if (def.managerMult) bits.push(t("trait.manager", { mult: def.managerMult }));
  if (def.shy) bits.push(t("trait.shy"));
  if (def.dayOffChance) bits.push(t("trait.dayOff", { pct: Math.round(def.dayOffChance * 100) }));
  if (def.mistakeChance === 0 && !def.managerMult && def.role === "worker") bits.push(t("trait.perfect"));
  return bits.join(" · ");
}

/** Why a slot button is disabled in the assign panel. */
function restrictionText(r: SlotRestriction): string {
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

function statusOf(view: StepProgress | undefined, scheduled: number): Status {
  if (!view) return { cls: "idle", label: t("status.unstaffed") };
  if (view.broken) return { cls: "broken", label: t("status.broken") };
  if (view.elvesAssigned > 0 && view.isBottlenecked) return { cls: "starved", label: t("status.noInput") };
  if (view.elvesAssigned > 0) return { cls: "working", label: t("status.working") };
  if (scheduled > 0) return { cls: "scheduled", label: t("status.offShift") };
  return { cls: "idle", label: t("status.unstaffed") };
}

/** Rail status for the virtual Maintenance line. */
function maintenanceStatus(state: ReturnType<GameContext["getState"]>, slot: string): Status {
  const broken = brokenStationCount(state);
  const onShift = activeMechanics(state, slot).length;
  const scheduled = scheduledOnStep(state, MAINTENANCE_STEP);
  if (broken > 0 && onShift > 0) return { cls: "working", label: t("status.repairing", { n: broken }) };
  if (broken > 0) return { cls: "broken", label: t("status.down", { n: broken }) };
  if (onShift > 0) return { cls: "working", label: t("status.onCall") };
  if (scheduled > 0) return { cls: "scheduled", label: t("status.offShift") };
  return { cls: "idle", label: t("status.noMechanics") };
}

/** Rail status for the virtual Repair Bench line. */
function repairBenchStatus(state: ReturnType<GameContext["getState"]>, slot: string): Status {
  const broken = Math.floor(getTotalBroken(state));
  const onShift = activeMenders(state, slot).length;
  const scheduled = scheduledOnStep(state, REPAIR_STEP);
  if (broken > 0 && onShift > 0) return { cls: "working", label: t("status.mending", { n: broken }) };
  if (onShift > 0) return { cls: "working", label: t("status.onCall") };
  if (broken > 0) return { cls: "starved", label: t("status.toMend", { n: broken }) };
  if (scheduled > 0) return { cls: "scheduled", label: t("status.offShift") };
  return { cls: "idle", label: t("status.noMenders") };
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
  if (broken) return { cls: "broken", label: t("status.broken") };
  if (working) return { cls: "working", label: t("status.working") };
  if (starved) return { cls: "starved", label: t("status.noInput") };
  if (scheduled) return { cls: "scheduled", label: t("status.offShift") };
  return { cls: "idle", label: t("status.unstaffed") };
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

        // Manager boost this slot: ×1.25 in green when a manager is on shift.
        const mgr = block.querySelector<HTMLElement>('[data-detail="mgr"]');
        if (mgr) {
          const mult = stepCrewSpeedMult(state, id, slot);
          mgr.textContent = mult > 1 ? `👔 ×${mult}` : "—";
          mgr.classList.toggle("boosted", mult > 1);
        }

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
                ? t("factory.mechsRepairing", { n: formatInt(mechs), pct })
                : t("factory.noMechShift");
          }
        }
      });

      // WIP flow counts (a stage cell can appear in several step blocks → update all)
      for (const toy of getUnlockedToyTypes(state)) {
        const inv = ensureInventory(state, toy.id);
        for (const stage of PRODUCTION_STAGES) {
          ctx.dom.factoryDetail
            .querySelectorAll<HTMLElement>(`[data-flow="${toy.id}:${stage.id}"]`)
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
    host.innerHTML = `<span class="unassigned-hint">${t("factory.hireHint")}</span>`;
    return;
  }
  for (const elf of owned) {
    const chip = document.createElement("span");
    chip.className = "elf-chip";
    chip.title = `${elfName(elf.id)} — ${t("factory.idleCount", { n: idleOfType(state, elf.id) })}`;
    chip.innerHTML = `${elf.icon} <strong>${formatInt(idleOfType(state, elf.id))}</strong>`;
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
    head.textContent = t("factory.crafting");
    rail.appendChild(head);

    for (const toy of toys) {
      const item = document.createElement("button");
      item.className = "rail-item" + (selectedId === toy.id ? " active" : "");
      item.dataset.toyId = toy.id;
      item.innerHTML = `
        <span class="rail-status status-idle"></span>
        <span class="rail-icon">${toy.icon}</span>
        <span class="rail-name">${toyName(toy.id)}</span>
      `;
      item.onclick = () => onSelect(toy.id);
      rail.appendChild(item);
    }
  }

  // Processing: shared steps that handle every toy (Quality Control, Packaging).
  const shared = getOrderedSteps().filter((s) => !s.toyType);
  appendRailGroup(rail, t("factory.processing"), shared, selectedId, onSelect);

  // Virtual Maintenance line (mechanics auto-repair broken stations)
  const maintHead = document.createElement("div");
  maintHead.className = "rail-group-label";
  maintHead.textContent = t("factory.upkeep");
  rail.appendChild(maintHead);

  const maint = document.createElement("button");
  maint.className = "rail-item" + (selectedId === MAINTENANCE_STEP ? " active" : "");
  maint.dataset.stepId = MAINTENANCE_STEP;
  maint.innerHTML = `
    <span class="rail-status status-idle"></span>
    <span class="rail-icon">🔧</span>
    <span class="rail-name">${t("factory.maintenance")}</span>
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
    <span class="rail-name">${t("factory.repairBench")}</span>
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
      <span class="rail-name">${stepName(step.id)}</span>
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
    detail.innerHTML = `<div class="detail-empty">${t("factory.noLines")}</div>`;
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
      <div class="detail-toyhead-name">${toyName(toy.id)}</div>
      <div class="detail-toyhead-sub">${t("factory.stepsToQC", {
        n: steps.length,
        value: formatCost(toy.baseSellValue),
      })}</div>
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
      <div class="detail-title">${stepName(step.id)} <span class="detail-status status-idle">${t("status.unstaffed")}</span></div>
      <div class="detail-sub">${stepDesc(step.id)}</div>
    </div>
  `;
  block.appendChild(header);

  const meta = document.createElement("div");
  meta.className = "detail-meta";
  meta.innerHTML = `
    <div class="detail-stat"><span>${t("factory.output")}</span><strong data-detail="rate">0.00/s</strong></div>
    <div class="detail-stat"><span>${t("factory.ruinRate")}</span><strong data-detail="ruin">0%</strong></div>
    <div class="detail-stat"><span>${t("factory.baseTime")}</span><strong>${step.baseTime}s</strong></div>
    <div class="detail-stat"><span>${t("factory.managerStat")}</span><strong data-detail="mgr">—</strong></div>
    <div class="detail-progress"><div class="detail-progress-fill" data-detail="progress"></div></div>
  `;
  block.appendChild(meta);

  // A broken station shows the repair banner, but you can STILL schedule elves
  // onto it — they simply produce nothing (output is 0 while broken) and start
  // working the instant it's repaired.
  if (broken) {
    block.appendChild(brokenBanner(ctx, step.id, t("factory.brokenBanner")));
  }
  block.appendChild(buildScheduler(ctx, step.id, "worker"));

  block.appendChild(buildFlow(ctx, step));
  return block;
}

/** Queue-mode picker for a shared/virtual step: how it chooses which toy next. */
function buildQueueMode(ctx: GameContext, stepId: string, titleText = t("factory.queueTitle")): HTMLElement {
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
    { id: "order", label: t("factory.queueOrder"), desc: t("factory.queueOrderDesc") },
    { id: "balanced", label: t("factory.queueBalanced"), desc: t("factory.queueBalancedDesc") },
    { id: "focus", label: t("factory.queueFocus"), desc: t("factory.queueFocusDesc") },
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
    for (const toy of unlocked) {
      const chip = document.createElement("button");
      chip.className = "queue-toy" + (setting.focus === toy.id ? " active" : "");
      chip.innerHTML = `${toy.icon} <span>${toyName(toy.id)}</span>`;
      chip.onclick = () => {
        ctx.systems.pipeline.setQueueMode(ctx.getState(), stepId, "focus", toy.id);
        ctx.rebuildUI();
      };
      toys.appendChild(chip);
    }
    wrap.appendChild(toys);
  }

  const desc = document.createElement("div");
  desc.className = "queue-desc";
  if (setting.mode === "focus") {
    const ft = unlocked.find((toy) => toy.id === setting.focus);
    desc.textContent = ft
      ? t("factory.queueFocusOn", { toy: `${ft.icon} ${toyName(ft.id)}` })
      : modes[2].desc;
  } else {
    desc.textContent = modes.find((m) => m.id === setting.mode)!.desc;
  }
  wrap.appendChild(desc);

  return wrap;
}

/**
 * A "press and hold to repair" button (free — no cost). Holding for
 * REPAIR_HOLD_SECONDS fixes the station; a fill overlay shows progress and
 * releasing early cancels. While held it tags its container `.holding` so the
 * game loop defers background rebuilds (see Game.ts isUserBusy) — the interaction
 * isn't yanked away mid-hold.
 */
function makeRepairHoldButton(ctx: GameContext, stepId: string, label: string, extraClass = ""): HTMLButtonElement {
  const HOLD_MS = REPAIR_HOLD_SECONDS * 1000;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `repair-btn repair-hold ${extraClass}`.trim();
  btn.innerHTML = `<span class="repair-hold-fill" data-hold-fill></span><span class="repair-hold-label">${label}</span>`;
  const fill = btn.querySelector<HTMLElement>("[data-hold-fill]")!;

  let raf = 0;
  let startTs = 0;
  let holding = false;

  const setFill = (p: number) => {
    fill.style.width = `${Math.min(100, Math.max(0, p * 100))}%`;
  };
  const container = () => btn.closest<HTMLElement>(".detail-broken, .detail-repairs");
  const stop = (done: boolean) => {
    if (!holding) return;
    holding = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    btn.classList.remove("holding");
    container()?.classList.remove("holding");
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (!done) setFill(0);
  };
  const tick = (ts: number) => {
    if (!holding) return;
    const p = (ts - startTs) / HOLD_MS;
    setFill(p);
    if (p >= 1) {
      stop(true);
      ctx.systems.pipeline.repairStation(ctx.getState(), stepId);
      ctx.rebuildUI();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  const onUp = () => stop(false);

  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (holding) return;
    holding = true;
    startTs = performance.now();
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      /* capture unsupported — window listeners still catch the release */
    }
    btn.classList.add("holding");
    container()?.classList.add("holding");
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    raf = requestAnimationFrame(tick);
  });
  btn.addEventListener("pointerup", onUp);
  btn.addEventListener("pointercancel", onUp);

  return btn;
}

/**
 * A red banner for a broken station: press-and-hold repair button plus a live
 * mechanic auto-repair progress bar (fills as mechanics on shift work it).
 * The bar + hint are refreshed each frame in renderFrame.
 */
function brokenBanner(ctx: GameContext, stepId: string, text: string): HTMLElement {
  const banner = document.createElement("div");
  banner.className = "detail-broken";

  const top = document.createElement("div");
  top.className = "detail-broken-top";
  top.innerHTML = `<span>⚠️ ${text}</span>`;
  top.appendChild(makeRepairHoldButton(ctx, stepId, t("factory.repairHold")));
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
        <div class="detail-title">${t("factory.maintenance")} <span class="detail-status status-idle">…</span></div>
        <div class="detail-sub">${t("factory.maintDesc")}</div>
      </div>
    </div>
    <div class="detail-meta">
      <div class="detail-stat"><span>${t("factory.mechsOnShift")}</span><strong data-detail="onshift">0</strong></div>
      <div class="detail-stat"><span>${t("factory.stationsDown")}</span><strong data-detail="brokencount">0</strong></div>
    </div>
  `;

  // Broken-station repair list
  const repairs = document.createElement("div");
  repairs.className = "detail-repairs";
  repairs.innerHTML = `<div class="sched-title">${t("factory.brokenStations")}</div>`;
  const broken = brokenStepIds(state);
  if (broken.length === 0) {
    const ok = document.createElement("div");
    ok.className = "crew-empty";
    ok.textContent = t("factory.allRunning");
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
          <div class="repair-name">${stepName(stepId)}</div>
          <div class="repair-track"><div class="repair-fill" data-repair="${stepId}"></div></div>
        </div>
      `;
      row.appendChild(makeRepairHoldButton(ctx, stepId, t("factory.repairHoldShort"), "small"));
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
        <div class="detail-title">${t("factory.repairBench")} <span class="detail-status status-idle">…</span></div>
        <div class="detail-sub">${t("factory.repairDesc")}</div>
      </div>
    </div>
    <div class="detail-meta">
      <div class="detail-stat"><span>${t("factory.mendersOnShift")}</span><strong data-detail="menders">0</strong></div>
      <div class="detail-stat"><span>${t("factory.brokenToysWaiting")}</span><strong data-detail="brokentoys">0</strong></div>
    </div>
  `;

  // Broken-toy list — one row per unlocked toy, kept visible so counts can
  // tick down live (and rows don't vanish the instant a pile is cleared).
  const list = document.createElement("div");
  list.className = "detail-repairs";
  list.innerHTML = `<div class="sched-title">${t("factory.brokenToys")}</div>`;
  for (const toy of getUnlockedToyTypes(state)) {
    const broken = getBrokenStock(state, toy.id);
    const row = document.createElement("div");
    row.className = "repair-row" + (broken <= 0 ? " mended" : "");
    row.dataset.refurbRow = toy.id;
    row.innerHTML = `
      <span class="repair-icon">${toy.icon}</span>
      <div class="repair-info">
        <div class="repair-name">${t("factory.broken", { name: toyName(toy.id), n: `<strong data-refurb-count="${toy.id}">${formatInt(broken)}</strong>` })}</div>
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
    root.appendChild(buildQueueMode(ctx, REPAIR_STEP, t("factory.queueTitleMend")));
  }

  detail.appendChild(root);
}

/** Crew of the line (one card per assigned elf) + an "+ Assign elf" flow. */
function buildScheduler(ctx: GameContext, stepId: string, role: ElfRole): HTMLElement {
  const state = ctx.getState();
  const T = roleText(role);

  const wrap = document.createElement("div");
  wrap.className = "sched";

  const title = document.createElement("div");
  title.className = "sched-title";
  title.textContent = T.crewTitle;
  wrap.appendChild(title);

  const ownedOfRole = ownedElfTypes(state).filter((e) => e.role === role);
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
  const state = ctx.getState();
  const def = getElfType(group.type);
  const count = group.ids.length;
  const card = document.createElement("div");
  card.className = "elf-card" + (def?.managerMult ? " manager" : "");

  const pips = shiftSlots
    .map((s) => {
      const on = group.slots.includes(s.id);
      return `<span class="slot-pip${on ? " on" : ""}" data-slot="${s.id}" title="${slotName(s.id)}">${s.icon}</span>`;
    })
    .join("");

  // Manager: show the boost right on the card. Workaholics: show today's no-shows.
  const managerBadge = def?.managerMult
    ? ` <span class="elf-card-badge">${t("factory.managerBadge", { mult: def.managerMult })}</span>`
    : "";
  const offToday = group.ids.filter((id) => state.workforce.elves.find((e) => e.id === id)?.dayOff).length;
  const offBadge = offToday > 0 ? ` <span class="elf-card-off">${t("factory.dayOffBadge", { n: offToday })}</span>` : "";

  card.innerHTML = `
    <span class="elf-card-icon">${def?.icon ?? "🧝"}</span>
    <div class="elf-card-info">
      <span class="elf-card-name">${elfName(group.type)}${count > 1 ? ` <span class="elf-card-count">×${count}</span>` : ""}${managerBadge}${offBadge}</span>
      <span class="elf-card-slots">${pips}</span>
    </div>
  `;

  const remove = document.createElement("button");
  remove.className = "elf-remove";
  remove.textContent = "✕";
  remove.title = t("factory.sendHome");
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
    head.textContent = roleText(role).assignHead;
    panel.appendChild(head);

    if (options.length === 0) {
      const empty = document.createElement("div");
      empty.className = "picker-empty";
      empty.textContent = roleText(role).pickerEmpty;
      panel.appendChild(empty);
    } else {
      // Step 1: pick elf type
      const typeRow = document.createElement("div");
      typeRow.className = "assign-types";
      for (const elf of options) {
        const btn = document.createElement("button");
        btn.className = "assign-type" + (selectedType === elf.id ? " active" : "");
        btn.innerHTML = `<span>${elf.icon} ${elfName(elf.id)}</span><span class="picker-free">${t("factory.idleCount", {
          n: idleOfType(state, elf.id),
        })}</span>`;
        btn.onclick = () => {
          selectedType = elf.id;
          // Sensible default: the first slots this type can actually take here.
          const open = shiftSlots
            .filter((s) => slotRestriction(ctx.getState(), elf.id, stepId, s.id) === null)
            .map((s) => s.id);
          selectedSlots = open.slice(0, Math.min(requiredShifts(elf.id), open.length));
          qty = 1;
          render();
        };
        typeRow.appendChild(btn);
      }
      panel.appendChild(typeRow);

      // Step 2: choose the shifts + how many
      if (selectedType) {
        const def = getElfType(selectedType);

        // A special-rule elf explains itself right where you're assigning it.
        const traitText = elfTraitText(selectedType);
        if (traitText) {
          const trait = document.createElement("div");
          trait.className = "assign-trait";
          trait.textContent = traitText;
          panel.appendChild(trait);
        }

        // Slots this type can take ON THIS STATION (its own rules + who's
        // already scheduled here: one manager per shift, shy crews stay shy).
        const openSlots = shiftSlots.filter((s) => slotRestriction(state, selectedType!, stepId, s.id) === null);
        const need = Math.min(requiredShifts(selectedType), openSlots.length);
        selectedSlots = selectedSlots.filter((s) => openSlots.some((o) => o.id === s));
        const idle = idleOfType(state, selectedType);
        // Managers are one-per-shift, so batching several is never valid.
        const maxQty = def?.managerMult ? Math.min(1, idle) : idle;
        qty = Math.max(1, Math.min(qty, maxQty));

        const shiftHead = document.createElement("div");
        shiftHead.className = "assign-shift-head";
        shiftHead.textContent =
          need > 0 ? t("factory.chooseShifts", { n: need, sel: selectedSlots.length }) : t("factory.noOpenShifts");
        panel.appendChild(shiftHead);

        const slotRow = document.createElement("div");
        slotRow.className = "assign-slots";
        for (const slot of shiftSlots) {
          const restriction = slotRestriction(state, selectedType, stepId, slot.id);
          const on = selectedSlots.includes(slot.id);
          const btn = document.createElement("button");
          btn.className = "assign-slot" + (on ? " on" : "");
          btn.disabled = restriction !== null;
          btn.innerHTML = `${slot.icon}<small>${slotName(slot.id)}</small>`;
          if (restriction) btn.title = restrictionText(restriction);
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
          stepper(qty, 1, maxQty, (v) => {
            qty = v;
            render();
          }),
          maxBtn(() => {
            qty = maxQty;
            render();
          }),
          note(t("factory.ofIdle", { n: idle }))
        );
        panel.appendChild(qtyRow);
      }
    }

    // Footer — needs a full valid slot selection for THIS station.
    const ready = (() => {
      if (!selectedType) return false;
      const openCount = shiftSlots.filter((s) => slotRestriction(ctx.getState(), selectedType!, stepId, s.id) === null).length;
      const need = Math.min(requiredShifts(selectedType), openCount);
      return need > 0 && selectedSlots.length === need;
    })();
    const footer = document.createElement("div");
    footer.className = "assign-footer";
    const assign = document.createElement("button");
    assign.className = "assign-confirm";
    assign.textContent = ready ? t("factory.assignN", { n: qty }) : t("factory.assign");
    assign.disabled = !ready;
    assign.onclick = () => {
      if (!selectedType) return;
      ctx.systems.pipeline.assignElves(ctx.getState(), selectedType, stepId, selectedSlots, qty);
      ctx.rebuildUI();
    };
    const cancel = document.createElement("button");
    cancel.className = "assign-cancel";
    cancel.textContent = t("factory.cancel");
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
  b.textContent = t("factory.max");
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
    const elfLabel = elfName(group.type);
    text.textContent =
      total > 1 ? t("factory.sendHomeQN", { name: elfLabel }) : t("factory.sendHomeQ1", { name: elfLabel });
    pop.appendChild(text);

    if (total > 1) {
      const qtyRow = document.createElement("div");
      qtyRow.className = "confirm-qty";
      qtyRow.append(
        stepper(qty, 1, total, (v) => {
          qty = v;
          render();
        }),
        note(t("factory.ofTotal", { n: total }))
      );
      pop.appendChild(qtyRow);
    }

    const actions = document.createElement("div");
    actions.className = "confirm-actions";
    const yes = document.createElement("button");
    yes.className = "confirm-yes";
    yes.textContent = total > 1 ? t("factory.sendNHome", { n: qty }) : t("factory.sendHome");
    yes.onclick = () => {
      ctx.systems.pipeline.removeElves(ctx.getState(), group.ids.slice(0, qty));
      ctx.rebuildUI();
    };
    const no = document.createElement("button");
    no.className = "confirm-no";
    no.textContent = t("factory.cancel");
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
  title.textContent = t("factory.wip");
  wrap.appendChild(title);

  const inStage = step.inputStage ? PRODUCTION_STAGES.find((s) => s.id === step.inputStage) : null;
  const outStage = PRODUCTION_STAGES.find((s) => s.id === step.outputStage)!;
  const toys = getUnlockedToyTypes(state).filter((toy) => !step.toyType || toy.id === step.toyType);

  for (const toy of toys) {
    const row = document.createElement("div");
    row.className = "flow-row";
    const inPart = inStage
      ? `<span class="flow-stage">${inStage.icon} <b data-flow="${toy.id}:${inStage.id}">0</b></span><span class="flow-arrow">→</span>`
      : "";
    row.innerHTML = `
      <span class="flow-toy">${toy.icon} ${toyName(toy.id)}</span>
      <span class="flow-io">${inPart}<span class="flow-stage out">${outStage.icon} <b data-flow="${toy.id}:${outStage.id}">0</b></span></span>
    `;
    wrap.appendChild(row);
  }

  return wrap;
}
