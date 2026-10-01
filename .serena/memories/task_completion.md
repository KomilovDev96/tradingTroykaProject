# Done checklist

1. `npm test` (engine) — must stay green; add tests for any engine rule change.
2. Backend types: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`.
3. Frontend types: `cd apps/frontend && npx tsc -b --noEmit`; lint: `npm run lint --workspace=@troyka/frontend`.
4. Prisma schema change → `npm run db:migrate` (creates migration under `apps/backend/prisma/migrations`).
5. UI change → verify in preview (`frontend` launch config; backend must be running for live data).
