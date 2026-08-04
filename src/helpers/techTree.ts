/**
 * techTree — the progression map: every toy line and upgrade as one connected,
 * navigable graph.
 *
 * Nothing here is hand-authored. Nodes, prerequisite edges and layout are all
 * DERIVED from the existing configs, so adding a toy, a category or a warehouse
 * tier puts it on the map automatically — the same rule the rest of the codebase
 * follows (see docs/ARCHITECTURE.md).
 *
 * ── Shape ───────────────────────────────────────────────────────────────────
 * Lanes run left→right, one theme per lane:
 *
 *   click     ●─Bigger Hammer─●─Power Gloves─●─Sugar Rush
 *   toys      ●─🧸─🟩─🪀─🪁─🏀─…─🤖─…─🛰️        ← the basic-toy spine
 *   music         └🎵─🎼─🎹─🥁─🎤               ← categories branch off the spine
 *   sports            └🏅─🛹─🛼─⛸️
 *   …
 *   storage   ●─W1─W2─W3─…─W16
 *   crew      ●─Maintenance  ●─Repair Workshop
 *
 * ── Layout ──────────────────────────────────────────────────────────────────
 * x comes from log10(cost), so horizontal position means "how far into the run
 * this is" and lanes stay comparable to each other. It's then relaxed so a node
 * always sits at least MIN_GAP right of every prerequisite — edges can never run
 * backwards — and so nodes within a lane never overlap.
 *
 * Units are abstract; the view multiplies by its own spacing.
 */

import type { GameState } from "../state/GameState";
import { toyTypes, toyCategoryId, type ToyTypeDef } from "../config/toyTypesConfig";
import { toyCategories } from "../config/toyCategoriesConfig";
import { upgrades, WAREHOUSE_UPGRADE_IDS, CATEGORY_UNLOCK_IDS, type UpgradeDef } from "../config/upgradesConfig";

// ── Model ─────────────────────────────────────────────────────────────────
export type TechNodeKind = "toy" | "upgrade";

/** How a node relates to the player right now — drives colour and dimming. */
export type TechNodeState =
  | "owned" // bought
  | "available" // every prerequisite met; buyable if you can afford it
  | "next" // one purchase away
  | "far"; // further out — visible, but dimmed with distance

export type TechNode = {
  /** Unique across the graph: "toy:plushy", "up:click_power_1". */
  id: string;
  kind: TechNodeKind;
  /** The toy id or upgrade id this node buys. */
  refId: string;
  lane: string;
  icon: string;
  cost: number;
  /** Node ids that must be owned first. */
  requires: string[];
  x: number;
  y: number;
};

export type TechEdge = { from: string; to: string };

export type TechLane = { id: string; label: string; icon: string; row: number };

export type TechTree = {
  nodes: TechNode[];
  edges: TechEdge[];
  lanes: TechLane[];
  /** Bounds in layout units, for fit-to-screen. */
  width: number;
  height: number;
};

/** Minimum horizontal gap between a node and its prerequisite (layout units). */
const MIN_GAP = 1;
/** Vertical gap between lanes. Wide enough that a lane's handbuild satellites
 *  can hang below it without touching the next lane down. */
const LANE_GAP = 1.7;
/** Handbuild upgrades hang just under their toy rather than taking a lane row. */
const HANDBUILD_Y_OFFSET = 0.7;

const toyNodeId = (toyId: string) => `toy:${toyId}`;
const upNodeId = (upgradeId: string) => `up:${upgradeId}`;

/** log-scaled x seed. Free/cheap things clamp to the left edge. */
function costX(cost: number): number {
  return Math.log10(Math.max(10, cost)) * 3.6;
}

// ── Lanes ─────────────────────────────────────────────────────────────────
/**
 * Lane rows, top to bottom: clicking, the toy spine, one lane per toy category
 * (in config order, which is also cost order, so the branches cascade in the
 * order you'd actually unlock them), then warehouse and crews.
 */
function buildLanes(): TechLane[] {
  const order: Omit<TechLane, "row">[] = [
    { id: "click", label: "techTree.laneClick", icon: "🖱️" },
    { id: "toys", label: "techTree.laneToys", icon: "🧸" },
    ...toyCategories
      .filter((c) => c.id !== "basic")
      .map((c) => ({ id: c.id, label: `toyCat.${c.id}.name`, icon: c.icon })),
    { id: "storage", label: "techTree.laneStorage", icon: "📦" },
    { id: "crew", label: "techTree.laneCrew", icon: "🔧" },
  ];
  return order.map((l, i) => ({ ...l, row: i * LANE_GAP }));
}

/** Which lane an upgrade belongs in. */
function upgradeLane(def: UpgradeDef): string {
  if (WAREHOUSE_UPGRADE_IDS.has(def.id)) return "storage";
  if (CATEGORY_UNLOCK_IDS.has(def.id)) {
    return toyCategories.find((c) => c.unlockUpgrade === def.id)?.id ?? "toys";
  }
  if (def.id.startsWith("handbuild_")) {
    const toy = toyTypes.find((t) => t.id === def.id.slice("handbuild_".length));
    return toy ? toyCategoryId(toy) : "toys";
  }
  if (def.id.startsWith("click_")) return "click";
  return "crew"; // hire_mechanics / hire_menders and any future crew unlock
}

function upgradeIcon(def: UpgradeDef): string {
  if (WAREHOUSE_UPGRADE_IDS.has(def.id)) return "📦";
  if (CATEGORY_UNLOCK_IDS.has(def.id)) {
    return toyCategories.find((c) => c.unlockUpgrade === def.id)?.icon ?? "🔓";
  }
  if (def.id.startsWith("handbuild_")) return "🔨";
  if (def.id.startsWith("click_")) return "🖱️";
  if (def.id === "hire_mechanics") return "🔧";
  if (def.id === "hire_menders") return "🪡";
  return "⬆️";
}

// ── Graph ─────────────────────────────────────────────────────────────────
/**
 * Prerequisite wiring:
 *  - basic toys chain along the spine in catalog order;
 *  - a category's first toy needs that category's unlock upgrade, later ones
 *    chain within the category;
 *  - a category unlock hangs off the last basic toy cheaper than it, so the
 *    branch visibly grows out of the spine;
 *  - every other upgrade follows its own `unlock` rule.
 */
function buildGraph(): { nodes: TechNode[]; edges: TechEdge[] } {
  const nodes: TechNode[] = [];
  const lanes = buildLanes();
  const rowOf = (laneId: string) => lanes.find((l) => l.id === laneId)?.row ?? 0;

  // ── Toys ──
  const byCategory = new Map<string, ToyTypeDef[]>();
  for (const toy of toyTypes) {
    const cat = toyCategoryId(toy);
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(toy);
  }

  for (const [cat, list] of byCategory) {
    const lane = cat === "basic" ? "toys" : cat;
    list.forEach((toy, i) => {
      const requires: string[] = [];
      if (i > 0) {
        requires.push(toyNodeId(list[i - 1].id));
      } else if (cat !== "basic") {
        const unlockUp = toyCategories.find((c) => c.id === cat)?.unlockUpgrade;
        if (unlockUp) requires.push(upNodeId(unlockUp));
      }
      nodes.push({
        id: toyNodeId(toy.id),
        kind: "toy",
        refId: toy.id,
        lane,
        icon: toy.icon,
        cost: toy.unlockCost,
        requires,
        x: costX(toy.unlockCost),
        y: rowOf(lane),
      });
    });
  }

  // ── Upgrades ──
  const basicToys = byCategory.get("basic") ?? [];
  for (const def of upgrades) {
    const lane = upgradeLane(def);
    const requires: string[] = [];

    if (CATEGORY_UNLOCK_IDS.has(def.id)) {
      // Branch off the priciest basic toy you'd already own by this point.
      const gate = [...basicToys].reverse().find((t) => t.unlockCost <= def.cost);
      if (gate) requires.push(toyNodeId(gate.id));
    } else if (def.unlock.type === "upgrade_owned") {
      requires.push(upNodeId(def.unlock.upgradeId));
    } else if (def.unlock.type === "toy_unlocked") {
      requires.push(toyNodeId(def.unlock.toyId));
    }

    const isHandbuild = def.id.startsWith("handbuild_");
    nodes.push({
      id: upNodeId(def.id),
      kind: "upgrade",
      refId: def.id,
      lane,
      icon: upgradeIcon(def),
      cost: def.cost,
      requires,
      x: costX(def.cost),
      // Handbuilds sit just below their toy instead of claiming a lane row.
      y: rowOf(lane) + (isHandbuild ? HANDBUILD_Y_OFFSET : 0),
    });
  }

  const ids = new Set(nodes.map((n) => n.id));
  // Drop dangling prereqs (a config could reference something not on the map).
  for (const n of nodes) n.requires = n.requires.filter((r) => ids.has(r));

  const edges: TechEdge[] = nodes.flatMap((n) => n.requires.map((from) => ({ from, to: n.id })));
  return { nodes, edges };
}

/**
 * Push nodes right until every one clears its prerequisites, then de-overlap
 * within each lane row. Runs to a fixed point over a topological-ish sweep;
 * the graph is a shallow DAG so a handful of passes always converges.
 */
function relaxLayout(nodes: TechNode[]): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  for (let pass = 0; pass < 8; pass++) {
    let moved = false;

    // 1. A node must sit right of every prerequisite.
    for (const n of nodes) {
      for (const reqId of n.requires) {
        const req = byId.get(reqId);
        if (req && n.x < req.x + MIN_GAP) {
          n.x = req.x + MIN_GAP;
          moved = true;
        }
      }
    }

    // 2. Nodes sharing a row must not overlap.
    const rows = new Map<number, TechNode[]>();
    for (const n of nodes) {
      const key = Math.round(n.y * 10);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key)!.push(n);
    }
    for (const row of rows.values()) {
      row.sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i++) {
        if (row[i].x < row[i - 1].x + MIN_GAP) {
          row[i].x = row[i - 1].x + MIN_GAP;
          moved = true;
        }
      }
    }

    if (!moved) break;
  }

  // Normalize so the map starts at the origin.
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  for (const n of nodes) {
    n.x -= minX;
    n.y -= minY;
  }
}

/** The whole map. Pure config → built once and cached. */
let cached: TechTree | null = null;

export function getTechTree(): TechTree {
  if (cached) return cached;
  const { nodes, edges } = buildGraph();
  relaxLayout(nodes);
  cached = {
    nodes,
    edges,
    lanes: buildLanes(),
    width: Math.max(...nodes.map((n) => n.x)),
    height: Math.max(...nodes.map((n) => n.y)),
  };
  return cached;
}

// ── Player-facing state ───────────────────────────────────────────────────
export function isNodeOwned(state: GameState, node: TechNode): boolean {
  return node.kind === "toy" ? !!state.owned.toys[node.refId] : !!state.owned.upgrades[node.refId];
}

/**
 * Classify every node in one pass: owned, available (all prereqs owned), next
 * (one hop past an available node) or far. The view dims by this so the road
 * ahead is legible without hiding it.
 */
export function computeNodeStates(state: GameState, tree: TechTree): Map<string, TechNodeState> {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const result = new Map<string, TechNodeState>();

  for (const n of tree.nodes) {
    if (isNodeOwned(state, n)) {
      result.set(n.id, "owned");
      continue;
    }
    const ready = n.requires.every((r) => {
      const req = byId.get(r);
      return req ? isNodeOwned(state, req) : true;
    });
    result.set(n.id, ready ? "available" : "far");
  }

  // Anything hanging directly off an available node is "next" — one step out.
  for (const n of tree.nodes) {
    if (result.get(n.id) !== "far") continue;
    const oneHop = n.requires.every((r) => {
      const s = result.get(r);
      return s === "owned" || s === "available";
    });
    if (oneHop && n.requires.length > 0) result.set(n.id, "next");
  }

  return result;
}

/** Can this be bought right now (state is available AND the money is there)? */
export function canAfford(state: GameState, node: TechNode): boolean {
  return state.resources.money >= node.cost;
}

/** The cheapest buyable node — where "focus next" jumps to. */
export function nextAffordableNode(state: GameState, tree: TechTree): TechNode | null {
  const states = computeNodeStates(state, tree);
  const open = tree.nodes
    .filter((n) => states.get(n.id) === "available")
    .sort((a, b) => a.cost - b.cost);
  return open.find((n) => canAfford(state, n)) ?? open[0] ?? null;
}
