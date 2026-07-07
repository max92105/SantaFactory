/**
 * Entry point — loads global styles and boots the game.
 * Everything else is wired in core/Game.ts.
 */

import "./ui/styles/base.css";
import { createGame } from "./core/Game";

createGame().start();
