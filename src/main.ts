/**
 * Entry point — loads global styles, shows the main menu, and boots the chosen
 * save slot into the game. Returning to the menu comes back here.
 */

import "./ui/styles/base.css";
import { createInitialState } from "./state/GameState";
import { createSaveSystem } from "./systems/SaveSystem";
import { createGame } from "./core/Game";
import { showMainMenu } from "./ui/menu/mainMenu";
import { bindUiSounds, startMusic } from "./ui/audio";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app root element");

const save = createSaveSystem();
save.migrateLegacy(); // fold any pre-slots save into slot 1

bindUiSounds(); // button click / hover SFX across menu + game

function toMenu(): void {
  showMainMenu(root!, save, playSlot);
}

function playSlot(slot: number): void {
  startMusic(); // this click is the user gesture that lets audio begin
  const state = save.load(slot) ?? createInitialState();
  createGame({ state, slot, onExit: toMenu }).start();
}

toMenu();
