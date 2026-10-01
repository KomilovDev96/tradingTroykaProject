# Commands (run from repo root)

- `npm install`
- `npm run db:up` / `npm run db:down` — Postgres via docker compose (port 5433)
- `npm run db:migrate` — prisma migrate dev; `npm run db:studio`
- `npm run dev:backend` — http://localhost:4000 (WS `/ws`)
- `npm run dev:frontend` — http://localhost:5173 (also `.claude/launch.json` config "frontend")
- `npm test` — engine vitest suite only
- Type-check: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`; `cd apps/frontend && npx tsc -b`
- Lint frontend: `npm run lint --workspace=@troyka/frontend`
- Darwin: BSD `sed -i ''` (not GNU `sed -i`).
