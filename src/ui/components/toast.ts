/**
 * toast — transient corner notifications (e.g. "a station broke down").
 * Styles: toast.css. Toasts auto-dismiss; click to dismiss early.
 */

import "./toast.css";

export type ToastKind = "warning" | "info" | "success";

export function spawnToast(layer: HTMLElement, message: string, kind: ToastKind = "warning"): void {
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.textContent = message;

  const dismiss = () => {
    el.classList.add("leaving");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
  };

  el.onclick = dismiss;
  layer.appendChild(el);

  // enter on next frame so the CSS transition runs
  requestAnimationFrame(() => el.classList.add("shown"));
  window.setTimeout(dismiss, 4600);
}
