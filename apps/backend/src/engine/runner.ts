import {
  closeActivePosition,
  createInitialState,
  step,
  type EngineEvent,
  type EngineOutput,
  type StrategyEngineState,
} from '@troyka/strategy-engine';
import { listAccountIdsForNewPositions } from '../db/accountRepository';
import { createTradingSession } from '../db/sessionRepository';
import {
  buildSignalId,
  closeTradeByStopLoss,
  closeTradeManually,
  countOpenTradesForSignal,
  createTradesForSignal,
  moveStopLoss,
  type TradeDTO,
} from '../db/tradeRepository';
import { CandleStore } from '../marketdata/candleStore';

export interface EngineRunnerConfig {
  userId: string;
  symbol: string;
  strategy: string;
  timeframe: string;
}

/** A stop loss the engine already applied but Postgres hasn't recorded yet. */
interface PendingStopLoss {
  /** DB signalId, not the engine's. */
  signalId: string;
  exitPrice: number;
  exitTime: number;
  pnlPoints: number;
}

/**
 * Owns the one, server-side instance of the strategy engine for an instrument. The engine's
 * signal is shared by everyone; each confirmed signal opens one Trade row per non-paused
 * account (sections 27-41). A stop loss closes all of them; a manual close only the caller's,
 * and the engine is released for the next signal once nobody holds the position any more.
 * PostgreSQL, not in-memory state, is the source of truth (section 46).
 */
export class EngineRunner {
  private state: StrategyEngineState = createInitialState();
  private latest: EngineOutput | null = null;
  /** DB signalId (strategy|symbol|movementStartTime|direction) of the engine's current position, if any. */
  private openTradeSignalId: string | null = null;
  private pendingStopLosses: PendingStopLoss[] = [];
  /**
   * Ticks and manual closes run strictly one at a time: each finishes its DB writes before the
   * next one reads engine state, so a stop loss can never race ahead of its own trades' INSERT.
   */
  private queue: Promise<unknown> = Promise.resolve();
  readonly candleStore = new CandleStore();

  constructor(
    private readonly config: EngineRunnerConfig,
    private readonly onUpdate: (output: EngineOutput) => void,
  ) {}

  /** Section 46: rebuild the engine's position from any still-open Trade row of the signal. */
  hydrateFromOpenTrade(trade: TradeDTO) {
    this.openTradeSignalId = trade.signalId ?? buildSignalId(trade.strategy, trade.symbol, trade.movementStartTime, trade.direction);
    this.state = {
      phase: trade.direction === 'BUY' ? 'BUY_ACTIVE' : 'SELL_ACTIVE',
      streak: null,
      activePosition: {
        signalId: `${trade.movementStartTime}-${trade.direction === 'BUY' ? 'UP' : 'DOWN'}`,
        direction: trade.direction,
        entryPrice: trade.entryPrice,
        stopLoss: trade.stopLoss,
        movementStartTime: trade.movementStartTime,
        movementStartPrice: trade.movementStartPrice,
        confirmationTime: trade.confirmationTime,
      },
      lastClosedCandleTime: null,
      signalHistory: [],
    };
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Never rejects: a failed tick is logged and the stream keeps flowing. */
  tick(currentPrice: number, currentTime: number): Promise<void> {
    return this.enqueue(() => this.processTick(currentPrice, currentTime)).catch((err) => {
      console.error('[troyka] Tick processing failed:', err);
    });
  }

  private async processTick(currentPrice: number, currentTime: number) {
    await this.flushPendingStopLosses();

    this.candleStore.applyTick({ time: currentTime, price: currentPrice });
    const result = step(this.state, { currentPrice, currentTime, candles: this.candleStore.getCandles() });

    for (const event of result.output.events) {
      if (event.type === 'SIGNAL_CONFIRMED') {
        try {
          await this.persistSignal(event, result.output);
        } catch (err) {
          // Section 46: Postgres is the source of truth — never hold a position it doesn't know about.
          // Drop this step entirely; the next tick re-evaluates the same closed candles and retries
          // (createTradesForSignal is idempotent per signal and account, so a half-applied attempt is safe).
          console.error('[troyka] Failed to persist confirmed signal, will retry on next tick:', err);
          return;
        }
        this.openTradeSignalId = buildSignalId(this.config.strategy, this.config.symbol, event.movementStartTime, event.direction);
        // Nobody received it (everyone paused, or no users yet): don't let an unowned position
        // block the next signal — release it right away.
        if ((await countOpenTradesForSignal(this.openTradeSignalId)) === 0) {
          result.state = closeActivePosition(result.state, currentPrice, currentTime).state;
          result.output = { ...result.output, phase: result.state.phase, signal: 'WAIT', entryPrice: null, stopLoss: null, state: result.state };
          this.openTradeSignalId = null;
        }
      } else if (event.type === 'STOP_LOSS_MOVED' && this.openTradeSignalId) {
        try {
          await moveStopLoss(this.openTradeSignalId, event.stopLoss);
        } catch (err) {
          // Same as a failed signal: drop the step, the next tick computes the same move and retries.
          console.error('[troyka] Failed to persist trailing stop, will retry on next tick:', err);
          return;
        }
      } else if (event.type === 'STOP_LOSS_HIT' && this.openTradeSignalId) {
        this.pendingStopLosses.push({
          signalId: this.openTradeSignalId,
          exitPrice: event.exitPrice,
          exitTime: event.exitTime,
          pnlPoints: event.pnlPoints,
        });
        this.openTradeSignalId = null;
      }
    }

    this.state = result.state;
    this.latest = result.output;
    await this.flushPendingStopLosses();
    this.onUpdate(result.output);
  }

  private async persistSignal(event: Extract<EngineEvent, { type: 'SIGNAL_CONFIRMED' }>, output: EngineOutput) {
    const range = {
      rangeStart: output.rangeStart,
      rangeEnd: output.rangeEnd,
      highDemand: output.highDemand!,
      lowDemand: output.lowDemand!,
      rangePoints: output.rangePoints!,
      upperLevel: output.upperLevel!,
      lowerLevel: output.lowerLevel!,
    };

    const session = await createTradingSession(this.config.symbol, this.config.strategy, range);
    const accountIds = await listAccountIdsForNewPositions();
    await createTradesForSignal(
      {
        userId: this.config.userId,
        symbol: this.config.symbol,
        strategy: this.config.strategy,
        timeframe: this.config.timeframe,
        sessionId: session.id,
        direction: event.direction,
        ...range,
        movementStartTime: event.movementStartTime,
        movementStartPrice: event.movementStartPrice,
        confirmationTime: event.confirmationTime,
        entryPrice: event.entryPrice,
        stopLoss: event.stopLoss,
      },
      accountIds,
    );
  }

  /** The engine already exited the position; keep retrying the DB write until it lands, in order. */
  private async flushPendingStopLosses() {
    while (this.pendingStopLosses.length > 0) {
      const close = this.pendingStopLosses[0];
      try {
        await closeTradeByStopLoss(close.signalId, close.exitPrice, close.exitTime, close.pnlPoints);
      } catch (err) {
        console.error('[troyka] Failed to record stop loss, will retry on next tick:', err);
        return;
      }
      this.pendingStopLosses.shift();
    }
  }

  /**
   * «Закрыть позицию» for one account. Returns null when that account holds no open position.
   * When the last holder closes, the engine's own position is released so the next signal can fire.
   */
  closePositionFor(accountId: string, currentPrice: number, currentTime: number) {
    return this.enqueue(async () => {
      const position = this.state.activePosition;
      const signalId = this.openTradeSignalId;
      if (!position || !signalId) return null;

      const pnlPoints = position.direction === 'BUY' ? currentPrice - position.entryPrice : position.entryPrice - currentPrice;
      const closed = await closeTradeManually(signalId, accountId, currentPrice, currentTime, pnlPoints);
      if (!closed) return null;

      if ((await countOpenTradesForSignal(signalId)) === 0) {
        this.state = closeActivePosition(this.state, currentPrice, currentTime).state;
        this.openTradeSignalId = null;
        if (this.latest) {
          // Same price/time as the last tick: just republishes the released (CLOSED) phase.
          const result = step(this.state, { currentPrice: this.latest.currentPrice, currentTime: this.latest.rangeEnd, candles: this.candleStore.getCandles() });
          this.state = result.state;
          this.latest = result.output;
          this.onUpdate(result.output);
        }
      }
      return { exitPrice: currentPrice, exitTime: currentTime, pnlPoints };
    });
  }

  getLatest() {
    return this.latest;
  }
}
