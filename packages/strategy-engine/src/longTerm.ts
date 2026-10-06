/**
 * «The Troika» long-term (H1) strategy — the PDF guide «The Troika Mathematical Price Action Strategy» v2.0.
 * Pure like the scalping engine: no I/O, no clocks; the caller carries LongTermState between ticks.
 *
 * - Entry (section 2): 3 consecutive CLOSED H1 candles of one colour → enter at the OPEN of the 4th candle.
 *   Only the first troika of a run counts: the 4th/5th same-colour candles never signal again.
 * - Stop Loss (section 5, method 1): lowest low of the 3 candles − buffer (BUY), highest high + buffer (SELL).
 * - Speedometer (section 3, method 1 «ADR»): daily speed = average High−Low of the last 8 completed days;
 *   hourly speed = daily / 24; Step = daily / 3; TP1/TP2/TP3 = 1x/2x/3x daily speed from entry.
 * - Breakeven steps (section 4): price reaches Step 1 → SL to entry; Step 2 → SL to the Step 1 price.
 *   TP3 closes the whole position.
 * - Single Active Trade (section 6): no new troika is tracked while a position is open.
 */
import type { Candle } from './types';

export const ONE_HOUR_MS = 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;
export const SPEEDOMETER_LOOKBACK_DAYS = 8;
/** Section 5 names a «xavfsizlik buferi» without a size; one price point (e.g. $1 on gold) beyond the extreme. */
export const LONG_TERM_SL_BUFFER_POINTS = 1;

export type LongTermPhase =
  | 'WAITING'
  | 'ANALYZING_H1'
  | 'BUY_ACTIVE'
  | 'SELL_ACTIVE'
  | 'STOP_LOSS_HIT'
  | 'TAKE_PROFIT_HIT'
  | 'CLOSED'
  | 'NO_SPEED';

export interface Speedometer {
  lookbackDays: number;
  /** Average daily High−Low (ADR) — «Kunlik Tezlik». */
  dailySpeed: number;
  hourlySpeed: number;
  /** Breakeven step distance = dailySpeed / 3. */
  step: number;
}

export interface LongTermStreak {
  direction: 'UP' | 'DOWN';
  count: number;
  startCandleTime: number;
  startCandleOpen: number;
  high: number;
  low: number;
}

/** 0 = initial SL, 1 = SL at breakeven (entry), 2 = SL locked at the Step 1 price. */
export type LongTermStage = 0 | 1 | 2;

export interface LongTermPosition {
  signalId: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  initialStopLoss: number;
  stopLoss: number;
  stage: LongTermStage;
  /** Highest TP already reached (0, 1 or 2 — TP3 closes the position). */
  targetsHit: 0 | 1 | 2;
  step: number;
  dailySpeed: number;
  step1Price: number;
  step2Price: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  movementStartTime: number;
  movementStartPrice: number;
  /** Open time of the 4th candle = entry time. */
  confirmationTime: number;
  troikaHigh: number;
  troikaLow: number;
}

export interface LongTermState {
  phase: LongTermPhase;
  streak: LongTermStreak | null;
  activePosition: LongTermPosition | null;
  lastClosedCandleTime: number | null;
  /** «Only First Troika»: same-colour candles are ignored until a candle of another colour (or a doji) closes. */
  blockedDirection: 'UP' | 'DOWN' | null;
}

export interface LongTermInput {
  currentPrice: number;
  currentTime: number;
  /** H1 candles, ascending, open times aligned to the hour (the last one may still be forming). */
  candles: Candle[];
  /** Null while the daily history is not loaded yet: a troika then can't be priced and is skipped. */
  speedometer: Speedometer | null;
  paused?: boolean;
}

export type LongTermEvent =
  | {
      type: 'SIGNAL_CONFIRMED';
      signalId: string;
      position: LongTermPosition;
    }
  | {
      type: 'STOP_LOSS_MOVED';
      signalId: string;
      stage: LongTermStage;
      previousStopLoss: number;
      stopLoss: number;
    }
  | {
      type: 'TARGET_REACHED';
      signalId: string;
      target: 1 | 2;
      price: number;
    }
  | {
      type: 'POSITION_CLOSED';
      signalId: string;
      reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL';
      direction: 'BUY' | 'SELL';
      entryPrice: number;
      stopLoss: number;
      exitPrice: number;
      exitTime: number;
      pnlPoints: number;
    };

export interface LongTermOutput {
  currentPrice: number;
  phase: LongTermPhase;
  signal: 'WAIT' | 'BUY' | 'SELL';
  paused: boolean;
  speedometer: Speedometer | null;
  /** Building troika: direction and how many of the 3 H1 candles have closed. */
  movementDirection: 'UP' | 'DOWN' | null;
  movementCandles: number;
  movementStartTime: number | null;
  /** Preview of the SL the current troika would get (its extreme ± buffer). */
  potentialStopLoss: number | null;
  position: LongTermPosition | null;
  pnlPoints: number | null;
  /** Reward:risk to TP3 from the initial stop — section 7's R:R box. */
  riskReward: number | null;
  events: LongTermEvent[];
  state: LongTermState;
}

export function createLongTermState(): LongTermState {
  return { phase: 'WAITING', streak: null, activePosition: null, lastClosedCandleTime: null, blockedDirection: null };
}

/**
 * Section 3, method 1: average High−Low of the last `lookbackDays` COMPLETED daily candles.
 * Candles not aligned to midnight UTC (a truncated first bucket of a history request) are ignored.
 */
export function computeSpeedometer(dailyCandles: Candle[], currentTime: number, lookbackDays = SPEEDOMETER_LOOKBACK_DAYS): Speedometer | null {
  const completed = dailyCandles.filter((c) => c.time % ONE_DAY_MS === 0 && c.time + ONE_DAY_MS <= currentTime);
  if (completed.length < lookbackDays) return null;
  const window = completed.slice(-lookbackDays);
  const dailySpeed = window.reduce((sum, c) => sum + (c.high - c.low), 0) / lookbackDays;
  return { lookbackDays, dailySpeed, hourlySpeed: dailySpeed / 24, step: dailySpeed / 3 };
}

function candleDirection(candle: Candle): 'UP' | 'DOWN' | null {
  if (candle.close > candle.open) return 'UP';
  if (candle.close < candle.open) return 'DOWN';
  return null;
}

function pnlOf(position: Pick<LongTermPosition, 'direction' | 'entryPrice'>, price: number) {
  return position.direction === 'BUY' ? price - position.entryPrice : position.entryPrice - price;
}

function stopLossFor(streak: LongTermStreak): number {
  return streak.direction === 'UP' ? streak.low - LONG_TERM_SL_BUFFER_POINTS : streak.high + LONG_TERM_SL_BUFFER_POINTS;
}

export function buildLongTermPosition(streak: LongTermStreak, entryPrice: number, entryTime: number, speed: Speedometer): LongTermPosition | null {
  const direction = streak.direction === 'UP' ? 'BUY' : 'SELL';
  const sign = direction === 'BUY' ? 1 : -1;
  const stopLoss = stopLossFor(streak);
  // A gap through the troika's extreme would put the stop on the wrong side of entry: no trade.
  if (sign * (entryPrice - stopLoss) <= 0) return null;
  return {
    signalId: `${streak.startCandleTime}-${streak.direction}`,
    direction,
    entryPrice,
    initialStopLoss: stopLoss,
    stopLoss,
    stage: 0,
    targetsHit: 0,
    step: speed.step,
    dailySpeed: speed.dailySpeed,
    step1Price: entryPrice + sign * speed.step,
    step2Price: entryPrice + sign * 2 * speed.step,
    takeProfit1: entryPrice + sign * speed.dailySpeed,
    takeProfit2: entryPrice + sign * 2 * speed.dailySpeed,
    takeProfit3: entryPrice + sign * 3 * speed.dailySpeed,
    movementStartTime: streak.startCandleTime,
    movementStartPrice: streak.startCandleOpen,
    confirmationTime: entryTime,
    troikaHigh: streak.high,
    troikaLow: streak.low,
  };
}

/** Manage an open position against one price: SL, TP3, breakeven steps, TP1/TP2 marks. */
function managePosition(position: LongTermPosition, price: number, time: number, events: LongTermEvent[]) {
  const beyond = (level: number) => (position.direction === 'BUY' ? price >= level : price <= level);
  const close = (reason: 'STOP_LOSS' | 'TAKE_PROFIT') => {
    events.push({
      type: 'POSITION_CLOSED',
      signalId: position.signalId,
      reason,
      direction: position.direction,
      entryPrice: position.entryPrice,
      stopLoss: position.stopLoss,
      exitPrice: price,
      exitTime: time,
      pnlPoints: pnlOf(position, price),
    });
    return { position: null, closedBy: reason };
  };

  const stopHit = position.direction === 'BUY' ? price <= position.stopLoss : price >= position.stopLoss;
  if (stopHit) return close('STOP_LOSS');
  if (beyond(position.takeProfit3)) return close('TAKE_PROFIT');

  let next = position;
  // Steps are checked after the stop, so a move protects from the next tick on.
  const stage: LongTermStage = beyond(position.step2Price) ? 2 : beyond(position.step1Price) ? 1 : 0;
  if (stage > next.stage) {
    const stopLoss = stage === 2 ? next.step1Price : next.entryPrice;
    events.push({ type: 'STOP_LOSS_MOVED', signalId: next.signalId, stage, previousStopLoss: next.stopLoss, stopLoss });
    next = { ...next, stage, stopLoss };
  }
  const targetsHit = beyond(next.takeProfit2) ? 2 : beyond(next.takeProfit1) ? 1 : 0;
  if (targetsHit > next.targetsHit) {
    for (let target = next.targetsHit + 1; target <= targetsHit; target++) {
      events.push({ type: 'TARGET_REACHED', signalId: next.signalId, target: target as 1 | 2, price });
    }
    next = { ...next, targetsHit: targetsHit as 1 | 2 };
  }
  return { position: next, closedBy: null };
}

export function stepLongTerm(state: LongTermState, input: LongTermInput): { state: LongTermState; output: LongTermOutput } {
  const { currentPrice, currentTime, candles, speedometer } = input;
  const paused = input.paused ?? false;
  const events: LongTermEvent[] = [];

  let { phase, streak, activePosition, lastClosedCandleTime, blockedDirection } = state;
  let closedThisTick = false;

  if (activePosition) {
    const managed = managePosition(activePosition, currentPrice, currentTime, events);
    activePosition = managed.position;
    if (managed.closedBy) {
      phase = managed.closedBy === 'STOP_LOSS' ? 'STOP_LOSS_HIT' : 'TAKE_PROFIT_HIT';
      streak = null;
      closedThisTick = true;
    }
  }

  const isClosed = (c: Candle) => c.time + ONE_HOUR_MS <= currentTime;
  if (lastClosedCandleTime === null) {
    // First tick: start from the most recent closed candle instead of replaying history.
    const closed = candles.filter(isClosed);
    lastClosedCandleTime = closed.length > 0 ? closed[closed.length - 1].time : null;
  } else {
    const newlyClosed = candles.filter((c) => c.time > lastClosedCandleTime! && isClosed(c));
    for (const candle of newlyClosed) {
      lastClosedCandleTime = candle.time;
      const direction = candleDirection(candle);
      if (direction !== blockedDirection) blockedDirection = null;

      // Single Active Trade (section 6): no tracking while a position is open or on the tick it closed.
      if (activePosition || closedThisTick || paused) {
        streak = null;
        continue;
      }
      if (direction === null || direction === blockedDirection) {
        streak = null;
        continue;
      }

      // Consecutive bars, as on the chart: the daily break and weekends don't split a run.
      if (streak && streak.direction === direction) {
        streak = {
          ...streak,
          count: streak.count + 1,
          high: Math.max(streak.high, candle.high),
          low: Math.min(streak.low, candle.low),
        };
      } else {
        streak = {
          direction,
          count: 1,
          startCandleTime: candle.time,
          startCandleOpen: candle.open,
          high: candle.high,
          low: candle.low,
        };
      }

      if (streak.count === 3) {
        // Entry is the OPEN of the 4th candle — the one right after the 3rd; the live price if it hasn't printed yet.
        const fourth = candles.find((c) => c.time > candle.time);
        const entryTime = fourth ? fourth.time : currentTime;
        const entryPrice = fourth ? fourth.open : currentPrice;
        const position = speedometer ? buildLongTermPosition(streak, entryPrice, entryTime, speedometer) : null;
        blockedDirection = direction;
        streak = null;
        if (position) {
          activePosition = position;
          events.push({ type: 'SIGNAL_CONFIRMED', signalId: position.signalId, position });
          // The stop/steps also apply to the price already traded inside the 4th candle.
          const managed = managePosition(position, currentPrice, currentTime, events);
          activePosition = managed.position;
          if (managed.closedBy) {
            phase = managed.closedBy === 'STOP_LOSS' ? 'STOP_LOSS_HIT' : 'TAKE_PROFIT_HIT';
            closedThisTick = true;
          }
        }
      }
    }
  }

  if (activePosition) phase = activePosition.direction === 'BUY' ? 'BUY_ACTIVE' : 'SELL_ACTIVE';
  else if (streak) phase = 'ANALYZING_H1';
  else if (!closedThisTick && phase !== 'CLOSED' && phase !== 'STOP_LOSS_HIT' && phase !== 'TAKE_PROFIT_HIT') phase = 'WAITING';
  if (!activePosition && !speedometer) phase = 'NO_SPEED';

  const nextState: LongTermState = { phase, streak, activePosition, lastClosedCandleTime, blockedDirection };
  const risk = activePosition ? Math.abs(activePosition.entryPrice - activePosition.initialStopLoss) : 0;

  const output: LongTermOutput = {
    currentPrice,
    phase,
    signal: activePosition ? activePosition.direction : 'WAIT',
    paused,
    speedometer,
    movementDirection: streak ? streak.direction : null,
    movementCandles: streak ? streak.count : 0,
    movementStartTime: streak ? streak.startCandleTime : null,
    potentialStopLoss: streak ? stopLossFor(streak) : null,
    position: activePosition,
    pnlPoints: activePosition ? pnlOf(activePosition, currentPrice) : null,
    riskReward: activePosition && risk > 0 ? Math.abs(activePosition.takeProfit3 - activePosition.entryPrice) / risk : null,
    events,
    state: nextState,
  };
  return { state: nextState, output };
}

/** «Закрыть позицию» on the long-term page — user-initiated, at the current price. */
export function closeLongTermPosition(state: LongTermState, currentPrice: number, currentTime: number): { state: LongTermState; event: LongTermEvent | null } {
  const position = state.activePosition;
  if (!position) return { state, event: null };
  const event: LongTermEvent = {
    type: 'POSITION_CLOSED',
    signalId: position.signalId,
    reason: 'MANUAL',
    direction: position.direction,
    entryPrice: position.entryPrice,
    stopLoss: position.stopLoss,
    exitPrice: currentPrice,
    exitTime: currentTime,
    pnlPoints: pnlOf(position, currentPrice),
  };
  return { state: { ...state, phase: 'CLOSED', activePosition: null, streak: null }, event };
}
