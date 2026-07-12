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
import { deliverableTo, progressOf } from "../../../helpers/orderHelpers";
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
      // Live: deliverable amount + deliver-button state as stock changes
      for (const order of state.orders.active) {
        const card = ctx.dom.ordersActiveList.querySelector<HTMLElement>(`[data-order-id="${order.id}"]`);
        if (!card) continue;
        const ready = deliverableTo(state, order);
        const readyEl = card.querySelector<HTMLElement>("[data-deliverable]");
        if (readyEl) readyEl.textContent = `${formatInt(ready)} ready to ship`;
        const btn = card.querySelector<HTMLButtonElement>(".order-deliver");
        if (btn) btn.disabled = ready <= 0;
      }
    },
  };
}

function toyLabel(order: Order): { icon: string; name: string } {
  const t = getToyType(order.toyType);
  return { icon: t?.icon ?? "🎁", name: t?.name ?? "Toy" };
}

function daysBadge(order: Order): string {
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
    const { icon, name } = toyLabel(order);
    const card = document.createElement("div");
    card.className = "order-card active" + (order.rush ? " rush" : "");
    card.dataset.orderId = String(order.id);
    card.innerHTML = `
      <span class="order-icon">${icon}</span>
      <div class="order-info">
        <div class="order-title">${name}${order.rush ? ` <span class="rush-badge">RUSH</span>` : ""} ${daysBadge(order)}</div>
        <div class="order-progress"><div class="order-progress-fill" style="width:${Math.floor(
          progressOf(order) * 100
        )}%"></div></div>
        <div class="order-meta">
          <span>${formatInt(order.delivered)} / ${formatInt(order.quantity)} delivered</span>
          <span class="order-reward">${formatMoney(order.reward)}</span>
          <span class="order-ready" data-deliverable>0 ready to ship</span>
        </div>
      </div>
    `;

    const deliver = document.createElement("button");
    deliver.className = "order-deliver";
    deliver.textContent = "Deliver";
    deliver.onclick = () => {
      ctx.systems.orders.deliverToOrder(ctx.getState(), order.id);
      ctx.rebuildUI();
    };
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

  for (const order of state.orders.offers) {
    const { icon, name } = toyLabel(order);
    const card = document.createElement("div");
    card.className = "order-card offer" + (order.rush ? " rush" : "");
    card.dataset.orderId = String(order.id);
    card.innerHTML = `
      <span class="order-icon">${icon}</span>
      <div class="order-info">
        <div class="order-title">${formatInt(order.quantity)} × ${name}${
      order.rush ? ` <span class="rush-badge">RUSH</span>` : ""
    }</div>
        <div class="order-meta">
          <span class="order-reward">${formatMoney(order.reward)}</span>
          <span>·</span>
          ${daysBadge(order)}
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
