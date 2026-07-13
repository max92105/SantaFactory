/**
 * ordersPage — the "Orders" tab: accept daily delivery orders and fill them
 * with finished toys for a reward.
 * Markup: ordersPage.html · Styles: ordersPage.css
 * Logic: OrdersSystem (generation, accept, deliver); events: config/eventsConfig.ts.
 */

import ordersPageHtml from "./ordersPage.html?raw";
import "./ordersPage.css";

import type { Page } from "../Page";
import type { GameContext } from "../../../core/GameContext";
import type { Order } from "../../../state/GameState";
import { MAX_ACTIVE_ORDERS } from "../../../config/ordersConfig";
import { getToyType } from "../../../config/toyTypesConfig";
import { deliverableTo, deliverableToLine, orderRemaining, progressOf } from "../../../helpers/orderHelpers";
import { getSellableStock } from "../../../helpers/inventoryHelpers";
import { createStepper } from "../../components/stepper";
import { formatInt, formatMoney } from "../../../helpers/formatHelpers";

export function createOrdersPage(): Page {
  return {
    mount(container) {
      container.insertAdjacentHTML("beforeend", ordersPageHtml);
    },

    bind() {
      // All cards are (re)built in rebuild()
    },

    rebuild(ctx) {
      const state = ctx.getState();
      ctx.dom.ordersMax.textContent = String(MAX_ACTIVE_ORDERS);
      ctx.dom.ordersActiveCount.textContent = String(state.orders.active.length);

      buildEventBanner(ctx);
      buildActiveList(ctx);
      buildOfferList(ctx);
    },

    renderFrame(ctx) {
      const state = ctx.getState();
      // Live: deliverable amount + deliver-button state as stock changes,
      // plus the rush countdown on any accepted rush order.
      for (const order of state.orders.active) {
        const card = ctx.dom.ordersActiveList.querySelector<HTMLElement>(`[data-order-id="${order.id}"]`);
        if (!card) continue;
        const ready = deliverableTo(state, order);
        const readyEl = card.querySelector<HTMLElement>("[data-deliverable]");
        if (readyEl) readyEl.textContent = `${formatInt(ready)} ready to ship`;
        const btn = card.querySelector<HTMLButtonElement>(".order-deliver");
        if (btn) btn.disabled = ready <= 0;
        updateSecs(card, order);
      }
      // Live: rush countdown on available offers
      for (const order of state.orders.offers) {
        if (order.secondsLeft == null) continue;
        const card = ctx.dom.ordersOfferList.querySelector<HTMLElement>(`[data-order-id="${order.id}"]`);
        if (card) updateSecs(card, order);
      }
    },
  };
}

/** Refresh a rush order's live "⚡ Ns" countdown chip (flashes near expiry). */
function updateSecs(card: HTMLElement, order: Order): void {
  if (order.secondsLeft == null) return;
  const el = card.querySelector<HTMLElement>("[data-secs]");
  if (!el) return;
  const s = Math.max(0, Math.ceil(order.secondsLeft));
  el.textContent = `⚡ ${s}s`;
  el.classList.toggle("ending", s <= 15);
}

/** Lead icon: the toy's icon for a single-line order, a parcel for multi-toy. */
function orderIcon(order: Order): string {
  if (order.lines.length === 1) return getToyType(order.lines[0].toyType)?.icon ?? "🎁";
  return "📦";
}

/** Title text: "50 × Plushy" for one toy, "Mixed order · 3 toys" for several. */
function orderLabel(order: Order): string {
  if (order.lines.length === 1) {
    const l = order.lines[0];
    return `${formatInt(l.quantity)} × ${getToyType(l.toyType)?.name ?? "Toy"}`;
  }
  return `Mixed order · ${order.lines.length} toys`;
}

/** Per-line request chips for an offer ("50× 🧸 Plushy"). */
function linesHtml(order: Order): string {
  return order.lines
    .map((l) => {
      const t = getToyType(l.toyType);
      return `<span class="order-line"><strong>${formatInt(l.quantity)}×</strong> ${t?.icon ?? "🎁"} ${t?.name ?? "Toy"}</span>`;
    })
    .join("");
}

/** Per-line delivery progress chips for an active order ("🧸 8/50"). */
function linesProgressHtml(order: Order): string {
  return order.lines
    .map((l) => {
      const t = getToyType(l.toyType);
      const done = l.delivered >= l.quantity;
      return `<span class="order-line${done ? " done" : ""}">${t?.icon ?? "🎁"} ${formatInt(l.delivered)}/${formatInt(
        l.quantity
      )}</span>`;
    })
    .join("");
}

/** Deadline chip: a real-time countdown for rush orders, days for the rest. */
function deadlineBadge(order: Order): string {
  if (order.secondsLeft != null) {
    const s = Math.max(0, Math.ceil(order.secondsLeft));
    return `<span class="secs-badge${s <= 15 ? " ending" : ""}" data-secs>⚡ ${s}s</span>`;
  }
  const d = order.daysLeft;
  const cls = d <= 1 ? "days-badge urgent" : "days-badge";
  return `<span class="${cls}">${d} day${d === 1 ? "" : "s"} left</span>`;
}

function buildEventBanner(ctx: GameContext): void {
  const event = ctx.systems.orders.currentEvent(ctx.getState());
  const el = ctx.dom.ordersEvent;
  if (!event) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  const feat = event.featuredToy ? getToyType(event.featuredToy) : null;
  el.innerHTML = `
    <span class="event-icon">${event.icon}</span>
    <div class="event-text">
      <div class="event-name">${event.name}</div>
      <div class="event-desc">${event.description} Orders pay ×${event.orderPayMult}${
    feat ? ` · ${feat.icon} ${feat.name} in demand` : ""
  }.</div>
    </div>
  `;
}

/** Accepted orders: progress + a Deliver button. */
function buildActiveList(ctx: GameContext): void {
  const state = ctx.getState();
  const host = ctx.dom.ordersActiveList;
  host.innerHTML = "";

  if (state.orders.active.length === 0) {
    host.innerHTML = `<div class="orders-empty">No accepted orders yet — grab one below.</div>`;
    return;
  }

  for (const order of state.orders.active) {
    const card = document.createElement("div");
    card.className = "order-card active" + (order.rush ? " rush" : "");
    card.dataset.orderId = String(order.id);
    card.innerHTML = `
      <span class="order-icon">${orderIcon(order)}</span>
      <div class="order-info">
        <div class="order-title">${orderLabel(order)}${order.rush ? ` <span class="rush-badge">RUSH</span>` : ""} ${deadlineBadge(order)}</div>
        <div class="order-progress"><div class="order-progress-fill" style="width:${Math.floor(
          progressOf(order) * 100
        )}%"></div></div>
        <div class="order-lines">${linesProgressHtml(order)}</div>
        <div class="order-meta">
          <span class="order-reward">${formatMoney(order.reward)}</span>
          <span class="order-ready" data-deliverable>0 ready to ship</span>
        </div>
      </div>
    `;

    const deliver = document.createElement("button");
    deliver.className = "order-deliver";
    deliver.textContent = "Deliver…";
    deliver.onclick = () => openDeliverModal(ctx, order.id);
    card.appendChild(deliver);
    host.appendChild(card);
  }
}

/** Available offers: accept to start working them. */
function buildOfferList(ctx: GameContext): void {
  const state = ctx.getState();
  const host = ctx.dom.ordersOfferList;
  host.innerHTML = "";

  if (state.orders.offers.length === 0) {
    host.innerHTML = `<div class="orders-empty">No orders today.</div>`;
    return;
  }

  const atCap = state.orders.active.length >= MAX_ACTIVE_ORDERS;

  // Rush offers (time-pressured) float to the top of the board.
  const offers = [...state.orders.offers].sort((a, b) => Number(b.rush) - Number(a.rush));

  for (const order of offers) {
    const card = document.createElement("div");
    card.className = "order-card offer" + (order.rush ? " rush" : "");
    card.dataset.orderId = String(order.id);
    card.innerHTML = `
      <span class="order-icon">${orderIcon(order)}</span>
      <div class="order-info">
        <div class="order-title">${orderLabel(order)}${
      order.rush ? ` <span class="rush-badge">RUSH</span>` : ""
    }</div>
        ${order.lines.length > 1 ? `<div class="order-lines">${linesHtml(order)}</div>` : ""}
        <div class="order-meta">
          <span class="order-reward">${formatMoney(order.reward)}</span>
          <span>·</span>
          ${deadlineBadge(order)}
        </div>
      </div>
    `;

    const accept = document.createElement("button");
    accept.className = "order-accept";
    accept.textContent = atCap ? "Full" : "Accept";
    accept.disabled = atCap;
    accept.onclick = () => {
      ctx.systems.orders.acceptOrder(ctx.getState(), order.id);
      ctx.rebuildUI();
    };
    card.appendChild(accept);
    host.appendChild(card);
  }
}

// ── Deliver modal ─────────────────────────────────────────────────────────
/**
 * A focused picker for filling an order: one typeable number field per toy
 * (capped to what's owed and in stock), with Max/Clear shortcuts and a live
 * summary. Centered dialog on desktop, bottom sheet on mobile.
 */
function openDeliverModal(ctx: GameContext, orderId: number): void {
  document.querySelector(".deliver-overlay")?.remove();

  const state = ctx.getState();
  const order = state.orders.active.find((o) => o.id === orderId);
  if (!order) return;

  // Chosen amount per toy — default to the most we can ship right now.
  const amounts: Record<string, number> = {};
  for (const line of order.lines) amounts[line.toyType] = deliverableToLine(state, line);

  const overlay = document.createElement("div");
  overlay.className = "deliver-overlay";
  const sheet = document.createElement("div");
  sheet.className = "deliver-sheet";
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

  // maxShip per toy, computed once at open (stock at this moment).
  const maxShip: Record<string, number> = {};
  for (const line of order.lines) {
    maxShip[line.toyType] = Math.min(
      Math.max(0, line.quantity - line.delivered),
      getSellableStock(state, line.toyType)
    );
  }

  render();
  document.body.appendChild(overlay);
  sheet.querySelector<HTMLInputElement>(".stepper-input")?.focus();

  function render(): void {
    const ord = ctx.getState().orders.active.find((o) => o.id === orderId);
    if (!ord) {
      close();
      return;
    }
    sheet.innerHTML = "";

    // Header
    const head = document.createElement("div");
    head.className = "deliver-head";
    head.innerHTML = `<span class="deliver-title">Deliver to order</span>`;
    const x = document.createElement("button");
    x.className = "deliver-close";
    x.setAttribute("aria-label", "Close");
    x.textContent = "✕";
    x.onclick = close;
    head.appendChild(x);
    sheet.appendChild(head);

    const sub = document.createElement("div");
    sub.className = "deliver-sub";
    sub.innerHTML = `Reward <strong>${formatMoney(ord.reward)}</strong> · ${formatInt(orderRemaining(ord))} still needed`;
    sheet.appendChild(sub);

    // One row per toy line
    const lines = document.createElement("div");
    lines.className = "deliver-lines";
    for (const line of ord.lines) {
      const t = getToyType(line.toyType);
      const remaining = Math.max(0, line.quantity - line.delivered);
      const cap = maxShip[line.toyType] ?? 0;
      amounts[line.toyType] = Math.max(0, Math.min(amounts[line.toyType] ?? 0, cap));

      const row = document.createElement("div");
      row.className = "deliver-line" + (remaining === 0 ? " done" : "");
      row.innerHTML = `
        <span class="dl-icon">${t?.icon ?? "🎁"}</span>
        <div class="dl-info">
          <div class="dl-name">${t?.name ?? "Toy"}</div>
          <div class="dl-meta">${formatInt(line.delivered)}/${formatInt(line.quantity)} filled · ${formatInt(
            getSellableStock(ctx.getState(), line.toyType)
          )} in stock</div>
        </div>
      `;

      const control = document.createElement("div");
      control.className = "dl-control";
      if (remaining === 0) {
        control.innerHTML = `<span class="dl-doneflag">✓ Filled</span>`;
      } else if (cap === 0) {
        control.innerHTML = `<span class="dl-nostock">No stock</span>`;
      } else {
        control.appendChild(
          createStepper({
            value: amounts[line.toyType],
            min: 0,
            max: cap,
            withMax: true,
            onChange: (v) => {
              amounts[line.toyType] = v;
              refreshSummary();
            },
          })
        );
      }
      row.appendChild(control);
      lines.appendChild(row);
    }
    sheet.appendChild(lines);

    // Footer: summary + quick actions + confirm/cancel
    const foot = document.createElement("div");
    foot.className = "deliver-foot";

    const summary = document.createElement("div");
    summary.className = "deliver-summary";
    foot.appendChild(summary);

    const anyShippable = ord.lines.some((l) => (maxShip[l.toyType] ?? 0) > 0);
    if (anyShippable) {
      const quick = document.createElement("div");
      quick.className = "deliver-quick";
      const maxAll = document.createElement("button");
      maxAll.className = "dl-quick";
      maxAll.textContent = "Max all";
      maxAll.onclick = () => {
        for (const l of ord.lines) amounts[l.toyType] = maxShip[l.toyType] ?? 0;
        render();
      };
      const clear = document.createElement("button");
      clear.className = "dl-quick";
      clear.textContent = "Clear";
      clear.onclick = () => {
        for (const l of ord.lines) amounts[l.toyType] = 0;
        render();
      };
      quick.append(maxAll, clear);
      foot.appendChild(quick);
    }

    const actions = document.createElement("div");
    actions.className = "deliver-actions";
    const confirm = document.createElement("button");
    confirm.className = "deliver-confirm";
    confirm.textContent = "Deliver";
    confirm.onclick = () => {
      ctx.systems.orders.deliverAmounts(ctx.getState(), orderId, amounts);
      close();
      ctx.rebuildUI();
    };
    const cancel = document.createElement("button");
    cancel.className = "deliver-cancel";
    cancel.textContent = "Cancel";
    cancel.onclick = close;
    actions.append(cancel, confirm);
    foot.appendChild(actions);

    sheet.appendChild(foot);
    refreshSummary();

    function refreshSummary(): void {
      let total = 0;
      let completes = true;
      for (const line of ord!.lines) {
        const ship = Math.max(0, Math.min(amounts[line.toyType] ?? 0, maxShip[line.toyType] ?? 0));
        total += ship;
        if (line.delivered + ship < line.quantity) completes = false;
      }
      summary.innerHTML =
        total > 0
          ? `Shipping <strong>${formatInt(total)}</strong> ${
              completes
                ? `· <span class="ok">completes the order (+${formatMoney(ord!.reward)})</span>`
                : "· partial delivery"
            }`
          : `Choose how many of each toy to ship.`;
      confirm.disabled = total <= 0;
    }
  }
}
