# Тройка — real-time scalping strategy dashboard

_yangi troyka strategiyasi boyicha loyiha_

Real-time market dashboard implementing the **«Тройка»** scalping strategy exactly as specified: a
rolling 3-hour demand range, price levels derived from it, and a 15-minute continuous-movement
rule that confirms BUY/SELL signals. The app is analysis-only — **it never places a real order**.
The user opens/closes their own position; the app just tracks entry, stop loss and P&L for the
virtual/analytical trade.

## Status

- ✅ **Phase 1 — real-time engine + dashboard**: `strategyEngine` (pure, framework-free, 23 unit
  tests), a live market-data backend, live dashboard (price, 5M chart, 3H range, signal panel, manual close).
- ✅ **Phase 2 — trade journal & analytics**: PostgreSQL + Prisma, every confirmed signal persisted
  as a `Trade`, Open Trades / Trade History / Daily & Weekly statistics / BUY vs SELL breakdown /
  Stop Loss stats / P&L curve / CSV export / restart-safe open positions. Sections 27–50 of the spec.

Both phases are covered below; [§7](#7-trade-journal--statistics-phase-2) documents Phase 2 specifically.

## 1. Market data source — research and decision

The spec requires **real real-time data — no mocks, no hidden delay**. The instrument is
**Gold (XAU/USD)**, which ruled out most "free real-time" advertising:

| Source | Real-time? | WebSocket/stream? | XAU/USD? | Free tier reality |
|---|---|---|---|---|
| **Deriv public API** (chosen) | **Yes** — verified live during development, ticks arriving ~0.2–0.3s after their own timestamp | Genuine `wss://` WebSocket, public, no auth | `frxXAUUSD` — confirmed via `active_symbols` as real Gold/USD, not a synthetic index | **No API key, no account, no signup at all.** Documented soft limits (~220 req/min for non-tick calls); the persistent tick subscription isn't a polled "request". |
| OANDA fxTrade Practice | Yes — live broker pricing | HTTP chunked streaming, not literally `wss://` | Yes, native instrument | Needs a real account signup + personal access token before anything works — a hard blocker to just running the app. |
| Twelve Data (free Basic) | No — forex/metals mid-price on WS is throttled to ~1 update/min | WebSocket exists but is "trial" on the free plan | Yes | Not real-time enough for a 1-minute movement rule. |
| Finnhub (free) | N/A | WS is paid-tier | Gold/forex barely covered on free plan | Rejected — no real gold coverage. |
| GoldAPI.io / goldprice.dev / XAUS | No — aggregated spot quote polled every 15–60s | REST polling only, no OHLCV | Yes (spot only) | No candle history, can't build a real 5M chart from it. |
| Commodities-API / CommodityPriceAPI | No | REST only | Yes | Explicitly documents delayed data on free/lite plans. |

**Decision: Deriv's public market-data WebSocket** (`wss://api.derivws.com/trading/v1/options/ws/public`,
symbol `frxXAUUSD`, [docs](https://developers.deriv.com/docs/options/ws-public/)). It's an
unauthenticated, public endpoint — no signup, no key, nothing to configure. It gives:

- `{ ticks: "frxXAUUSD", subscribe: 1 }` — a live tick subscription over a real WebSocket; every
  message is pushed the instant Deriv publishes a new quote (verified: ~0.2–0.3s old on arrival).
- `{ ticks_history: "frxXAUUSD", style: "candles", granularity: 300 }` — real 5-minute OHLC history.
- OANDA was implemented first and worked (a real practice-account token streamed real prices), but
  was replaced for exactly one reason: it requires a real account and a personal access token
  before it does anything, which is a hard blocker to running the app at all without external
  setup. Deriv's public feed needed zero setup and was verified working end-to-end (live ticks
  flowing into the engine, a real BUY movement building in real time) during development. The
  market-data layer is isolated behind a small `fetchCandles`/`streamPrices` interface
  ([`marketdata/derivClient.ts`](apps/backend/src/marketdata/derivClient.ts)), so swapping in OANDA
  or another provider later — e.g. if you want an account-tied instrument, or Deriv's quote
  diverges from your broker — only touches that one module.

**Why a backend is still used**: Deriv's feed itself needs no secret, but the trade journal does
need one process to own the single server-side `strategyEngine` instance (so open positions
survive a frontend reload — and, via Postgres, a backend restart) and to talk to the database.
`apps/backend` runs that engine, persists trades, and relays ticks/engine output to the frontend
over its own WebSocket (`ws://.../ws`).

**Documented limitations**: Deriv publishes ticks as it sees them — this is "every tick this feed
emits", not a guarantee that it mirrors every tick every liquidity provider or broker sees. There's
no published SLA on this public endpoint, and Deriv can change availability/limits without notice.
For a personal scalping-strategy dashboard this is an acceptable, clearly-documented trade-off for
getting genuinely real-time, zero-setup data; it would not be an appropriate foundation for a
funded trading operation without also validating against your actual broker's feed.

## 2. Architecture

```
apps/
  backend/          Node + Express + ws + Prisma. Runs the ONE server-side strategyEngine
                     instance, persists confirmed signals, streams updates.
    prisma/schema.prisma  User / TradingSession / Trade — see §7
    src/
      env.ts             env var loading
      marketdata/derivClient.ts  Deriv public WS client: candle history + live tick stream, UTC time parsing
      marketdata/candleStore.ts  rolling 5M OHLCV: Deriv candle history + live tick aggregation
      db/                 Prisma repositories: user, trading session, trade (create/close/list/filter)
      stats/computeStats.ts  pure aggregation functions over Trade rows (summary, by-direction,
                          by-day, stop-loss, P&L curve) — no I/O, unit-testable like the engine
      engine/runner.ts    owns engine state across ticks, persists Trade rows on engine events,
                          restores an open position from Postgres on boot (§7.4)
      server.ts / index.ts  Express REST + WebSocket wiring, bootstrap

  frontend/         Vite + React + TypeScript, Ant Design, Zustand, TanStack Query, react-router.
    src/  (Feature-Sliced Design)
      app/                    App shell, router, top navigation (Dashboard/Trades/Analytics/Settings)
      entities/market          live engine-output/candle types + the Zustand store (WS-fed)
      entities/strategy        re-exported strategyEngine types shared with the backend
      entities/trade           Trade/stats DTOs + TanStack Query hooks (DB-backed, not WS-fed)
      features/market-data      WebSocket connection hook (also invalidates trade/stats queries)
      features/close-position   "Закрыть анализ" mutation (never sends a real order)
      features/export-trades    Trade History → CSV download
      widgets/                MarketHeader, TradingChart, StrategyPanel, SignalPanel, OpenTrades,
                              TradeHistoryTable, stats cards, day-of-week table, P&L curve
      pages/                  dashboard, trades, analytics, settings

packages/
  strategy-engine/  Pure TypeScript, zero dependencies, zero React. `step(state, input)` is a
                     pure function: same inputs always produce the same outputs. This is what
                     sections 15 and 23 of the spec ask for, and it's unit-tested in isolation.
```

Data flow on every tick: Deriv stream → backend normalizes to UTC → `CandleStore` updates the
live 5M candle → `strategyEngine.step()` recomputes the 3H range/levels, advances 15-minute
movement tracking, and (if applicable) confirms a signal or hits a stop loss → the backend
broadcasts `{ output, candles }` over WebSocket → the frontend's Zustand store updates → every
widget re-renders. No page reload, ever.

## 3. How `strategyEngine` works

`packages/strategy-engine/src/engine.ts` — a pure module, testable with plain unit tests, with
no knowledge of React, HTTP, or the market-data provider.

- **3H range** (`computeRangeAndLevels`): `rangeStart = currentTime - 3h`, `rangeEnd = currentTime`,
  recalculated on *every* tick — a true rolling window, not fixed clock blocks. `highDemand` /
  `lowDemand` are the max high / min low of all 5M candles inside that window. `rangePoints =
  highDemand - lowDemand`; `upperLevel = currentPrice + rangePoints`; `lowerLevel = currentPrice -
  rangePoints` — exactly the spec's worked example (4669/4674/4638 → 36 → 4705/4633 → 72), which is
  pinned as a unit test.
- **3-candle entry rule** (`step`): evaluated on **closed 5-minute candles**, not raw ticks or
  minutes. A candle's own direction is `close > open` = up, `close < open` = down (standard
  candlestick coloring). 3 **consecutive** closed candles in the same direction = 15 minutes of
  continuous movement, and the signal fires the instant the 3rd candle closes — no extra waiting
  tick. Any reversal (or a flat/doji candle) before the 3rd resets the streak. `BUY_READY`/
  `SELL_READY` means 2 of 3 candles are in. **Stop Loss = the OPEN price of the 1st candle in the
  3-candle run** (never a percentage or ATR); **Entry = the live price at the instant of
  confirmation**. This is pinned by dedicated unit tests, including the "does NOT signal after 1
  or 2 candles" cases and a reversal-on-the-3rd-candle case.
- **Stop Loss** is checked on *every* tick (not just per-minute), per section 29.
- **Duplicate-signal protection** (section 21/47): while a position from a movement is active, no
  new movement is tracked at all — structurally impossible to double-signal the same leg. A new
  signal is only possible after `STOP_LOSS_HIT` or a manual close resets the engine.
- Every state transition (`SIGNAL_CONFIRMED`, `STOP_LOSS_HIT`, `MANUAL_CLOSE`) is emitted as an
  explicit `event`, ready for Phase 2 to persist as `Trade` rows without re-deriving them from
  diffed state.

## 4. Setup

### Prerequisites
- Node.js 20+, Docker (for the local Postgres — see `docker-compose.yml`)
- That's it — the market data source (Deriv's public API) needs no signup, no key, no account.

### Install
```bash
npm install
```

### Start Postgres and run migrations
```bash
npm run db:up        # docker compose up -d — Postgres on localhost:5433
npm run db:migrate    # prisma migrate dev — creates User/TradingSession/Trade tables
```

### Configure the backend
```bash
cp apps/backend/.env.example apps/backend/.env
# defaults already work: no credentials to fill in, DATABASE_URL matches db:up
```

### Run
```bash
npm run dev:backend    # http://localhost:4000, streams Deriv + runs the engine + persists trades
npm run dev:frontend   # http://localhost:5173, the dashboard (Dashboard/Trades/Analytics/Settings)
```

### Test the engine
```bash
npm test
```
Covers: 3H range math, HIGH/LOW/range/upper/lower (including the exact spec example), 15-minute
up/down detection, BUY/SELL confirmation, Stop Loss for both directions, rolling-window rollover,
duplicate-signal protection, manual close, and pause/resume — 23 tests, all green.

`apps/backend/src/stats/computeStats.ts` is likewise a pure module (trades in, aggregates out) —
it and the DB read/write path were exercised with a scripted integration run (Express + WebSocket +
Prisma, a simulated 16-minute BUY confirming, persisting, and being stopped out) during development;
that script was a throwaway check, not a committed test suite.

## 5. Environment variables

`apps/backend/.env` (see `.env.example`):

| Variable | Meaning |
|---|---|
| `INSTRUMENT` | Deriv symbol notation, e.g. `frxXAUUSD` (Gold/USD). No API key required. |
| `PORT` | Backend HTTP/WS port (default 4000). |
| `FRONTEND_ORIGIN` | Primary CORS origin for the dashboard (default `http://localhost:5173`); any `http://localhost:<port>` is also accepted, since Vite falls back to a random port when 5173 is taken. |
| `DATABASE_URL` | Postgres connection string. Default matches `docker-compose.yml` (port 5433, to avoid clashing with any Postgres you already run on 5432). |

`apps/frontend/.env` (optional, see `.env.example`): `VITE_BACKEND_HTTP_URL`, `VITE_BACKEND_WS_URL`.

## 6. Timezone

All engine timestamps are UTC ms-epoch. The dashboard's timezone selector (top right, and on
Settings) lets you pick any display timezone; it defaults to your browser's detected timezone.
Statistics periods (Today/This Week/...) are computed as day/week boundaries **in that timezone**,
and the Statistics-by-Day table groups by weekday in that same timezone.

## 7. Trade Journal & Statistics (Phase 2)

### 7.1 Data model (`apps/backend/prisma/schema.prisma`)

- **`User`** — this app has no login flow (never asked for in the spec); the backend upserts one
  default row on first boot and every trade belongs to it. Present because §39 lists it as a
  minimum entity, sized for what's actually needed today.
- **`TradingSession`** — the 3H demand range is a continuously-rolling window (recalculated every
  tick, §2/§17), so there's no natural fixed "session boundary" to key off. Instead, the exact
  range/levels in effect are frozen into a new `TradingSession` row **at the moment a signal is
  confirmed** (§42), and the `Trade` links to it — so history stays legible even as the live window
  keeps moving.
- **`Trade`** — one row per confirmed signal (§27), created directly from the engine's
  `SIGNAL_CONFIRMED` event. Price fields are `Decimal` (§40), not floating point.

### 7.2 Duplicate protection (§47)

`Trade.signalId` (`strategy|symbol|movementStartTime|direction`) has a DB unique constraint.
`createTradeFromSignal` catches the unique-violation and returns the existing row instead of
erroring — so a WebSocket reconnect or a duplicate tick can never create a second trade for the
same movement. This is enforced at the database level, on top of the engine's own in-memory guard
(§21: no new movement is tracked at all while a position is active).

### 7.3 Result classification — a spec ambiguity, resolved explicitly

§30 says a manual close is booked as `MANUAL_CLOSE`. But §31's own example table shows a
manually-exited winning trade labeled `PROFIT`, and §32 counts `Profit` / `Stop Loss` /
`Manual Close` as three mutually-exclusive buckets that must sum to total trades. Taking both
literally: a **stop-loss exit is always `STOP_LOSS`**; a **manual close is `PROFIT` if it closed
with positive P&L, otherwise `MANUAL_CLOSE`**. This is implemented in
[`closeTradeManually`](apps/backend/src/db/tradeRepository.ts). Flag it if your intent was
different — it's a one-line change.

### 7.4 Restart safety (§46)

On boot, `index.ts` queries Postgres for an open trade on the configured instrument. If one
exists, `EngineRunner.hydrateFromOpenTrade` rebuilds the engine's in-memory `activePosition`
directly from that row — so Stop Loss monitoring resumes immediately after a backend restart,
without needing to replay the original 15-minute movement. Postgres is the source of truth;
Zustand/browser state is not.

### 7.5 Statistics are computed live, not cached (§49)

`apps/backend/src/stats/computeStats.ts` aggregates whatever `Trade` rows match a query, on every
request. There is no `DailyStatistics`/`StrategyStatistics` cache table — §39 explicitly says one
is optional ("если это действительно улучшает производительность") and that trades must stay the
source of truth regardless. At realistic scalping volumes (tens to low hundreds of trades/day) a
live aggregation over an indexed table is not a performance problem, and skipping the cache avoids
an entire class of "stats drifted from trades" bugs.

### 7.6 REST API

| Endpoint | Purpose |
|---|---|
| `GET /api/trades/open` | Open trades (§28) — never included in stats until closed (§45). |
| `GET /api/trades?from&to&symbol&direction&result&status&strategy` | Trade History with filters (§31). |
| `GET /api/trades/export.csv?...same filters` | CSV export (§44). |
| `GET /api/stats/summary?from&to` | Daily/Weekly summary (§32/§33): trades, profit, stop loss, manual close, win rate, profit/loss points, net. |
| `GET /api/stats/by-direction?from&to` | BUY vs SELL breakdown (§37). |
| `GET /api/stats/by-day?from&to&timezone` | Per-weekday table (§34). |
| `GET /api/stats/stoploss?from&to` | Stop Loss stats: total/BUY/SELL/avg/max (§38). |
| `GET /api/stats/pnl-curve` | Cumulative P&L over all closed trades (§36). |
| `POST /api/close-position` | Manual close (§30) — closes the DB trade too. |
| `POST /api/analysis/pause` · `POST /api/analysis/resume` | «Остановить / Продолжить анализ»: while paused no new movement is tracked (candles closing meanwhile are never replayed), but an open position's Stop Loss is still monitored. Stored as `User.analysisPaused`, so it survives backend restarts. |

The WebSocket also emits `{ type: 'trades-changed' }` whenever the engine confirms/closes a trade,
which the frontend uses to invalidate its trade/stat queries — no manual refresh needed (§41).
