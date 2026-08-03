# Balance baseline

A quick reference for the progression math so tuning stays intentional. Every
number here lives in `src/config/*` — this doc just explains how they combine.

## Time

- `SECONDS_PER_GAME_DAY = 300` (5 real minutes per in-game day)
- `SEASON_DAYS = 365` → a full run is ~30 real hours (a "season" to Christmas).
- A **shift slot** is ¼ of a day = **75 s** real time. An elf covering 2 slots
  works **half the day**; a Coked elf (3 slots) works ¾.

> Testing tip: temporarily drop `SECONDS_PER_GAME_DAY` (e.g. to 60) to watch
> several days / order deadlines / wages roll by quickly.

## Toys (the value ladder)

| Toy | Sell $ | Unlock $ | Craft s | $/craft-s |
|-----|-------:|---------:|--------:|----------:|
| 🧸 Plushy | 3 | 0 | 2 | 1.5 |
| 🟩 Rubik's Cube | 8 | 150 | 5 | 1.6 |
| 🚂 Wooden Train | 18 | 750 | 8 | 2.25 |
| 🤖 Tin Robot | 42 | 4000 | 12 | 3.5 |

Each toy is ~2.3× the value of the previous and unlocks for ~5× more. Higher
toys craft slower but pay **more per craft-second**, so unlocking is a real
upgrade, not just variety.

## Production chain (why one elf isn't enough)

Finished toys need **three** steps: `craft (per toy)` → `assembly (3 s, shared)`
→ `packaging (2 s, shared)`. Clicking makes a **finished** toy directly (the
bootstrap); the pipeline is how you scale.

- One elf on a step makes **1 item / baseTime**, but only **during its shift
  slots**. So per elf, per line, expect ~**½ throughput** vs "always on".
- The line's finished rate = the **slowest staffed step** (a bottleneck), and it
  stalls if an upstream stage is empty (shown as **"No input"**).
- **Mistakes compound across the 3 steps.** With Worker elves (8% each) yield ≈
  `0.92³ ≈ 0.78`. With Drunken (40%) yield ≈ `0.6³ ≈ 0.22` — cheap elves waste
  most of the chain, so quality matters more than headcount for multi-step toys.

**Worked example — one all-Worker plushy line, 1 elf/step, all on the same 2
slots:** bottleneck is assembly (3 s) → ~0.33/s during 150 s/day ≈ 50 started,
×0.78 yield ≈ **~39 finished plushies/day** → **~$117/day** selling. Wages: 3
Workers × $3 = **$9/day**. Net ≈ **$108/day** from one modest line.

## Elves (config/elfTypesConfig.ts)

| Elf | Cost | Growth | Wage/day | Ruins | Breaks | Shifts | Nights |
|-----|-----:|-------:|---------:|------:|-------:|:------:|:------:|
| 🍺 Drunken | 8 | 1.12 | 1 | 40% | 0.6% | 2 | ✗ |
| 🤪 Clumsy | 14 | 1.13 | 1.5 | 25% | 0.4% | 2 | ✓ |
| ❄️ Coked | 45 | 1.16 | 4 | 12% | 0.3% | 3 | ✓ |
| 🧝 Worker | 30 | 1.15 | 3 | 8% | 0.15% | 2 | ✓ |
| 🎖️ Veteran | 150 | 1.18 | 9 | 1.5% | 0.03% | 2 | ✓ |

- Cost of the *next* elf of a type = `baseCost × growth^(currently owned)`, so
  losing elves (missed payroll) makes rehiring that type cheaper again.
- **Wages** are charged at end of day (sum of every elf's wage). Can't pay →
  one elf of each type quits.
- Trade-off: Drunken flood cheap labour but ruin lots + never work nights;
  Coked cover a 3rd shift; Veterans are pricey but near-flawless.

## Storage (config/storageConfig.ts)

The warehouse holds **250 items** to start. Every physical item counts: all
production stages (`wip1`/`wip2`/`raw`/`assembled`/`finished`) **plus the broken
pile** — not just sellable gifts. Counting WIP is what stops the obvious dodge
of parking a huge pile at `assembled` and burst-converting it on demand.

When it's full, **craft steps and the click button halt**. Everything downstream
(specialist stations, Quality Control, Packaging) takes one item and returns one,
so it's space-neutral and keeps draining — the factory jams from the front while
your elves still draw a full day's wages.

**Warehouse Expansions** are 16 generated upgrade tiers, each **doubling** total
capacity (250 → ~16.4M) for a price that grows **×3.8**:

| Tier | Capacity | Cost |
|-----:|---------:|-----:|
| — | 250 | — |
| 1 | 500 | $350 |
| 2 | 1,000 | $1,330 |
| 4 | 4,000 | $19,200 |
| 8 | 64,000 | $4.00M |
| 12 | 1.02M | $835M |
| 16 | 16.4M | $174B |

Price ramps faster than space on purpose: shelf room stays a real purchase
competing with toys and elves. Only the next unbought tier is listed in the shop.

Consequences worth knowing:

- **Orders stop being trivial.** You can't sit on a bottomless pile and fill any
  order instantly; you produce *into* a deadline, and multi-toy orders compete
  for the same shelves.
- **The Grinch bites again.** His toy ransom (`0.35` days of production) and his
  30–50% steal are measured against a bounded buffer, not an infinite hoard.
- **Broken items cost space,** so salvage and the Repair Workshop's menders
  finally earn their price — a clumsy crew now clogs the warehouse as well as
  wasting yield.
- **Old saves** need no migration (capacity is derived from owned upgrades), but
  a save with a big stockpile will load already over the cap and stay jammed
  until it sells down. That's the intended new pressure, not a bug.

## Money sinks & sources

- **Sources:** selling finished toys (`sell = value × sellRate upgrades`), and
  **orders** (pay `qty × value × payMult × eventMult`, i.e. **1.3–2.4×** selling).
- **Sinks:** hiring (escalating), daily wages, toy unlocks, station repairs ($40),
  upgrades ($25 → $400), warehouse expansions ($350 → $174B).

## Orders (config/ordersConfig.ts)

4 offers/day (+event extras), max 6 active. Only unlocked toys. Reward scales
with complexity via `payMult`:

| Template | Qty | Deadline | payMult |
|----------|----:|---------:|--------:|
| Small | 5–15 | 2–3 d | 1.3 |
| Standard | 20–45 | 3–5 d | 1.5 |
| Bulk | 70–150 | 5–7 d | 1.8 |
| Rush | 25–50 | 1 d | 2.4 |

## Events (config/eventsConfig.ts)

Calendar windows that boost order pay + add offers (Valentine's ×1.4, Black
Friday ×1.6, Christmas Rush ×1.8), some with a **featured toy** in higher demand.

## Known friction / things to watch

1. **The 3-step pipeline is non-obvious** — a lone elf on Craft piles up raw with
   no money. A first-time hint ("staff all three steps") would help.
2. **Shift uptime halves per-elf output** — intended (you cover more slots by
   assigning more elves), but it makes early automation feel slow.
3. **Run length (~30 h)** is long for a clicker; fine as a season, but consider a
   shorter `SEASON_DAYS` or faster days if you want tighter sessions.
4. **Broken toys** can be salvaged for `BROKEN_SALVAGE_RATE` of value or mended
   back to finished by the Repair Crew — and they occupy warehouse shelves until
   you do one or the other, so ignoring the pile now costs you production.
5. **Storage tier pricing is the least-tested curve here.** The capacity ramp is
   anchored to the Christmas Order's ~24.6M gifts/day pace; the *cost* ramp
   (×3.8) is a first guess at late-game wealth. If expansions feel like a tax
   rather than a choice, lower `STORAGE_TIER_COST_GROWTH` first.
