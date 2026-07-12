# 🎅 Santa Factory — Elf Manager

An incremental/management game: you run Santa's production network and must
produce enough gifts before Christmas (Day 365). Hire elves, assign them to
pipeline steps, manage cashflow against daily wages, and sell toys to grow.

Design vision: [docs/GAME_DIRECTION.md](docs/GAME_DIRECTION.md)
Code structure: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Run it

```bash
npm install
npm run dev       # dev server at http://localhost:5173/
npm run build     # type-check + production build to dist/
npm run preview   # serve the production build
```

Plain TypeScript + Vite. No framework, no runtime dependencies.

## Where to tweak the game

Every tuning knob lives in [`src/config/`](src/config/) — one file per
mechanic (toys, pipeline steps, hiring costs, upgrades, wages, day length).
Change a number there and the whole game picks it up.

test