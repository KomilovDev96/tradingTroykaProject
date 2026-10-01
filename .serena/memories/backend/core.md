# backend (apps/backend)

- `src/index.ts` bootstrap: default user upsert → Deriv 5M history (200) → hydrate open trade from DB → HTTP/WS server → 4-min candle reconcile → tick stream.
- `src/engine/runner.ts` `EngineRunner`: wraps engine, persists events via repositories. `tick()` is async and invoked fire-and-forget per tick (`void runner.tick(...)`) — ticks can interleave across DB awaits.
- `src/marketdata/derivClient.ts`: Deriv public WS (`frxXAUUSD`, no auth); `fetchCandles` opens a one-off connection per call; `streamPrices` reconnects + 20s ping. Only module to swap for another provider.
- `src/marketdata/candleStore.ts`: closed candles from Deriv history (authoritative), live candle built from ticks; capped at 500.
- `src/db/*Repository.ts`: Prisma access. DB `signalId` = `strategy|symbol|movementStartTime|direction`, unique → idempotent create (catches P2002).
- Manual close result: pnl>0 → PROFIT, else MANUAL_CLOSE; SL exit always STOP_LOSS.
- `src/stats/computeStats.ts`: pure aggregations over TradeDTO[].
- `src/server.ts`: REST under `/api/*`, WS at `/ws` (`snapshot`, `update`, `trades-changed` messages). CORS allows any localhost port.
- Prices stored as Prisma `Decimal`, converted to number in DTOs.
- Env: `apps/backend/.env` (INSTRUMENT, PORT=4000, FRONTEND_ORIGIN, DATABASE_URL → Postgres on 5433 via docker-compose).
