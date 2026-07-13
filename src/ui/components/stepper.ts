/**
 * stepper — a reusable numeric − / value / + control that matches the app's
 * dark UI (no native number-input spinners). Optionally shows a "Max" button.
 *
 * Fixed dimensions mean every stepper lines up in a column regardless of how
 * many digits the value has. Use it anywhere you need a numeric control:
 *
 *   host.appendChild(createStepper({ value: 3, min: 0, max: 20, onChange }));
 *
 * The value is typeable (numeric keypad on mobile) as well as button-steppable.
 * onChange fires after every change with the clamped value.
 */

import "./stepper.css";

export type StepperOptions = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Show a "Max" button that jumps straight to the max. */
  withMax?: boolean;
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(v || 0)));
}

export function createStepper(opts: StepperOptions): HTMLElement {
  let value = clamp(opts.value, opts.min, opts.max);

  const control = document.createElement("div");
  control.className = "stepper-control";

  const group = document.createElement("div");
  group.className = "stepper";

  const dec = document.createElement("button");
  dec.type = "button";
  dec.className = "stepper-btn";
  dec.textContent = "−";

  const input = document.createElement("input");
  input.className = "stepper-input";
  input.type = "text"; // text + numeric inputmode avoids native spinners entirely
  input.inputMode = "numeric";
  input.value = String(value);

  const inc = document.createElement("button");
  inc.type = "button";
  inc.className = "stepper-btn";
  inc.textContent = "+";

  group.append(dec, input, inc);
  control.appendChild(group);

  function refreshButtons(): void {
    dec.disabled = value <= opts.min;
    inc.disabled = value >= opts.max;
  }

  // apply() is user-driven: it reflects the value AND notifies via onChange.
  function apply(v: number, keepInput = false): void {
    value = clamp(v, opts.min, opts.max);
    if (!keepInput) input.value = String(value);
    refreshButtons();
    opts.onChange(value);
  }

  dec.onclick = () => apply(value - 1);
  inc.onclick = () => apply(value + 1);
  input.oninput = () => {
    const digits = input.value.replace(/[^0-9]/g, "");
    apply(digits === "" ? opts.min : parseInt(digits, 10));
  };

  if (opts.withMax) {
    const max = document.createElement("button");
    max.type = "button";
    max.className = "stepper-max";
    max.textContent = "Max";
    max.onclick = () => apply(opts.max);
    control.appendChild(max);
  }

  refreshButtons(); // initial disabled state only — no onChange on construction
  return control;
}
