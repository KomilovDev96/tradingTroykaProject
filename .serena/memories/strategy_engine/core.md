# strategy-engine

- `src/engine.ts`: `step()`, `closeActivePosition()`, `createInitialState()`; `src/types.ts`: state/output/event types + constants.
- Must stay pure: no I/O, no clocks, no React. Caller carries `StrategyEngineState` between ticks.
- Rules:
  - 3H range = rolling `currentTime-3h..currentTime` over 5M candles, recomputed every tick; upper/lower = price ± rangePoints.
  - Signal = 3 consecutive CLOSED 5M candles same direction (close vs open); doji/reversal resets. Entry = live price at confirmation tick; SL = open of 1st candle in run.
  - SL checked every tick. No streak tracking while position active (duplicate protection).
  - Trailing stop (after the hit test): profit ≥4 → SL entry±2, then +2 per further 2 points (1 point = $1) (`trailingStopLoss`, constants `TRAILING_*`), never loosens; emits STOP_LOSS_MOVED → backend `moveStopLoss` updates all OPEN rows of the signal. SL exit with pnl>0 is booked result=PROFIT.
  - First tick with `lastClosedCandleTime === null` does not replay history.
- Emits explicit `events` (SIGNAL_CONFIRMED / STOP_LOSS_MOVED / STOP_LOSS_HIT / MANUAL_CLOSE) — backend persists from these, never from state diffs.
- Engine `signalId` = `${movementStartTime}-${UP|DOWN}`; differs from DB signalId (see `mem:backend/core`).
- Tests: `tests/engine.test.ts` (vitest), consumed as TS source (`main: src/index.ts`, no build step).

## Long-term H1 Troika (`src/longTerm.ts`, tests `tests/longTerm.test.ts`) — from the PDF «The Troika Mathematical Price Action Strategy»
- `stepLongTerm` / `closeLongTermPosition` / `computeSpeedometer`. 3 closed same-colour H1 candles → entry at 4th candle OPEN; SL = troika low − 1pt (BUY) / high + 1pt (SELL) (`LONG_TERM_SL_BUFFER_POINTS`, buffer size not given in the PDF).
- Speedometer = ADR of last 8 completed, midnight-aligned daily candles; Step = ADR/3; TP1/2/3 = 1/2/3×ADR. Step1 → SL to entry (stage 1), Step2 → SL to Step1 price (stage 2), TP3 closes; TP1/TP2 only marked (no partial close).
- «Only first troika»: `blockedDirection` ignores same-colour candles until another colour closes. Single active trade: no streak tracking while a position is open.
