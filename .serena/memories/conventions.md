# Conventions

- Comments cite spec sections ("section 29", "§46") explaining WHY; keep that habit when touching spec-driven logic.
- Pure logic (engine, `computeStats`) kept free of I/O so it is unit-testable; I/O lives in repositories/runner/server.
- Repositories return plain `TradeDTO` (numbers, ms timestamps), never raw Prisma models, to callers/HTTP.
- 2-space indent, single quotes, trailing commas, long lines (~130) OK.
- Frontend: FSD slice layout `<layer>/<slice>/{model,api,ui}`; widgets are PascalCase component files.
- UI text in Russian; code/identifiers in English.
