/**
 * factoryPage — the "Factory" tab: assign elves to pipeline steps and
 * watch items move through the stages.
 * Markup: factoryPage.html · Styles: factoryPage.css
 * Logic: PipelineSystem (assignment + throughput).
 */

import factoryPageHtml from "./factoryPage.html?raw";
import "./factoryPage.css";

import type { Page } from "../Page";
import type { FrameViews, GameContext } from "../../../core/GameContext";
import { pipelineSteps, PRODUCTION_STAGES } from "../../../config/pipelineConfig";
import { toyTypes } from "../../../config/toyTypesConfig";
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
    },

    renderFrame(ctx, views: FrameViews) {
      const state = ctx.getState();

      // Workforce counters
      ctx.dom.totalElves.textContent = formatInt(state.workforce.totalElves);
      ctx.dom.unassignedElves.textContent = formatInt(state.workforce.unassigned);

      // Work-in-progress grid (per toy type, per stage)
      ctx.dom.wipGrid.innerHTML = "";
      for (const t of toyTypes) {
        const inv = ensureInventory(state, t.id);
        for (const stage of PRODUCTION_STAGES) {
          const el = document.createElement("div");
          el.className = "material";
          el.innerHTML = `
            <span class="material-icon">${stage.icon}</span>
            <span class="material-label">${t.icon} ${stage.label}</span>
            <strong>${formatInt(inv[stage.id])}</strong>
          `;
          ctx.dom.wipGrid.appendChild(el);
        }
      }

      // Step progress bars + bottleneck highlight
      for (const step of views.pipeline.steps) {
        const bar = document.querySelector<HTMLElement>(`[data-progress-step="${step.stepId}"]`);
        if (bar) {
          bar.style.width = `${Math.floor(step.progress * 100)}%`;
        }
        const row = document.querySelector<HTMLElement>(`[data-step-id="${step.stepId}"]`);
        if (row) {
          row.classList.toggle("bottlenecked", step.isBottlenecked);
        }
      }
    },
  };
}

/** One row per pipeline step with -/+ buttons to move elves in and out. */
function buildPipelineList(ctx: GameContext): void {
  const state = ctx.getState();
  ctx.dom.pipelineList.innerHTML = "";

  for (const step of pipelineSteps) {
    const assigned = state.workforce.assignments[step.id] ?? 0;
    const typeTag = step.toyType ? step.toyType : "all types";

    const row = document.createElement("div");
    row.className = "pipeline-step";
    row.setAttribute("data-step-id", step.id);

    const info = document.createElement("div");
    info.className = "pipeline-info";
    info.innerHTML = `
      <div class="pipeline-step-name">${step.name} <span class="pipeline-type-tag">${typeTag}</span></div>
      <div class="pipeline-step-desc">${step.description}</div>
      <div class="pipeline-step-meta">
        Base time: ${step.baseTime}s | Elves: <strong>${assigned}</strong>
      </div>
      <div class="pipeline-progress-container">
        <div class="pipeline-progress-bar" data-progress-step="${step.id}" style="width: 0%"></div>
      </div>
    `;

    const controls = document.createElement("div");
    controls.className = "pipeline-controls";

    const minusBtn = document.createElement("button");
    minusBtn.textContent = "-";
    minusBtn.className = "pipeline-btn";
    minusBtn.disabled = assigned <= 0;
    minusBtn.onclick = () => {
      ctx.systems.pipeline.unassignElves(ctx.getState(), step.id, 1);
      ctx.rebuildUI();
    };

    const countSpan = document.createElement("span");
    countSpan.className = "pipeline-count";
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
    ctx.dom.pipelineList.appendChild(row);
  }
}
