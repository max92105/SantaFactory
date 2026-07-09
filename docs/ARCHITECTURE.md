# Architecture

How the code is organized and how to extend it. The guiding rules:

1. **Config is data, systems are logic, pages are DOM.** Never mix them.
2. **Names match across layers**: the Upgrades tab (internal id "shop") is `shopPage.html` + `shopPage.css` + `shopPage.ts`, powered by `ShopSystem.ts`, tuned by `toyTypesConfig.ts`/`producersConfig.ts`/`upgradesConfig.ts`.
3. **Shared formulas live in `helpers/`** — a calculation is written once and imported everywhere.

## Folder map

```
index.html                     Thin shell: just <div id="app"> + the script tag
src/
├─ main.ts                     Entry point: loads base.css, boots the game
├─ config/                     ⭐ ALL game tuning knobs (data only, no logic)
│  ├─ timeConfig.ts            Season length, real seconds per game day
│  ├─ productionConfig.ts      Base gifts per click
│  ├─ toyTypesConfig.ts        Toy catalog (names, icons, sell values, unlock costs)
│  ├─ pipelineConfig.ts        Pipeline steps + stage labels/icons
│  ├─ producersConfig.ts       Hire packages (cost, elves)
│  ├─ upgradesConfig.ts        Upgrades (cost, effect, description)
│  ├─ wagesConfig.ts           Per-elf daily wage + what happens when payroll fails
│  ├─ saveConfig.ts            localStorage save key
│  └─ unlockRules.ts           Shared unlock-rule type (not evaluated yet)
├─ core/
│  ├─ Game.ts                  Composition root: wires systems + pages + loop
│  ├─ GameLoop.ts              requestAnimationFrame ticker (dt capped at 0.25s)
│  └─ GameContext.ts           Shared types: Systems, FrameViews, GameContext
├─ state/
│  └─ GameState.ts             The one mutable state object + createInitialState
├─ systems/                    Pure game logic — no DOM access allowed
│  ├─ TimeSystem.ts            Day/season progression
│  ├─ ProductionSystem.ts      Hand-crafting (clicks)
│  ├─ PipelineSystem.ts        Automatic multi-step production
│  ├─ EconomySystem.ts         Selling + sell rates
│  ├─ WageSystem.ts            End-of-day payroll + penalties
│  ├─ ModifierSystem.ts        Folds owned upgrades into multipliers
│  ├─ ShopSystem.ts            Purchase logic (toy unlocks, hires, upgrades)
│  ├─ SaveSystem.ts            localStorage save/load/clear + migrations
│  └─ DailySummarySystem.ts    End-of-day recap (built, not wired in yet)
├─ helpers/                    Shared calculations & formatting (one source each)
│  ├─ inventoryHelpers.ts      Stage counts, add/remove, sellable stock
│  ├─ costHelpers.ts           Producer price formula (scales with CURRENT elves)
│  ├─ unlockHelpers.ts         Which toy lines are unlocked
│  ├─ formatHelpers.ts         formatInt / formatMoney / formatMoneyPrecise / formatCost
│  ├─ mathHelpers.ts           clamp01
│  └─ textHelpers.ts           Pluralization ("1 elf" / "2 elves")
└─ ui/
   ├─ domRegistry.ts           Typed refs to every element (fails loudly if missing)
   ├─ styles/base.css          Reset, design tokens (colors/spacing), shared .panel
   ├─ layout/                  App shell around the pages
   │  └─ appLayout.html/.css/.ts   Header (menu/HUD/time), tab nav, footer
   ├─ components/
   │  └─ floatingText.ts/.css  "+N" and "+$X" popups
   └─ pages/                   ⭐ One folder per tab, matching file names
      ├─ Page.ts               The interface every page implements
      ├─ click/clickPage.html/.css/.ts
      ├─ factory/factoryPage.html/.css/.ts
      ├─ shop/shopPage.html/.css/.ts
      ├─ storage/storagePage.html/.css/.ts
      └─ metrics/metricsPage.html/.css/.ts
```

## How it runs

- **Boot** (`core/Game.ts`): mount `appLayout.html` into `#app`, mount each
  page's html into `#tabContent`, collect DOM refs, create systems, bind
  handlers, start the loop.
- **Every frame**: systems update state → `renderFrame()` refreshes displayed
  values (cheap text/width updates) on the layout + all pages.
- **Every user action**: a page handler calls a system (which mutates state),
  then `ctx.rebuildUI()` — rebuilds all dynamic lists (shop rows, selectors,
  pipeline controls) and re-renders values.

Pages implement the `Page` interface (`ui/pages/Page.ts`):
`mount` (inject html once) → `bind` (wire static handlers once) →
`rebuild` (recreate dynamic lists on actions) → `renderFrame` (per-frame values).

HTML fragments are imported with Vite's `?raw` suffix; each page's `.ts`
imports its own `.css`, so adding a page never touches a global stylesheet.

## How to add things

**A new toy type** — add one entry in `toyTypesConfig.ts` (`unlockCost: 0` for
a starter toy, or a price to sell it in the New Toys section), plus its
crafting step in `pipelineConfig.ts`. Inventory, selectors, selling, HUD and
the New Toys shop section all pick it up automatically; locked toys stay
hidden everywhere until bought.

**A new upgrade** — add an entry in `upgradesConfig.ts`. If it needs a new
effect type, extend `UpgradeEffect` there and follow the compiler errors
(ModifierSystem's switch and `describeUpgradeEffect` are exhaustive).

**A new pipeline step** — add an entry in `pipelineConfig.ts` with the
input/output stages; the factory page and pipeline system handle the rest.

**A new mechanic** — create `config/<name>Config.ts` (tuning) +
`systems/<Name>System.ts` (logic), register it in `core/GameContext.ts`
(`Systems` type) and `core/Game.ts` (creation + update call in the loop).

**A new tab/page** — create `ui/pages/<name>/<name>Page.html/.css/.ts`
implementing `Page`, add it to the `pages` array in `core/Game.ts`, add a
tab button in `ui/layout/appLayout.html`, and the panel toggle in
`appLayout.ts` + `domRegistry.ts`.

## Save compatibility

Saves live in localStorage under the key in `saveConfig.ts`. The state shape
in `state/GameState.ts` is what gets serialized — `SaveSystem.load()` merges
saves over a fresh state, so *adding* fields is safe; renaming/removing
fields needs a migration there.
