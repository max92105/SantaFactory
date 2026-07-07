import type { GameState } from "../state/GameState";
import { producers } from "../data/producers";
import { upgrades } from "../data/upgrades";
import { pipelineSteps } from "../data/pipeline";
import type { DomRefs } from "../ui/dom";
import { formatMoney } from "../utils/format";

function describeEffect(effect: any): string {
  switch (effect.type) {
    case "gpc_flat":
      return `+${effect.amount} GPC`;
    case "gpc_mult":
      return `x${effect.amount} GPC`;
    case "sell_rate_mult":
      return `x${effect.amount} Sell Rate`;
    case "producer_output_mult":
      return `x${effect.amount} Producer Output`;
    case "producer_speed_mult":
      return `x${effect.amount} Producer Speed`;
    case "gps_mult":
      return `x${effect.amount} Global GPS`;
    default:
      return effect.type;
  }
}

export function createShopSystem() {
  function buyProducer(state: GameState, producerId: string): boolean {
    const def = producers.find((p) => p.id === producerId);
    if (!def) return false;

    const owned = state.owned.producers[producerId] ?? 0;
    const cost = def.baseCost * Math.pow(def.costGrowth, owned);

    if (state.resources.money < cost) {
      state.meta.statusText = `Not enough money to buy ${def.name}.`;
      return false;
    }

    state.resources.money -= cost;
    state.owned.producers[producerId] = owned + 1;

    // Add elves to workforce (unassigned pool)
    state.workforce.totalElves += def.elvesProvided;
    state.workforce.unassigned += def.elvesProvided;

    state.meta.statusText = `Hired ${def.name} (+${def.elvesProvided} elf${def.elvesProvided > 1 ? "ves" : ""}).`;
    return true;
  }

  function buyUpgrade(state: GameState, upgradeId: string): boolean {
    const def = upgrades.find((u) => u.id === upgradeId);
    if (!def) return false;
    if (state.owned.upgrades[upgradeId]) return false;

    if (state.resources.money < def.cost) {
      state.meta.statusText = `Not enough money to buy ${def.name}.`;
      return false;
    }

    state.resources.money -= def.cost;
    state.owned.upgrades[upgradeId] = true;
    state.meta.statusText = `Purchased upgrade: ${def.name}.`;
    return true;
  }

  function renderProducers(dom: DomRefs, state: GameState, onChanged?: () => void) {
    dom.producersList.innerHTML = "";

    for (const def of producers) {
      const owned = state.owned.producers[def.id] ?? 0;
      const cost = def.baseCost * Math.pow(def.costGrowth, owned);
      const totalWage = def.elvesProvided * def.dailyWagePerElf;

      const row = document.createElement("div");
      row.className = "row";
      row.setAttribute("data-producer-id", def.id);

      const left = document.createElement("div");
      left.innerHTML = `
        <div class="row-title">${def.name} <span style="opacity:.75; font-weight:600;">(owned: ${owned})</span></div>
        <div class="row-sub">${def.description}</div>
        <div class="row-meta">Elves: +${def.elvesProvided} • Wage: $${totalWage}/day</div>
      `;

      const btn = document.createElement("button");
      btn.textContent = `Hire (${formatMoney(cost)})`;
      btn.disabled = state.resources.money < cost;
      btn.onclick = () => {
        buyProducer(state, def.id);
        renderProducers(dom, state, onChanged);
        onChanged?.();
      };

      row.appendChild(left);
      row.appendChild(btn);
      dom.producersList.appendChild(row);
    }
  }

  function renderUpgrades(dom: DomRefs, state: GameState, onChanged?: () => void) {
    dom.upgradesList.innerHTML = "";

    for (const def of upgrades) {
      const owned = !!state.owned.upgrades[def.id];

      const row = document.createElement("div");
      row.className = "row";

      const left = document.createElement("div");
      left.innerHTML = `
        <div class="row-title">${def.name} <span style="opacity:.75; font-weight:600;">${owned ? "(owned)" : ""}</span></div>
        <div class="row-sub">${def.description}</div>
        <div class="row-meta">Effect: ${describeEffect(def.effect)}</div>
      `;

      const btn = document.createElement("button");
      btn.textContent = owned ? "Owned" : `Buy (${formatMoney(def.cost)})`;
      btn.disabled = owned || state.resources.money < def.cost;
      btn.onclick = () => {
        buyUpgrade(state, def.id);
        renderUpgrades(dom, state, onChanged);
        onChanged?.();
      };

      row.appendChild(left);
      row.appendChild(btn);
      dom.upgradesList.appendChild(row);
    }
  }

  function renderPipeline(
    dom: DomRefs,
    state: GameState,
    pipelineSystem: { assignElves: (state: GameState, stepId: string, count: number) => boolean; unassignElves: (state: GameState, stepId: string, count: number) => boolean },
    onChanged?: () => void
  ) {
    dom.pipelineList.innerHTML = "";

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
        pipelineSystem.unassignElves(state, step.id, 1);
        onChanged?.();
      };

      const countSpan = document.createElement("span");
      countSpan.className = "pipeline-count";
      countSpan.textContent = String(assigned);

      const plusBtn = document.createElement("button");
      plusBtn.textContent = "+";
      plusBtn.className = "pipeline-btn";
      plusBtn.disabled = state.workforce.unassigned <= 0;
      plusBtn.onclick = () => {
        pipelineSystem.assignElves(state, step.id, 1);
        onChanged?.();
      };

      controls.appendChild(minusBtn);
      controls.appendChild(countSpan);
      controls.appendChild(plusBtn);

      row.appendChild(info);
      row.appendChild(controls);
      dom.pipelineList.appendChild(row);
    }
  }

  return { buyProducer, buyUpgrade, renderProducers, renderUpgrades, renderPipeline };
}