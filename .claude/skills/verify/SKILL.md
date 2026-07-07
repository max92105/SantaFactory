---
name: verify
description: Build, launch and drive the Santa Factory clicker game to verify changes end-to-end in a real browser.
---

# Verifying Santa Factory

## Build & launch

```powershell
npm run build        # tsc (strict) + vite build — must stay clean
npm run dev          # dev server on http://localhost:5173/ (run in background)
```

Note: local Node is 20.17.0; Vite 7 prints a version warning but works fine.

## Drive it (browser GUI surface)

Use Playwright headless with the system Edge browser — no browser download needed:

```js
import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
```

Install `playwright` (npm package, ~2 packages, fast) in a scratch dir, not in the repo.

## Flows worth driving

- Boot: `#statusText` shows "Ready.", `#makeGiftBtn` visible.
- Click N times → `#hudGifts` +N; toy selector `.click-toy-btn[data-toy-type=…]` swaps the big button icon and produces that type.
- Storage tab: `.sell-quick[data-sell='max']` then `#sellBtn` → `#hudMoney` increases by stock × sell rate (plushy $3 base).
- Shop tab: `[data-producer-id='elf_worker'] button` hires (first elf $10); button disables when unaffordable.
- Factory tab: `[data-step-id='craft_plushy'] .pipeline-btn` (nth(1) = plus) assigns an elf; after ~4.5s the 🧸 Raw count in `#wipGrid` reaches ≥2 (2s per item).
- Menu (`#menuBtn`): Save → "Saved.", Load restores prior HUD values, Reset zeroes everything with "Reset complete.".
- Upgrades: shop sub-tab `.shop-tab[data-shop='upgrades']`, first row = Bigger Hammer $25 → `#clickGpc` becomes 2.

## Gotchas

- Capture `pageerror` + console errors; a `favicon.ico` 404 is pre-existing and expected (no favicon is shipped).
- Values render every animation frame; give 200–300ms after clicks before asserting.
- Game state persists in localStorage key `santa_factory_clicker_save_v1` — Reset between runs for deterministic numbers.
