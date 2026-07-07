/**
 * factoryPage — the "Factory" tab: assign elves to pipeline steps and
 * watch items move through the stages.
 * Markup: factoryPage.html · Styles: factoryPage.css
 * Logic: PipelineSystem (assignment + throughput).
 *
 * Scales by design: production lines are grouped (per-toy crafting, then
 * shared steps) and work-in-progress is a table with one row per toy —
 * both stay readable with many toys, steps, and elf types.
 */

import factoryPageHtml from "./factoryPage.html?raw";
import "./factoryPage.css";

import type { Page } from "../Page";
import type { FrameViews, GameContext } from "../../../core/GameContext";
import { getOrderedSteps, PRODUCTION_STAGES, type PipelineStepDef } from "../../../config/pipelineConfig";
import { getToyType } from "../../../config/toyTypesConfig";
import { getUnlockedToyTypes, isToyUnlocked } from "../../../helpers/unlockHelpers";
import { ensureInventory } from "../../../helpers/inventoryHelpers";
import { formatInt } from "../../../helpers/formatHelpers";

export function createFactoryPage(): Page {
  return {
    mount(container) {
      container.insertAdjacentHTML("beforeend", factoryPageHtml);
    },

    bind() {
      // All interactive elements are (re)built in rebuild()
    },

    rebuild(ctx) {
      buildPipelineList(ctx);
      buildWipTable(ctx);
    },

    renderFrame(ctx, views: FrameViews) {
      const state = ctx.getState();

      // Workforce counters
      const assigned = state.workforce.totalElves - state.workforce.unassigned;
      ctx.dom.totalElves.textContent = formatInt(state.workforce.totalElves);
      ctx.dom.assignedElves.textContent = formatInt(assigned);
      ctx.dom.unassignedElves.textContent = formatInt(state.workforce.unassigned);

      // Work-in-progress cell values (table skeleton is built in rebuild)
      for (const t of getUnlockedToyTypes(state)) {
        const inv = ensureInventory(state, t.id);
        for (const stage of PRODUCTION_STAGES) {
          const cell = ctx.dom.wipGrid.querySelector<HTMLElement>(
            `[data-wip="${t.id}:${stage.id}"]`
          );
          if (cell) cell.textContent = formatInt(inv[stage.id]);
        }
      }

      // Step progress bars + bottleneck highlight
      for (const step of views.pipeline.steps) {
        const bar = ctx.dom.pipelineList.querySelector<HTMLElement>(
          `[data-progress-step="${step.stepId}"]`
        );
        if (bar) {
          bar.style.width = `${Math.floor(step.progress * 100)}%`;
        }
        const row = ctx.dom.pipelineList.querySelector<HTMLElement>(
          `[data-step-id="${step.stepId}"]`
        );
        if (row) {
          row.classList.toggle("bottlenecked", step.isBottlenecked);
        }
      }
    },
  };
}

/**
 * Production lines, grouped for scalability:
 *  - "Crafting" — one row per unlocked toy's craft step.
 *  - "Processing" — shared steps that handle every toy type.
 */
function buildPipelineList(ctx: GameContext): void {
  const state = ctx.getState();
  ctx.dom.pipelineList.innerHTML = "";

  const steps = getOrderedSteps();
  const craftSteps = steps.filter((s) => s.toyType && isToyUnlocked(state, s.toyType));
  const sharedSteps = steps.filter((s) => !s.toyType);

  appendGroup(ctx, "Crafting", craftSteps);
  appendGroup(ctx, "Processing (all toys)", sharedSteps);
}

function appendGroup(ctx: GameContext, label: string, steps: PipelineStepDef[]): void {
  if (steps.length === 0) return;

  const header = document.createElement("div");
  header.className = "pipeline-group-label";
  header.textContent = label;
  ctx.dom.pipelineList.appendChild(header);

  for (const step of steps) {
    ctx.dom.pipelineList.appendChild(buildStepRow(ctx, step));
  }
}

/** One row per pipeline step with -/+ buttons to move elves in and out. */
function buildStepRow(ctx: GameContext, step: PipelineStepDef): HTMLDivElement {
  const state = ctx.getState();
  const assigned = state.workforce.assignments[step.id] ?? 0;
  const toy = step.toyType ? getToyType(step.toyType) : null;
  const icon = toy ? toy.icon : "⚙️";

  const row = document.createElement("div");
  row.className = "pipeline-step";
  row.setAttribute("data-step-id", step.id);

  const info = document.createElement("div");
  info.className = "pipeline-info";
  info.innerHTML = `
    <div class="pipeline-step-name">
      <span class="pipeline-step-icon">${icon}</span>
      ${step.name}
    </div>
    <div class="pipeline-step-meta">${step.description} · ${step.baseTime}s base</div>
    <div class="pipeline-progress-container">
      <div class="pipeline-progress-bar" data-progress-step="${step.id}" style="width: 0%"></div>
    </div>
  `;

  const controls = document.createElement("div");
  controls.className = "pipeline-controls";

  const minusBtn = document.createElement("button");
  minusBtn.textContent = "−";
  minusBtn.className = "pipeline-btn";
  minusBtn.disabled = assigned <= 0;
  minusBtn.onclick = () => {
    ctx.systems.pipeline.unassignElves(ctx.getState(), step.id, 1);
    ctx.rebuildUI();
  };

  const countSpan = document.createElement("span");
  countSpan.className = "pipeline-count";
  countSpan.title = "Elves assigned";
  countSpan.textContent = String(assigned);

  const plusBtn = document.createElement("button");
  plusBtn.textContent = "+";
  plusBtn.className = "pipeline-btn";
  plusBtn.disabled = state.workforce.unassigned <= 0;
  plusBtn.onclick = () => {
    ctx.systems.pipeline.assignElves(ctx.getState(), step.id, 1);
    ctx.rebuildUI();
  };

  controls.appendChild(minusBtn);
  controls.appendChild(countSpan);
  controls.appendChild(plusBtn);

  row.appendChild(info);
  row.appendChild(controls);
  return row;
}

/** WIP table skeleton: one row per unlocked toy, one column per stage. */
function buildWipTable(ctx: GameContext): void {
  const state = ctx.getState();
  const unlocked = getUnlockedToyTypes(state);

  const headCells = PRODUCTION_STAGES.map(
    (s) => `<th title="${s.label}">${s.icon} ${s.label}</th>`
  ).join("");

  const bodyRows = unlocked
    .map((t) => {
      const cells = PRODUCTION_STAGES.map(
        (s) => `<td class="wip-count" data-wip="${t.id}:${s.id}">0</td>`
      ).join("");
      return `<tr><td class="wip-toy">${t.icon} ${t.name}</td>${cells}</tr>`;
    })
    .join("");

  ctx.dom.wipGrid.innerHTML = `
    <table class="wip-table">
      <thead><tr><th>Toy</th>${headCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
}
