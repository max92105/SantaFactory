import { defineConfig } from "vite";

/**
 * On GitHub Pages the app is served from https://max92105.github.io/SantaFactory/,
 * so production asset URLs need the "/SantaFactory/" base. The dev server keeps
 * serving from "/". (If you rename the repo, update the base string.)
 */
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/SantaFactory/" : "/",
}));
