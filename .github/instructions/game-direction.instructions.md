---
description: "Use when implementing features, systems, or mechanics for the Santa Factory Clicker game. Covers production pipeline, workforce management, wage system, and overall game design direction."
applyTo: "src/**"
---
# Game Direction Reference

Always consult [GAME_DIRECTION.md](../../src/GAME_DIRECTION.md) before implementing or modifying game features.

## Core Design Pillars

- **Elf Manager Fantasy**: Player runs Santa's production network, not Santa himself
- **Christmas Deadline**: The run ends on Day 365 (Christmas Day)
- **Workforce Management**: Elves must be hired, paid wages, and assigned to machines/steps

## Key Systems to Respect

1. **Production Pipeline**: Multi-step process (Toy Creation → Assembly → Packaging → Final Gift)
2. **Workforce Assignment**: Elves are assigned to specific machines or production steps
3. **Daily Wage Phase**: End-of-day payroll with consequences for inability to pay (Debt, Cut Benefits, or Layoffs)

## When Adding Features

- Check if the feature aligns with the management/optimization gameplay loop
- Consider how it affects workforce allocation decisions
- Ensure it respects the daily cycle and Christmas deadline
