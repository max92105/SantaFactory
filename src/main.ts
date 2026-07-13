/**
 * Entry point — loads global styles, shows the main menu, and boots the chosen
 * save slot into the game. Returning to the menu comes back here.
 */

import "./ui/styles/base.css";
import { createInitialState } from "./state/GameState";
import { createSaveSystem } from "./systems/SaveSystem";
import { createGame } from "./core/Game";
import { showMainMenu } from "./ui/menu/mainMenu";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app root element");

const save = createSaveSystem();
save.migrateLegacy(); // fold any pre-slots save into slot 1

function toMenu(): void {
  showMainMenu(root!, save, playSlot);
}

function playSlot(slot: number): void {
  const state = save.load(slot) ?? createInitialState();
  createGame({ state, slot, onExit: toMenu }).start();
}

toMenu();
