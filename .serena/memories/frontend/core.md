# frontend (apps/frontend)

- Feature-Sliced Design under `src/`: app → pages → widgets → features → entities → shared. Imports only downward.
- Live market data: WS (`features/market-data/model/useMarketSocket.ts`) → Zustand store `entities/market/model/store.ts`.
- DB-backed data (trades/stats): TanStack Query hooks in `entities/trade/api/queries.ts`; invalidated on WS `trades-changed`.
- `entities/strategy` re-exports engine types from `@troyka/strategy-engine`.
- UI: Ant Design 6, charts via lightweight-charts 5. Routes: dashboard / trades / analytics / settings.
- Backend URLs: `shared/api/config.ts`, overridable via `VITE_BACKEND_HTTP_URL` / `VITE_BACKEND_WS_URL`.
- Lint: oxlint (`.oxlintrc.json`).
