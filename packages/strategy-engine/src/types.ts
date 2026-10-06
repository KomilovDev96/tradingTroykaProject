/**
 * Pure domain types for the "Troyka" strategy engine.
 * No React, no I/O — deterministic data in, data out.
 */

export type MovementDirection = 'UP' | 'DOWN';

export type SignalType = 'WAIT' | 'BUY' | 'SELL';

export type StrategyPhase =
  | 'WAITING'
  | 'ANALYZING_15M'
  | 'BUY_READY'
  | 'SELL_READY'
  | 'BUY_ACTIVE'
  | 'SELL_ACTIVE'
  | 'STOP_LOSS_HIT'
  | 'CLOSED'
  | 'PAUSED';

/** One OHLCV candle. `time` is the candle OPEN time, ms epoch UTC. */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Tracks a streak of consecutive same-direction CLOSED 5-minute candles.
 * A candle is "up" when close > open, "down" when close < open (standard candle coloring).
 * 3 consecutive candles in the same direction (15 minutes) confirms the signal.
 */
export interface CandleStreak {
  direction: MovementDirection;
  /** How many consecutive same-direction candles closed so far (1 or 2; 3 confirms and clears). */
  count: number;
  /** Open time of the FIRST candle in this streak — becomes movementStartTime if confirmed. */
  startCandleTime: number;
  /** Open price of the FIRST candle in this streak — becomes the Stop Loss if confirmed. */
  startCandleOpen: number;
}

export interface ActivePosition {
  signalId: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  movementStartTime: number;
  movementStartPrice: number;
  confirmationTime: number;
}

export type EngineEvent =
  | {
      type: 'SIGNAL_CONFIRMED';
      signalId: string;
      direction: 'BUY' | 'SELL';
      entryPrice: number;
      stopLoss: number;
      movementStartTime: number;
      movementStartPrice: number;
      confirmationTime: number;
      movementDurationMinutes: number;
    }
  | {
      type: 'STOP_LOSS_HIT';
      signalId: string;
      direction: 'BUY' | 'SELL';
      entryPrice: number;
      stopLoss: number;
      exitPrice: number;
      exitTime: number;
      pnlPoints: number;
    }
  | {
      /** Trailing stop: the position's Stop Loss was pulled up into profit. */
      type: 'STOP_LOSS_MOVED';
      signalId: string;
      direction: 'BUY' | 'SELL';
      entryPrice: number;
      previousStopLoss: number;
      stopLoss: number;
      /** Profit (points) at the tick that moved it. */
      profitPoints: number;
    }
  | {
      type: 'MANUAL_CLOSE';
      signalId: string;
      direction: 'BUY' | 'SELL';
      entryPrice: number;
      stopLoss: number;
      exitPrice: number;
      exitTime: number;
      pnlPoints: number;
    };

/** Persisted, serializable engine state — carried from tick to tick by the caller. */
export interface StrategyEngineState {
  phase: StrategyPhase;
  streak: CandleStreak | null;
  activePosition: ActivePosition | null;
  /** Open time of the last CLOSED candle already evaluated, so history isn't replayed on boot. */
  lastClosedCandleTime: number | null;
  signalHistory: Array<{
    signalId: string;
    direction: 'BUY' | 'SELL';
    movementStartTime: number;
    movementStartPrice: number;
    confirmationTime: number;
    entryPrice: number;
    stopLoss: number;
  }>;
}

export interface EngineInput {
  /** Latest traded/mid price, already normalized to the instrument's quote units. */
  currentPrice: number;
  /** ms epoch UTC. */
  currentTime: number;
  /** 5-minute candles, ascending by time, already normalized to UTC. Must cover at least the last 3h. */
  candles: Candle[];
  /**
   * User paused the analysis: no new movement is tracked and candles closing meanwhile are skipped
   * (never replayed on resume). An already-open position keeps its Stop Loss monitored.
   */
  paused?: boolean;
}

export interface EngineOutput {
  currentPrice: number;
  rangeStart: number;
  rangeEnd: number;
  highDemand: number | null;
  lowDemand: number | null;
  rangePoints: number | null;
  upperLevel: number | null;
  lowerLevel: number | null;

  movementDirection: MovementDirection | null;
  movementStartPrice: number | null;
  movementStartTime: number | null;
  /** Minutes represented by consecutive same-direction closed candles so far (0, 5, or 10). */
  movementDuration: number;

  /** Unconfirmed preview values shown while a movement is building (section 1: "потенциальная точка входа"). */
  potentialEntryPrice: number | null;
  potentialStopLoss: number | null;

  signal: SignalType;
  entryPrice: number | null;
  stopLoss: number | null;

  phase: StrategyPhase;
  paused: boolean;
  events: EngineEvent[];
  state: StrategyEngineState;
}

export const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
export const FIVE_MINUTES_MS = 5 * 60 * 1000;
export const CANDLES_TO_CONFIRM = 3;
/**
 * Trailing stop: once the position is TRAILING_TRIGGER_POINTS in profit the Stop Loss moves to
 * entry + (trigger - step); every further TRAILING_STEP_POINTS of profit pulls it up by another step.
 * 40 → SL +20, 60 → SL +40, 80 → SL +60… It never moves back.
 */
export const TRAILING_TRIGGER_POINTS = 40;
export const TRAILING_STEP_POINTS = 20;
