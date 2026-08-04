/**
 * grinchEntrance — the Grinch's arrival cinematic.
 *
 * A heist used to just… appear: the corner card faded in and was easy to miss
 * entirely. Now he makes an entrance — his face slams into the middle of the
 * screen, leers around, then shrinks and flies down into the corner card, which
 * pops in exactly as he lands. The flight target is measured from the real card
 * at runtime, so it stays correct at any viewport size.
 *
 * Non-blocking and purely cosmetic: it lives in the pointer-events:none #fxLayer
 * and the game keeps ticking (and his countdown keeps running) throughout.
 * Honours prefers-reduced-motion by skipping straight to the card.
 *
 * Styles: grinchEntrance.css.
 */

import "./grinchEntrance.css";
import grinchImg from "../../assets/icons/grinch.png";

const FACE_CLASS = "grinch-entrance";

/** Phase durations (ms). Total ≈ 1.9s — long enough to register, short enough
 *  not to hold up a player who's already scrambling to pay him off. */
const SLAM_MS = 380;
const LEER_MS = 900;
const FLY_MS = 620;

/** How wide his face is at full size, as a share of the smaller viewport axis. */
const FACE_VMIN = 0.42;

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Is the cinematic currently on screen? */
export function grinchEntrancePlaying(): boolean {
  return document.querySelector(`.${FACE_CLASS}`) !== null;
}

/** Tear it down early (run ended, threat resolved, card removed). */
export function stopGrinchEntrance(): void {
  document.querySelectorAll(`.${FACE_CLASS}, .grinch-entrance-flash, .grinch-shock`).forEach((e) => e.remove());
  document.body.classList.remove("grinch-shake");
}

/**
 * Play the arrival, then call `onLanded` — the caller reveals the card there so
 * it appears at the exact moment his face reaches the corner.
 *
 * `targetRect` is where he should end up (the card's face). If it isn't
 * available (card not laid out yet) he simply fades out in place instead.
 */
export function playGrinchEntrance(
  layer: HTMLElement,
  targetRect: DOMRect | null,
  onLanded: () => void
): void {
  stopGrinchEntrance();

  if (reducedMotion()) {
    onLanded();
    return;
  }

  const vmin = Math.min(window.innerWidth, window.innerHeight);
  const size = vmin * FACE_VMIN;

  // Sickly green wash so the whole screen registers that something is wrong.
  const flash = document.createElement("div");
  flash.className = "grinch-entrance-flash";
  flash.addEventListener("animationend", () => flash.remove(), { once: true });
  layer.appendChild(flash);

  const face = document.createElement("img");
  face.className = FACE_CLASS;
  face.src = grinchImg;
  face.alt = "";
  face.style.width = `${size}px`;
  face.style.height = `${size}px`;
  layer.appendChild(face);

  // A ring that punches outward on impact, timed to land with the slam.
  const shock = document.createElement("div");
  shock.className = "grinch-shock";
  shock.style.width = `${size}px`;
  shock.style.height = `${size}px`;
  shock.addEventListener("animationend", () => shock.remove(), { once: true });
  layer.appendChild(shock);

  const finish = () => {
    face.remove();
    onLanded();
  };

  // ── Phase 1: slam in from far away ──
  const slam = face.animate(
    [
      { transform: "translate(-50%, -50%) scale(2.4) rotate(-12deg)", opacity: 0 },
      { transform: "translate(-50%, -50%) scale(0.92) rotate(4deg)", opacity: 1, offset: 0.72 },
      { transform: "translate(-50%, -50%) scale(1) rotate(0deg)", opacity: 1 },
    ],
    { duration: SLAM_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
  );

  slam.onfinish = () => {
    document.body.classList.add("grinch-shake");
    window.setTimeout(() => document.body.classList.remove("grinch-shake"), 320);

    // ── Phase 2: leer around, looking for something to steal ──
    const leer = face.animate(
      [
        { transform: "translate(-50%, -50%) scale(1) rotate(0deg)" },
        { transform: "translate(-58%, -52%) scale(1.04) rotate(-5deg)", offset: 0.3 },
        { transform: "translate(-42%, -48%) scale(1.02) rotate(6deg)", offset: 0.66 },
        { transform: "translate(-50%, -50%) scale(1.06) rotate(-2deg)" },
      ],
      { duration: LEER_MS, easing: "ease-in-out", fill: "forwards" }
    );

    leer.onfinish = () => {
      // ── Phase 3: shrink and dive into the corner card ──
      if (!targetRect) {
        face
          .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: "forwards" })
          .addEventListener("finish", finish, { once: true });
        return;
      }

      // He's centred via translate(-50%,-50%) at the viewport middle, so the
      // flight is the delta from there to the card face's centre.
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const tx = targetRect.left + targetRect.width / 2 - cx;
      const ty = targetRect.top + targetRect.height / 2 - cy;
      const scale = Math.max(0.05, targetRect.width / size);

      const fly = face.animate(
        [
          { transform: "translate(-50%, -50%) scale(1.06)", opacity: 1 },
          {
            transform: `translate(calc(-50% + ${tx * 0.55}px), calc(-50% + ${ty * 0.42}px)) scale(${
              (1 + scale) / 2
            }) rotate(-8deg)`,
            opacity: 1,
            offset: 0.55,
          },
          {
            transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${scale}) rotate(0deg)`,
            opacity: 0.85,
          },
        ],
        { duration: FLY_MS, easing: "cubic-bezier(0.5, 0, 0.75, 0.2)", fill: "forwards" }
      );
      fly.addEventListener("finish", finish, { once: true });
    };
  };
}
