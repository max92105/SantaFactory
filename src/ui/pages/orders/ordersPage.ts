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
import type { Order, OrderLine } from "../../../state/GameState";
import { MAX_ACTIVE_ORDERS } from "../../../config/ordersConfig";
import { SLEIGH_MAGIC } from "../../../config/christmasConfig";
import { deliverableTo, deliverableToLine, orderRemaining, progressOf } from "../../../helpers/orderHelpers";
import { getSellableStock } from "../../../helpers/inventoryHelpers";
import { isToyUnlocked } from "../../../helpers/unlockHelpers";
import { createStepper } from "../../components/stepper";
import { formatCompact, formatInt, formatMoney } from "../../../helpers/formatHelpers";
import { t } from "../../i18n/i18n";
import {
  toyName,
  toyIcon,
  grandOrderName,
  grandOrderFlavor,
  calendarEventName,
  calendarEventDesc,
} from "../../i18n/localize";

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

      buildChristmasSection(ctx);
      buildGrandSection(ctx);
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
        if (readyEl) readyEl.textContent = t("orders.readyToShip", { n: formatInt(ready) });
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

      // Live: grand order's progress + ready-to-ship as stock changes
      const g = state.grand.current;
      if (g) {
        const readyEl = ctx.dom.ordersGrand.querySelector<HTMLElement>("[data-grand-ready]");
        if (readyEl) readyEl.textContent = t("orders.readyToShip", { n: formatInt(deliverableTo(state, g)) });
        const fill = ctx.dom.ordersGrand.querySelector<HTMLElement>(".grand-progress-fill");
        if (fill) fill.style.width = `${Math.floor(progressOf(g) * 100)}%`;
      }

      // Live: the Christmas Order's ready count + deliver button
      const xmasReady = deliverableTo(state, state.christmas);
      const xmasReadyEl = ctx.dom.ordersChristmas.querySelector<HTMLElement>("[data-xmas-ready]");
      if (xmasReadyEl) xmasReadyEl.textContent = t("orders.readyToShip", { n: formatInt(xmasReady) });
      const xmasBtn = ctx.dom.ordersChristmas.querySelector<HTMLButtonElement>(".xmas-deliver");
      if (xmasBtn) xmasBtn.disabled = xmasReady <= 0;
    },
  };
}

/** Refresh a rush order's live "⚡ Ns" countdown chip (flashes near expiry). */
function updateSecs(card: HTMLElement, order: Order): void {
  if (order.secondsLeft == null) return;
  const el = card.querySelector<HTMLElement>("[data-secs]");
  if (!el) return;
  const s = Math.max(0, Math.ceil(order.secondsLeft));
  el.textContent = t("orders.secs", { n: s });
  el.classList.toggle("ending", s <= 15);
}

/** Lead icon: the toy's icon for a single-line order, a parcel for multi-toy. */
function orderIcon(order: Order): string {
  if (order.lines.length === 1) return toyIcon(order.lines[0].toyType);
  return "📦";
}

/** Title text: "50 × Plushy" for one toy, "Mixed order · 3 toys" for several. */
function orderLabel(order: Order): string {
  if (order.lines.length === 1) {
    const l = order.lines[0];
    return t("orders.times", { n: formatInt(l.quantity), name: toyName(l.toyType) });
  }
  return t("orders.mixed", { n: order.lines.length });
}

/** Per-line request chips for an offer ("50× 🧸 Plushy"). */
function linesHtml(order: Order): string {
  return order.lines
    .map(
      (l) =>
        `<span class="order-line"><strong>${formatInt(l.quantity)}×</strong> ${toyIcon(l.toyType)} ${toyName(l.toyType)}</span>`
    )
    .join("");
}

/** Per-line delivery progress chips for an active order ("🧸 8/50"). */
function linesProgressHtml(order: { lines: OrderLine[] }): string {
  return order.lines
    .map((l) => {
      const done = l.delivered >= l.quantity;
      return `<span class="order-line${done ? " done" : ""}">${toyIcon(l.toyType)} ${formatInt(l.delivered)}/${formatInt(
        l.quantity
      )}</span>`;
    })
    .join("");
}

/** Deadline chip: a real-time countdown for rush orders, days for the rest. */
function deadlineBadge(order: Order): string {
  if (order.secondsLeft != null) {
    const s = Math.max(0, Math.ceil(order.secondsLeft));
    return `<span class="secs-badge${s <= 15 ? " ending" : ""}" data-secs>${t("orders.secs", { n: s })}</span>`;
  }
  const d = order.daysLeft;
  const cls = d <= 1 ? "days-badge urgent" : "days-badge";
  return `<span class="${cls}">${t("orders.daysBadge", { n: d })}</span>`;
}

/**
 * THE CHRISTMAS ORDER — the endgame banner pinned above everything: 9 billion
 * gifts (toys × sleigh magic), a progress bar, a collapsible 50-toy checklist,
 * and one "deliver everything" button (per-line steppers would be busywork).
 */
function buildChristmasSection(ctx: GameContext): void {
  const state = ctx.getState();
  const host = ctx.dom.ordersChristmas;
  const view = ctx.systems.christmas.getView(state);

  // Keep the checklist open across rebuilds (deliveries rebuild the page).
  const wasOpen = host.querySelector<HTMLDetailsElement>(".xmas-details")?.open ?? false;

  const doneLines = state.christmas.lines.filter((l) => l.delivered >= l.quantity).length;
  const pct = Math.floor(view.progress * 100);

  host.innerHTML = `
    <div class="xmas-head">
      <span class="xmas-icon">🎄</span>
      <div class="xmas-head-text">
        <div class="xmas-tag">${t("christmas.tag")}</div>
        <div class="xmas-flavor">${t("christmas.flavor", { gifts: formatInt(view.totalGifts) })}</div>
        <div class="xmas-magic">${t("christmas.magic", { n: formatInt(SLEIGH_MAGIC) })}</div>
      </div>
      <div class="xmas-deadline">
        <span class="xmas-days">${formatInt(view.daysLeft)}</span>
        <span class="xmas-days-label">${t("orders.daysLeft")}</span>
      </div>
    </div>
    <div class="xmas-progress"><div class="xmas-progress-fill" style="width:${pct}%"></div></div>
    <div class="xmas-numbers">
      <span>${t("christmas.progressGifts", {
        d: formatCompact(view.deliveredGifts),
        total: formatCompact(view.totalGifts),
      })}</span>
      <span class="xmas-pct">${pct}%</span>
    </div>
    <details class="xmas-details"${wasOpen ? " open" : ""}>
      <summary>${t("christmas.checklist", { done: doneLines, n: state.christmas.lines.length })}</summary>
      <div class="xmas-lines">${state.christmas.lines
        .map((l) => {
          const done = l.delivered >= l.quantity;
          const locked = !isToyUnlocked(state, l.toyType);
          return `<span class="order-line xmas-line${done ? " done" : ""}${locked ? " locked" : ""}" title="${toyName(
            l.toyType
          )}">${locked ? "🔒" : toyIcon(l.toyType)} ${formatCompact(l.delivered)}/${formatCompact(l.quantity)}</span>`;
        })
        .join("")}</div>
    </details>
    <div class="xmas-foot">
      <span class="xmas-ready" data-xmas-ready>${t("orders.readyToShip", { n: "0" })}</span>
    </div>
  `;

  const deliver = document.createElement("button");
  deliver.className = "xmas-deliver";
  deliver.textContent = t("christmas.deliverAll");
  deliver.disabled = true; // renderFrame enables it as soon as stock is ready
  deliver.onclick = () => {
    ctx.systems.christmas.deliverMax(ctx.getState());
    ctx.rebuildUI();
  };
  host.querySelector(".xmas-foot")!.appendChild(deliver);
}

/** The pinned holiday "grand order": banner, progress, and a Deliver button. */
function buildGrandSection(ctx: GameContext): void {
  const state = ctx.getState();
  const host = ctx.dom.ordersGrand;
  const g = state.grand.current;

  if (!g) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }

  host.hidden = false;
  const daysLeft = Math.max(0, g.deadlineDay - state.time.day);
  host.innerHTML = `
    <div class="grand-head">
      <span class="grand-icon">${g.icon}</span>
      <div class="grand-head-text">
        <div class="grand-tag">${t("orders.grandTag")}</div>
        <div class="grand-name">${grandOrderName(g.defId)}</div>
        <div class="grand-flavor">${grandOrderFlavor(g.defId)}</div>
      </div>
      <div class="grand-deadline">
        <span class="grand-days">${formatInt(daysLeft)}</span>
        <span class="grand-days-label">${t("orders.daysLeft")}</span>
      </div>
    </div>
    <div class="grand-progress"><div class="grand-progress-fill" style="width:${Math.floor(
      progressOf(g) * 100
    )}%"></div></div>
    <div class="order-lines grand-lines">${linesProgressHtml(g)}</div>
    <div class="grand-foot">
      <span class="grand-reward">${formatMoney(g.reward)}</span>
      <span class="grand-ready" data-grand-ready>0 ready to ship</span>
    </div>
  `;

  const deliver = document.createElement("button");
  deliver.className = "grand-deliver";
  deliver.textContent = t("orders.deliverEllipsis");
  deliver.onclick = () =>
    openDeliverModal(ctx, {
      title: t("deliver.titleTo", { name: grandOrderName(g.defId) }),
      getOrder: () => ctx.getState().grand.current,
      deliver: (amounts) => ctx.systems.orders.deliverToGrand(ctx.getState(), amounts),
    });
  host.querySelector(".grand-foot")!.appendChild(deliver);
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
  const feat = event.featuredToy
    ? t("orders.eventFeat", { icon: toyIcon(event.featuredToy), name: toyName(event.featuredToy) })
    : "";
  el.innerHTML = `
    <span class="event-icon">${event.icon}</span>
    <div class="event-text">
      <div class="event-name">${calendarEventName(event.id)}</div>
      <div class="event-desc">${t("orders.eventPays", {
        desc: calendarEventDesc(event.id),
        mult: event.orderPayMult,
        feat,
      })}</div>
    </div>
  `;
}

/** Accepted orders: progress + a Deliver button. */
function buildActiveList(ctx: GameContext): void {
  const state = ctx.getState();
  const host = ctx.dom.ordersActiveList;
  host.innerHTML = "";

  if (state.orders.active.length === 0) {
    host.innerHTML = `<div class="orders-empty">${t("orders.noneAccepted")}</div>`;
    return;
  }

  for (const order of state.orders.active) {
    const card = document.createElement("div");
    card.className = "order-card active" + (order.rush ? " rush" : "");
    card.dataset.orderId = String(order.id);
    card.innerHTML = `
      <span class="order-icon">${orderIcon(order)}</span>
      <div class="order-info">
        <div class="order-title">${orderLabel(order)}${order.rush ? ` <span class="rush-badge">${t("orders.rush")}</span>` : ""} ${deadlineBadge(order)}</div>
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
    deliver.textContent = t("orders.deliverEllipsis");
    deliver.onclick = () =>
      openDeliverModal(ctx, {
        title: t("deliver.title"),
        getOrder: () => ctx.getState().orders.active.find((o) => o.id === order.id) ?? null,
        deliver: (amounts) => ctx.systems.orders.deliverAmounts(ctx.getState(), order.id, amounts),
      });
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
    host.innerHTML = `<div class="orders-empty">${t("orders.noneToday")}</div>`;
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
      order.rush ? ` <span class="rush-badge">${t("orders.rush")}</span>` : ""
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
    accept.textContent = atCap ? t("orders.full") : t("orders.accept");
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
/** What the deliver modal needs — works for a daily Order or a GrandOrder. */
type DeliverSource = {
  title: string;
  getOrder: () => { id: number; lines: OrderLine[]; reward: number } | null;
  deliver: (amounts: Record<string, number>) => void;
};

/**
 * A focused picker for filling an order: one typeable number field per toy
 * (capped to what's owed and in stock), with Max/Clear shortcuts and a live
 * summary. Centered dialog on desktop, bottom sheet on mobile.
 */
function openDeliverModal(ctx: GameContext, source: DeliverSource): void {
  document.querySelector(".deliver-overlay")?.remove();

  const state = ctx.getState();
  const order = source.getOrder();
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
    const ord = source.getOrder();
    if (!ord) {
      close();
      return;
    }
    sheet.innerHTML = "";

    // Header
    const head = document.createElement("div");
    head.className = "deliver-head";
    head.innerHTML = `<span class="deliver-title">${source.title}</span>`;
    const x = document.createElement("button");
    x.className = "deliver-close";
    x.setAttribute("aria-label", "Close");
    x.textContent = "✕";
    x.onclick = close;
    head.appendChild(x);
    sheet.appendChild(head);

    const sub = document.createElement("div");
    sub.className = "deliver-sub";
    sub.innerHTML = t("deliver.sub", { reward: `<strong>${formatMoney(ord.reward)}</strong>`, left: formatInt(orderRemaining(ord)) });
    sheet.appendChild(sub);

    // One row per toy line
    const lines = document.createElement("div");
    lines.className = "deliver-lines";
    for (const line of ord.lines) {
      const remaining = Math.max(0, line.quantity - line.delivered);
      const cap = maxShip[line.toyType] ?? 0;
      amounts[line.toyType] = Math.max(0, Math.min(amounts[line.toyType] ?? 0, cap));

      const row = document.createElement("div");
      row.className = "deliver-line" + (remaining === 0 ? " done" : "");
      row.innerHTML = `
        <span class="dl-icon">${toyIcon(line.toyType)}</span>
        <div class="dl-info">
          <div class="dl-name">${toyName(line.toyType)}</div>
          <div class="dl-meta">${t("deliver.filled", {
            d: formatInt(line.delivered),
            q: formatInt(line.quantity),
            stock: formatInt(getSellableStock(ctx.getState(), line.toyType)),
          })}</div>
        </div>
      `;

      const control = document.createElement("div");
      control.className = "dl-control";
      if (remaining === 0) {
        control.innerHTML = `<span class="dl-doneflag">${t("deliver.done")}</span>`;
      } else if (cap === 0) {
        control.innerHTML = `<span class="dl-nostock">${t("deliver.noStock")}</span>`;
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
      maxAll.textContent = t("deliver.maxAll");
      maxAll.onclick = () => {
        for (const l of ord.lines) amounts[l.toyType] = maxShip[l.toyType] ?? 0;
        render();
      };
      const clear = document.createElement("button");
      clear.className = "dl-quick";
      clear.textContent = t("deliver.clear");
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
    confirm.textContent = t("deliver.confirm");
    confirm.onclick = () => {
      source.deliver(amounts);
      close();
      ctx.rebuildUI();
    };
    const cancel = document.createElement("button");
    cancel.className = "deliver-cancel";
    cancel.textContent = t("deliver.cancel");
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
          ? t("deliver.summaryShip", { n: `<strong>${formatInt(total)}</strong>` }) +
            (completes
              ? `<span class="ok">${t("deliver.summaryCompletes", { reward: formatMoney(ord!.reward) })}</span>`
              : t("deliver.summaryPartial"))
          : t("deliver.summaryEmpty");
      confirm.disabled = total <= 0;
    }
  }
}
