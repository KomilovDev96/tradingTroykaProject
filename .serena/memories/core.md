# Тройка — core

npm-workspaces monorepo: real-time XAU/USD scalping-strategy dashboard. Analysis-only — NEVER places real orders.
Detailed spec-to-code mapping lives in README.md (sections numbered like "§27" refer to the product spec, not in repo).

## Source map
- `packages/strategy-engine` — pure TS `step(state, input)` engine, zero deps. Details: `mem:strategy_engine/core`.
- `apps/backend` — Express + ws + Prisma/Postgres; owns the single engine instance, Deriv feed, trade journal. Details: `mem:backend/core`.
- `apps/frontend` — Vite + React 19, Feature-Sliced Design. Details: `mem:frontend/core`.

## Invariants
- All timestamps are UTC ms-epoch end-to-end; timezone only applied at display/stats-grouping time.
- Exactly one server-side engine instance per instrument; frontend never runs the engine.
- Postgres `Trade` rows are source of truth for positions/stats (no stats cache table).

Stack: `mem:tech_stack`. Commands: `mem:suggested_commands`. Style: `mem:conventions`. Done-checklist: `mem:task_completion`.
