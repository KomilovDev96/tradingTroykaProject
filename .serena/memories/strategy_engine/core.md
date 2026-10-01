# strategy-engine

- `src/engine.ts`: `step()`, `closeActivePosition()`, `createInitialState()`; `src/types.ts`: state/output/event types + constants.
- Must stay pure: no I/O, no clocks, no React. Caller carries `StrategyEngineState` between ticks.
- Rules:
  - 3H range = rolling `currentTime-3h..currentTime` over 5M candles, recomputed every tick; upper/lower = price ± rangePoints.
  - Signal = 3 consecutive CLOSED 5M candles same direction (close vs open); doji/reversal resets. Entry = live price at confirmation tick; SL = open of 1st candle in run.
  - SL checked every tick. No streak tracking while position active (duplicate protection).
  - First tick with `lastClosedCandleTime === null` does not replay history.
- Emits explicit `events` (SIGNAL_CONFIRMED / STOP_LOSS_HIT / MANUAL_CLOSE) — backend persists from these, never from state diffs.
- Engine `signalId` = `${movementStartTime}-${UP|DOWN}`; differs from DB signalId (see `mem:backend/core`).
- Tests: `tests/engine.test.ts` (vitest), consumed as TS source (`main: src/index.ts`, no build step).
