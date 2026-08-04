/**
 * techTreeView — the interactive progression map.
 *
 * A pan-and-zoom canvas over the graph built in helpers/techTree.ts: SVG edges
 * on the bottom, absolutely-positioned HTML nodes on top, both inside one
 * transformed <div> so a single transform moves everything together.
 *
 * Interaction:
 *   drag / wheel      pan and zoom (wheel zooms toward the cursor)
 *   click a node      opens its detail panel (name, effect, cost, Buy)
 *   ⊕ ⊖ ⤢ ◎          zoom in / out / fit the whole map / jump to what's next
 *
 * Nodes are rebuilt only when the graph's *state* changes (something bought);
 * panning and zooming only touch the container transform, so dragging stays
 * cheap with ~100 nodes on screen.
 *
 * Styles: techTreeView.css.
 */

import "./techTreeView.css";

import type { GameContext } from "../../core/GameContext";
import {
  getTechTree,
  computeNodeStates,
  isNodeOwned,
  canAfford,
  nextAffordableNode,
  type TechNode,
  type TechNodeState,
} from "../../helpers/techTree";
import { getToyType } from "../../config/toyTypesConfig";
import { getUpgrade, describeUpgradeEffect } from "../../config/upgradesConfig";
import { formatCost, formatMoneyPrecise } from "../../helpers/formatHelpers";
import { t } from "../i18n/i18n";
import { toyName, upgradeName, upgradeDesc } from "../i18n/localize";

/** Layout units → pixels. */
const UNIT_X = 96;
const UNIT_Y = 74;
/** Padding around the graph inside the scrollable world, in px. */
const PAD = 90;

/** The toy spine is ~35 nodes long, so "fit the whole map" has to zoom out a
 *  long way. That view is an overview, not a working zoom — the default camera
 *  sits at the frontier instead (see rebuild). */
const MIN_ZOOM = 0.14;
const MAX_ZOOM = 1.9;

export type TechTreeView = {
  /** Rebuild nodes/edges — call after any purchase. */
  rebuild(): void;
  /** Cheap per-frame refresh (affordability outlines only). */
  renderFrame(): void;
};

export function createTechTreeView(ctx: GameContext, host: HTMLElement): TechTreeView {
  const tree = getTechTree();

  host.innerHTML = `
    <div class="tree" tabindex="0">
      <div class="tree-world" data-world>
        <svg class="tree-edges" data-edges xmlns="http://www.w3.org/2000/svg"></svg>
        <div class="tree-nodes" data-nodes></div>
      </div>
      <div class="tree-lanes" data-lanes></div>
      <div class="tree-controls">
        <button class="tree-ctl" data-zoom-in type="button" title="${t("techTree.zoomIn")}">＋</button>
        <button class="tree-ctl" data-zoom-out type="button" title="${t("techTree.zoomOut")}">－</button>
        <button class="tree-ctl" data-fit type="button" title="${t("techTree.fit")}">⤢</button>
        <button class="tree-ctl accent" data-next type="button" title="${t("techTree.focusNext")}">◎</button>
      </div>
      <div class="tree-hint" data-hint>${t("techTree.hint")}</div>
      <div class="tree-detail" data-detail hidden></div>
    </div>
  `;

  const root = host.querySelector<HTMLElement>(".tree")!;
  const world = host.querySelector<HTMLElement>("[data-world]")!;
  const edgesSvg = host.querySelector<SVGSVGElement>("[data-edges]")!;
  const nodesHost = host.querySelector<HTMLElement>("[data-nodes]")!;
  const lanesHost = host.querySelector<HTMLElement>("[data-lanes]")!;
  const detail = host.querySelector<HTMLElement>("[data-detail]")!;

  const worldW = tree.width * UNIT_X + PAD * 2;
  const worldH = tree.height * UNIT_Y + PAD * 2;
  world.style.width = `${worldW}px`;
  world.style.height = `${worldH}px`;
  edgesSvg.setAttribute("viewBox", `0 0 ${worldW} ${worldH}`);
  edgesSvg.setAttribute("width", String(worldW));
  edgesSvg.setAttribute("height", String(worldH));

  const px = (n: TechNode) => ({ x: PAD + n.x * UNIT_X, y: PAD + n.y * UNIT_Y });

  // ── Camera ──────────────────────────────────────────────────────────────
  let zoom = 0.62;
  let panX = 0;
  let panY = 0;
  let selectedId: string | null = null;

  function applyTransform(): void {
    world.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    positionLanes();
  }

  /**
   * Lane labels are pinned to the left edge and positioned in SCREEN space, so
   * they stay legible at any zoom (scaling them with the world made them
   * unreadable the moment you zoomed out to see the whole map). They ride the
   * vertical pan only, and hide when their lane scrolls off.
   */
  function positionLanes(): void {
    const h = root.clientHeight;
    lanesHost.querySelectorAll<HTMLElement>(".tree-lane-label").forEach((el) => {
      const row = Number(el.dataset.row ?? 0);
      const y = panY + (PAD + row * UNIT_Y) * zoom;
      el.style.top = `${y}px`;
      el.style.display = y < -20 || y > h + 20 ? "none" : "";
    });
  }

  function clampPan(): void {
    // Keep at least a slice of the map on screen from every direction.
    const w = root.clientWidth;
    const h = root.clientHeight;
    const scaledW = worldW * zoom;
    const scaledH = worldH * zoom;
    const marginX = Math.min(w * 0.6, scaledW * 0.9);
    const marginY = Math.min(h * 0.6, scaledH * 0.9);
    panX = Math.min(marginX, Math.max(w - scaledW - marginX + marginX, panX));
    panX = Math.max(-(scaledW - marginX), Math.min(marginX, panX));
    panY = Math.max(-(scaledH - marginY), Math.min(marginY, panY));
  }

  function setZoom(next: number, originX: number, originY: number): void {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    if (clamped === zoom) return;
    // Keep the point under the cursor fixed while scaling.
    const wx = (originX - panX) / zoom;
    const wy = (originY - panY) / zoom;
    zoom = clamped;
    panX = originX - wx * zoom;
    panY = originY - wy * zoom;
    clampPan();
    applyTransform();
  }

  /** Centre the camera on a world point at the current zoom. */
  function centerOn(wx: number, wy: number): void {
    panX = root.clientWidth / 2 - wx * zoom;
    panY = root.clientHeight / 2 - wy * zoom;
    clampPan();
    applyTransform();
  }

  function fit(): void {
    const w = root.clientWidth || 900;
    const h = root.clientHeight || 600;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(w / worldW, h / worldH) * 0.96));
    centerOn(worldW / 2, worldH / 2);
  }

  // ── Pan by dragging ─────────────────────────────────────────────────────
  // Deliberately NOT using setPointerCapture: capturing on the root retargets
  // the follow-up `click` to the root as well, which silently swallowed every
  // click on a node. Window-level move/up listeners give the same "keep
  // dragging outside the box" behaviour with click targeting left intact.
  let dragging = false;
  let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };
  let dragMoved = false;

  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    panX = dragStart.panX + dx;
    panY = dragStart.panY + dy;
    clampPan();
    applyTransform();
  };

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove("dragging");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  };

  root.addEventListener("pointerdown", (e) => {
    // Always clear the "this was a drag" flag, even for presses on the controls
    // or the detail panel — leaving it set poisoned the next node click.
    dragMoved = false;
    if ((e.target as HTMLElement).closest(".tree-ctl, .tree-detail")) return;
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY, panX, panY };
    root.classList.add("dragging");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  });

  root.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = root.getBoundingClientRect();
      setZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - rect.left, e.clientY - rect.top);
    },
    { passive: false }
  );

  /**
   * The camera is the pan/zoom transform, not scroll — but `overflow: hidden`
   * only stops the USER scrolling. Anything programmatic (tabbing to an
   * off-screen node, scrollIntoView, an IME) can still offset the box, which
   * drags the absolutely-positioned controls and detail panel out of sight.
   * Snap it back so scroll is never a second, conflicting camera.
   */
  root.addEventListener("scroll", () => {
    if (root.scrollLeft !== 0 || root.scrollTop !== 0) {
      root.scrollLeft = 0;
      root.scrollTop = 0;
    }
  });

  host.querySelector<HTMLButtonElement>("[data-zoom-in]")!.onclick = () =>
    setZoom(zoom * 1.25, root.clientWidth / 2, root.clientHeight / 2);
  host.querySelector<HTMLButtonElement>("[data-zoom-out]")!.onclick = () =>
    setZoom(zoom / 1.25, root.clientWidth / 2, root.clientHeight / 2);
  host.querySelector<HTMLButtonElement>("[data-fit]")!.onclick = fit;
  host.querySelector<HTMLButtonElement>("[data-next]")!.onclick = () => {
    const target = nextAffordableNode(ctx.getState(), tree);
    if (!target) return;
    const p = px(target);
    zoom = Math.max(zoom, 0.85);
    centerOn(p.x, p.y);
    select(target.id);
  };

  // ── Rendering ───────────────────────────────────────────────────────────
  function labelFor(node: TechNode): string {
    return node.kind === "toy" ? toyName(node.refId) : upgradeName(node.refId);
  }

  function buildEdges(states: Map<string, TechNodeState>): void {
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    const parts: string[] = [];
    for (const e of tree.edges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      const p1 = px(a);
      const p2 = px(b);
      // Horizontal S-curve: leaves the parent going right, arrives going right.
      const dx = Math.max(30, (p2.x - p1.x) * 0.5);
      const d = `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
      const lit = states.get(e.from) === "owned";
      const target = states.get(e.to);
      const cls = lit && target === "available" ? "edge open" : lit ? "edge lit" : "edge";
      parts.push(`<path class="${cls}" d="${d}" />`);
    }
    edgesSvg.innerHTML = parts.join("");
  }

  function buildNodes(states: Map<string, TechNodeState>): void {
    const state = ctx.getState();
    nodesHost.innerHTML = "";

    for (const node of tree.nodes) {
      const s = states.get(node.id) ?? "far";
      const p = px(node);
      const el = document.createElement("button");
      el.type = "button";
      el.className = `tnode state-${s} lane-${node.lane}${node.kind === "toy" ? " is-toy" : " is-upgrade"}`;
      el.dataset.nodeId = node.id;
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      // Handbuild sub-nodes read as satellites of the toy above them.
      if (node.refId.startsWith("handbuild_")) el.classList.add("is-sub");

      const affordable = s === "available" && canAfford(state, node);
      if (affordable) el.classList.add("affordable");

      el.innerHTML = `
        <span class="tnode-icon">${node.icon}</span>
        <span class="tnode-label">${labelFor(node)}</span>
        <span class="tnode-cost">${s === "owned" ? t("techTree.owned") : formatCost(node.cost)}</span>
      `;
      el.onclick = (ev) => {
        ev.stopPropagation();
        if (dragMoved) return; // a drag that ended on a node isn't a click
        select(node.id);
      };
      nodesHost.appendChild(el);
    }
  }

  function buildLaneLabels(): void {
    lanesHost.innerHTML = "";
    for (const lane of tree.lanes) {
      const el = document.createElement("div");
      el.className = "tree-lane-label";
      el.dataset.row = String(lane.row);
      el.innerHTML = `<span class="tree-lane-icon">${lane.icon}</span><span>${t(lane.label)}</span>`;
      lanesHost.appendChild(el);
    }
    positionLanes();
  }

  // ── Detail panel ────────────────────────────────────────────────────────
  function select(nodeId: string | null): void {
    selectedId = nodeId;
    nodesHost.querySelectorAll(".tnode.selected").forEach((n) => n.classList.remove("selected"));
    if (!nodeId) {
      detail.hidden = true;
      return;
    }
    nodesHost.querySelector(`[data-node-id="${nodeId}"]`)?.classList.add("selected");
    renderDetail();
  }

  function renderDetail(): void {
    if (!selectedId) {
      detail.hidden = true;
      return;
    }
    const node = tree.nodes.find((n) => n.id === selectedId);
    if (!node) {
      detail.hidden = true;
      return;
    }
    const state = ctx.getState();
    const states = computeNodeStates(state, tree);
    const s = states.get(node.id) ?? "far";
    const owned = s === "owned";
    const ready = s === "available";
    const affordable = canAfford(state, node);

    let title: string;
    let desc: string;
    let effect: string;
    if (node.kind === "toy") {
      const toy = getToyType(node.refId)!;
      title = toyName(node.refId);
      desc = t("techTree.toyDesc");
      effect = t("shop.sellsFor", { value: formatMoneyPrecise(toy.baseSellValue) });
    } else {
      const up = getUpgrade(node.refId)!;
      title = upgradeName(node.refId);
      desc = upgradeDesc(node.refId);
      effect = up.effect.type === "unlock" ? t("upgrade.effect.unlock") : describeUpgradeEffect(up.effect);
    }

    // Name what's still missing, so a locked node explains itself.
    const missing = node.requires
      .filter((r) => {
        const req = tree.nodes.find((n) => n.id === r);
        return req && !isNodeOwned(state, req);
      })
      .map((r) => {
        const req = tree.nodes.find((n) => n.id === r)!;
        return `${req.icon} ${labelFor(req)}`;
      });

    detail.hidden = false;
    detail.innerHTML = `
      <button class="tree-detail-close" data-close type="button" aria-label="${t("techTree.close")}">✕</button>
      <div class="tree-detail-head">
        <span class="tree-detail-icon">${node.icon}</span>
        <div>
          <div class="tree-detail-title">${title}</div>
          <div class="tree-detail-effect">${effect}</div>
        </div>
      </div>
      <div class="tree-detail-desc">${desc}</div>
      ${missing.length ? `<div class="tree-detail-req">🔒 ${t("techTree.needs", { list: missing.join(", ") })}</div>` : ""}
    `;

    const buy = document.createElement("button");
    buy.type = "button";
    buy.className = "tree-buy";
    if (owned) {
      buy.textContent = t("shop.ownedBtn");
      buy.disabled = true;
    } else if (!ready) {
      buy.textContent = t("techTree.locked");
      buy.disabled = true;
    } else {
      buy.textContent = t("shop.buyBtn", { cost: formatCost(node.cost) });
      buy.disabled = !affordable;
      buy.onclick = () => {
        if (node.kind === "toy") ctx.systems.shop.buyToyUnlock(ctx.getState(), node.refId);
        else ctx.systems.shop.buyUpgrade(ctx.getState(), node.refId);
        ctx.rebuildUI();
      };
    }
    detail.appendChild(buy);
    detail.querySelector<HTMLButtonElement>("[data-close]")!.onclick = () => select(null);
  }

  // Clicking empty canvas dismisses the detail panel.
  root.addEventListener("click", (e) => {
    if (dragMoved) return;
    if (!(e.target as HTMLElement).closest(".tnode, .tree-detail, .tree-ctl")) select(null);
  });

  buildLaneLabels();
  let framed = false;

  /**
   * Park the camera on the live frontier the first time we have real dimensions.
   * The page is built while the Upgrades tab is still hidden, so at boot the
   * host measures 0×0 and nothing can be positioned meaningfully — this runs on
   * the first frame the panel is actually on screen.
   */
  function frameOnce(): void {
    if (framed || root.clientWidth === 0) return;
    framed = true;
    fit();

    const target = nextAffordableNode(ctx.getState(), tree);
    if (!target) return;

    // Frame the frontier horizontally, but sit vertically BETWEEN it and the toy
    // spine. Centring on the node itself put the camera on whichever lane
    // happened to hold the cheapest buy (often Crews, right at the bottom) with
    // the main toy road scrolled off-screen entirely.
    const p = px(target);
    const spineRow = tree.lanes.find((l) => l.id === "toys")?.row ?? 0;
    const spineY = PAD + spineRow * UNIT_Y;
    zoom = 0.62;
    centerOn(p.x, (spineY + p.y) / 2);
  }

  return {
    rebuild() {
      const states = computeNodeStates(ctx.getState(), tree);
      buildEdges(states);
      buildNodes(states);
      if (selectedId) select(selectedId);
      frameOnce();
      applyTransform();
    },

    renderFrame() {
      frameOnce();
      // Lane labels live in screen space, so they must follow any size change
      // (tab switch, window resize). Nine elements — cheap enough per frame.
      positionLanes();

      // Money changes constantly — only the affordability outline needs to move,
      // so this stays a class toggle rather than a rebuild.
      const state = ctx.getState();
      nodesHost.querySelectorAll<HTMLElement>(".tnode.state-available").forEach((el) => {
        const node = tree.nodes.find((n) => n.id === el.dataset.nodeId);
        if (node) el.classList.toggle("affordable", canAfford(state, node));
      });
    },
  };
}
