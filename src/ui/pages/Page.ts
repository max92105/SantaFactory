/**
 * Page — the contract every tab page implements.
 * Each page lives in its own folder with matching files:
 *   ui/pages/<name>/<name>Page.html  (markup)
 *   ui/pages/<name>/<name>Page.css   (styles)
 *   ui/pages/<name>/<name>Page.ts    (logic)
 */

import type { FrameViews, GameContext } from "../../core/GameContext";

export type Page = {
  /** Inject this page's markup into the tab content container. Called once at boot. */
  mount(container: HTMLElement): void;

  /** Wire event handlers on static elements. Called once, after all pages are mounted. */
  bind(ctx: GameContext): void;

  /** Rebuild dynamic buttons/lists. Called after every user action (via ctx.rebuildUI). */
  rebuild(ctx: GameContext): void;

  /** Update displayed values. Called every frame — keep it cheap. */
  renderFrame(ctx: GameContext, views: FrameViews): void;
};
