/**
 * audio — UI sound effects (button click / hover) and looping background music.
 *
 * SFX play through the Web Audio API so rapid clicks overlap cheaply; the music
 * is a plain looping <audio> element (the track is large, so it streams rather
 * than decoding into memory). Browsers only allow audio to begin after a user
 * gesture, so:
 *   • the music is started from the menu's play button (a real click), and
 *   • the SFX AudioContext wakes on the first pointer interaction.
 * A mute toggle is persisted in localStorage so it survives reloads.
 */

import clickUrl from "../assets/btn_click.mp3";
import hoverUrl from "../assets/btn_hover.mp3";
import musicUrl from "../assets/Background.mp3";

const MUTE_KEY = "santa_factory_muted";
const MUSIC_VOLUME = 0.35;
const CLICK_VOLUME = 0.55;
const HOVER_VOLUME = 0.22;

/** Elements that should click/hover — plain buttons and role="button" widgets. */
const SFX_SELECTOR = "button, [role='button']";

let ctx: AudioContext | null = null;
let clickBuf: AudioBuffer | null = null;
let hoverBuf: AudioBuffer | null = null;
let music: HTMLAudioElement | null = null;
let muted = localStorage.getItem(MUTE_KEY) === "1";

// Fetch the small SFX bytes right away; decode once a context exists (below).
const clickBytes = fetch(clickUrl).then((r) => r.arrayBuffer());
const hoverBytes = fetch(hoverUrl).then((r) => r.arrayBuffer());

/** Lazily create/resume the AudioContext (must follow a user gesture). */
function wakeContext(): void {
  if (typeof AudioContext === "undefined") return;
  if (!ctx) {
    ctx = new AudioContext();
    clickBytes.then((b) => ctx!.decodeAudioData(b)).then((buf) => (clickBuf = buf)).catch(() => {});
    hoverBytes.then((b) => ctx!.decodeAudioData(b)).then((buf) => (hoverBuf = buf)).catch(() => {});
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
}

function playBuffer(buf: AudioBuffer | null, volume: number): void {
  if (muted || !ctx || !buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(ctx.destination);
  src.start();
}

/** The nearest enabled button-like element for an event, or null. */
function interactiveTarget(e: Event): HTMLElement | null {
  const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(SFX_SELECTOR) ?? null;
  if (!el) return null;
  if (el.hasAttribute("disabled") || (el as HTMLButtonElement).disabled) return null;
  return el;
}

/**
 * Attach delegated click/hover SFX to every button in the app (menu + game).
 * Call once at boot — it survives page re-renders because it lives on document.
 */
export function bindUiSounds(): void {
  document.addEventListener("pointerdown", (e) => {
    if (!interactiveTarget(e)) return;
    wakeContext();
    playBuffer(clickBuf, CLICK_VOLUME);
  });

  document.addEventListener("pointerover", (e) => {
    const el = interactiveTarget(e);
    if (!el) return;
    // Fire once per control: ignore moves that stay within the same button.
    const from = (e as PointerEvent).relatedTarget as Node | null;
    if (from && el.contains(from)) return;
    wakeContext();
    playBuffer(hoverBuf, HOVER_VOLUME);
  });
}

/** Start (or resume) the looping background music. Safe to call repeatedly. */
export function startMusic(): void {
  if (!music) {
    music = new Audio(musicUrl);
    music.loop = true;
    music.volume = MUSIC_VOLUME;
  }
  if (!muted) music.play().catch(() => {});
}

export function isMuted(): boolean {
  return muted;
}

/** Flip mute; pauses/resumes music and silences SFX. Returns the new state. */
export function toggleMute(): boolean {
  muted = !muted;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  if (music) {
    if (muted) music.pause();
    else music.play().catch(() => {});
  }
  return muted;
}
