import type { ActivePosition, Candle, CandleStreak, EngineEvent, EngineInput, EngineOutput, StrategyEngineState } from './types';
import { CANDLES_TO_CONFIRM, FIVE_MINUTES_MS, THREE_HOURS_MS, TRAILING_STEP_POINTS, TRAILING_TRIGGER_POINTS } from './types';

const MAX_SIGNAL_HISTORY = 200;

export function createInitialState(): StrategyEngineState {
  return {
    phase: 'WAITING',
    streak: null,
    activePosition: null,
    lastClosedCandleTime: null,
    signalHistory: [],
  };
}

/**
 * Step 1-4: rolling 3H demand range and the levels derived from it.
 * Always CURRENT_TIME - 3h -> CURRENT_TIME, recalculated on every tick (spec section 2/17).
 */
function computeRangeAndLevels(candles: Candle[], currentPrice: number, currentTime: number) {
  const rangeStart = currentTime - THREE_HOURS_MS;
  const rangeEnd = currentTime;

  let highDemand: number | null = null;
  let lowDemand: number | null = null;

  for (const candle of candles) {
    if (candle.time < rangeStart || candle.time > rangeEnd) continue;
    if (highDemand === null || candle.high > highDemand) highDemand = candle.high;
    if (lowDemand === null || candle.low < lowDemand) lowDemand = candle.low;
  }

  if (highDemand === null || lowDemand === null) {
    return { rangeStart, rangeEnd, highDemand: null, lowDemand: null, rangePoints: null, upperLevel: null, lowerLevel: null };
  }

  const rangePoints = highDemand - lowDemand;
  const upperLevel = currentPrice + rangePoints;
  const lowerLevel = currentPrice - rangePoints;

  return { rangeStart, rangeEnd, highDemand, lowDemand, rangePoints, upperLevel, lowerLevel };
}

/** A candle's own direction: green/bullish (close > open) is "up", red/bearish (close < open) is "down". */
function candleDirection(candle: Candle): 'UP' | 'DOWN' | null {
  if (candle.close > candle.open) return 'UP';
  if (candle.close < candle.open) return 'DOWN';
  return null;
}

/**
 * Trailing Stop Loss for the current profit, or null while below the trigger.
 * Profit 4..5.99 locks +2, 6..7.99 locks +4, and so on (see TRAILING_TRIGGER_POINTS).
 */
export function trailingStopLoss(position: Pick<ActivePosition, 'direction' | 'entryPrice'>, currentPrice: number): number | null {
  const profit = position.direction === 'BUY' ? currentPrice - position.entryPrice : position.entryPrice - currentPrice;
  if (profit < TRAILING_TRIGGER_POINTS) return null;
  const steps = Math.floor((profit - TRAILING_TRIGGER_POINTS) / TRAILING_STEP_POINTS);
  const locked = TRAILING_TRIGGER_POINTS - TRAILING_STEP_POINTS + steps * TRAILING_STEP_POINTS;
  return position.direction === 'BUY' ? position.entryPrice + locked : position.entryPrice - locked;
}

function buildSignalId(direction: 'UP' | 'DOWN', movementStartTime: number): string {
  return `${movementStartTime}-${direction}`;
}

/** Candles fully closed as of currentTime, strictly after `after` (open time), in ascending order. */
function closedCandlesSince(candles: Candle[], after: number | null, currentTime: number): Candle[] {
  return candles.filter((c) => (after === null || c.time > after) && c.time + FIVE_MINUTES_MS <= currentTime);
}

/**
 * Advance the engine by one price tick. Pure function: same (state, input) always
 * produces the same (state, output). No I/O, no React, no hidden clocks.
 *
 * Entry rule (Тройка): 3 consecutive CLOSED 5-minute candles moving the same direction
 * (each candle's own close vs open) = 15 minutes of continuous movement. The signal fires the
 * instant the 3rd candle closes — Entry is the live price at that moment, Stop Loss is the
 * OPEN price of the FIRST candle in the 3-candle run.
 */
export function step(state: StrategyEngineState, input: EngineInput): { state: StrategyEngineState; output: EngineOutput } {
  const { currentPrice, currentTime, candles } = input;
  const paused = input.paused ?? false;
  const events: EngineEvent[] = [];

  let phase = state.phase;
  let streak: CandleStreak | null = state.streak;
  let activePosition: ActivePosition | null = state.activePosition;
  let signalHistory = state.signalHistory;
  let lastClosedCandleTime = state.lastClosedCandleTime;

  // --- Stop Loss is checked on every tick, independent of the candle grid (section 29). ---
  let stoppedOutThisTick = false;
  if (activePosition) {
    const hit =
      activePosition.direction === 'BUY'
        ? currentPrice <= activePosition.stopLoss
        : currentPrice >= activePosition.stopLoss;

    if (hit) {
      const pnlPoints =
        activePosition.direction === 'BUY'
          ? currentPrice - activePosition.entryPrice
          : activePosition.entryPrice - currentPrice;

      events.push({
        type: 'STOP_LOSS_HIT',
        signalId: activePosition.signalId,
        direction: activePosition.direction,
        entryPrice: activePosition.entryPrice,
        stopLoss: activePosition.stopLoss,
        exitPrice: currentPrice,
        exitTime: currentTime,
        pnlPoints,
      });

      phase = 'STOP_LOSS_HIT';
      activePosition = null;
      streak = null;
      stoppedOutThisTick = true;
    }
  }

  // --- Trailing stop: checked after the hit test, so a move only protects from the next tick on. ---
  if (activePosition) {
    const trailed = trailingStopLoss(activePosition, currentPrice);
    const tighter =
      trailed !== null &&
      (activePosition.direction === 'BUY' ? trailed > activePosition.stopLoss : trailed < activePosition.stopLoss);

    if (trailed !== null && tighter) {
      events.push({
        type: 'STOP_LOSS_MOVED',
        signalId: activePosition.signalId,
        direction: activePosition.direction,
        entryPrice: activePosition.entryPrice,
        previousStopLoss: activePosition.stopLoss,
        stopLoss: trailed,
        profitPoints: activePosition.direction === 'BUY' ? currentPrice - activePosition.entryPrice : activePosition.entryPrice - currentPrice,
      });
      activePosition = { ...activePosition, stopLoss: trailed };
    }
  }

  // --- 3-consecutive-5M-candle entry rule. ---
  if (lastClosedCandleTime === null) {
    // First ever tick: don't replay pre-existing history as if it just happened. Start
    // tracking fresh from whatever the most recently closed candle is right now.
    const alreadyClosed = candles.filter((c) => c.time + FIVE_MINUTES_MS <= currentTime);
    lastClosedCandleTime = alreadyClosed.length > 0 ? alreadyClosed[alreadyClosed.length - 1].time : null;
  } else {
    // Always advance past newly-closed candles, even while a position is open — otherwise a
    // backlog would build up and get replayed all at once the moment the position resolves.
    const newlyClosed = closedCandlesSince(candles, lastClosedCandleTime, currentTime);

    for (const candle of newlyClosed) {
      lastClosedCandleTime = candle.time;

      // No new streak may start (or extend) while a position from a previous movement is
      // still open (section 21/47) — including the very tick a stop loss just closed it.
      if (stoppedOutThisTick || activePosition || paused) continue;

      const direction = candleDirection(candle);

      if (direction === null) {
        // A flat (doji) candle breaks any streak without starting a new one.
        streak = null;
        phase = 'WAITING';
        continue;
      }

      if (streak === null || streak.direction !== direction) {
        // Either no streak yet, or the direction reversed: start a fresh 1-candle streak.
        streak = { direction, count: 1, startCandleTime: candle.time, startCandleOpen: candle.open };
        phase = 'ANALYZING_15M';
        continue;
      }

      // Same direction as the ongoing streak: extend it.
      streak = { ...streak, count: streak.count + 1 };

      if (streak.count >= CANDLES_TO_CONFIRM) {
        const signalDirection = streak.direction === 'UP' ? 'BUY' : 'SELL';
        const signalId = buildSignalId(streak.direction, streak.startCandleTime);

        const newPosition: ActivePosition = {
          signalId,
          direction: signalDirection,
          entryPrice: currentPrice,
          stopLoss: streak.startCandleOpen,
          movementStartTime: streak.startCandleTime,
          movementStartPrice: streak.startCandleOpen,
          confirmationTime: currentTime,
        };

        events.push({
          type: 'SIGNAL_CONFIRMED',
          signalId,
          direction: signalDirection,
          entryPrice: newPosition.entryPrice,
          stopLoss: newPosition.stopLoss,
          movementStartTime: newPosition.movementStartTime,
          movementStartPrice: newPosition.movementStartPrice,
          confirmationTime: newPosition.confirmationTime,
          movementDurationMinutes: (streak.count * FIVE_MINUTES_MS) / 60000,
        });

        activePosition = newPosition;
        phase = signalDirection === 'BUY' ? 'BUY_ACTIVE' : 'SELL_ACTIVE';
        signalHistory = [...signalHistory, { ...newPosition }].slice(-MAX_SIGNAL_HISTORY);
        streak = null;
      } else {
        // 2 of 3 candles in — one more same-direction close confirms the signal.
        phase = direction === 'UP' ? 'BUY_READY' : 'SELL_READY';
      }
    }
  }

  if (paused) {
    // A half-built streak can't survive a pause — resuming starts from fresh candles.
    streak = null;
    if (!activePosition && !stoppedOutThisTick) phase = 'PAUSED';
  } else if (phase === 'PAUSED') {
    phase = 'WAITING';
  }

  const { rangeStart, rangeEnd, highDemand, lowDemand, rangePoints, upperLevel, lowerLevel } = computeRangeAndLevels(
    candles,
    currentPrice,
    currentTime,
  );

  const nextState: StrategyEngineState = { phase, streak, activePosition, lastClosedCandleTime, signalHistory };

  const signal: EngineOutput['signal'] = phase === 'BUY_ACTIVE' ? 'BUY' : phase === 'SELL_ACTIVE' ? 'SELL' : 'WAIT';

  const output: EngineOutput = {
    currentPrice,
    rangeStart,
    rangeEnd,
    highDemand,
    lowDemand,
    rangePoints,
    upperLevel,
    lowerLevel,

    movementDirection: streak ? streak.direction : null,
    movementStartPrice: streak ? streak.startCandleOpen : null,
    movementStartTime: streak ? streak.startCandleTime : null,
    movementDuration: streak ? (streak.count * FIVE_MINUTES_MS) / 60000 : 0,

    potentialEntryPrice: streak ? currentPrice : null,
    potentialStopLoss: streak ? streak.startCandleOpen : null,

    signal,
    entryPrice: activePosition ? activePosition.entryPrice : null,
    stopLoss: activePosition ? activePosition.stopLoss : null,

    phase,
    paused,
    events,
    state: nextState,
  };

  return { state: nextState, output };
}

/** Section 10: manual "Закрыть анализ / Позиция закрыта" — user-initiated close, not automatic. */
export function closeActivePosition(
  state: StrategyEngineState,
  currentPrice: number,
  currentTime: number,
): { state: StrategyEngineState; event: EngineEvent | null } {
  if (!state.activePosition) {
    return { state, event: null };
  }

  const { activePosition } = state;
  const pnlPoints =
    activePosition.direction === 'BUY' ? currentPrice - activePosition.entryPrice : activePosition.entryPrice - currentPrice;

  const event: EngineEvent = {
    type: 'MANUAL_CLOSE',
    signalId: activePosition.signalId,
    direction: activePosition.direction,
    entryPrice: activePosition.entryPrice,
    stopLoss: activePosition.stopLoss,
    exitPrice: currentPrice,
    exitTime: currentTime,
    pnlPoints,
  };

  const nextState: StrategyEngineState = {
    ...state,
    phase: 'CLOSED',
    activePosition: null,
    streak: null,
  };

  return { state: nextState, event };
}
