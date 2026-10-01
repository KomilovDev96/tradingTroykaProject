import {
  closeActivePosition,
  createInitialState,
  step,
  type EngineEvent,
  type EngineOutput,
  type StrategyEngineState,
} from '@troyka/strategy-engine';
import { createTradingSession } from '../db/sessionRepository';
import { buildSignalId, closeTradeByStopLoss, closeTradeManually, createTradeFromSignal, type TradeDTO } from '../db/tradeRepository';
import { setAnalysisPaused } from '../db/userRepository';
import { CandleStore } from '../marketdata/candleStore';

export interface EngineRunnerConfig {
  userId: string;
  symbol: string;
  strategy: string;
  timeframe: string;
}

interface PendingClose {
  kind: 'STOP_LOSS' | 'MANUAL_CLOSE';
  /** DB signalId, not the engine's. */
  signalId: string;
  exitPrice: number;
  exitTime: number;
  pnlPoints: number;
}

/**
 * Owns the one, server-side instance of the strategy engine for an instrument, and persists
 * every confirmed signal / exit as a Trade row (sections 27-41). Running it here (not in the
 * browser) is what lets open positions survive a frontend reload AND, via hydrateFromOpenTrade,
 * a full backend restart (section 46) — PostgreSQL, not in-memory state, is the source of truth.
 */
export class EngineRunner {
  private state: StrategyEngineState = createInitialState();
  private latest: EngineOutput | null = null;
  /** DB signalId (strategy|symbol|movementStartTime|direction) of the currently open trade, if any. */
  private openTradeSignalId: string | null = null;
  /** Exits the engine already applied but Postgres hasn't recorded yet — retried until they land. */
  private pendingCloses: PendingClose[] = [];
  /**
   * Ticks and manual closes run strictly one at a time: each finishes its DB writes before the
   * next one reads engine state, so a stop loss can never race ahead of its own trade's INSERT.
   */
  private queue: Promise<unknown> = Promise.resolve();
  /** User-controlled "stop/continue analysis", persisted on the User row (see restorePaused). */
  private paused = false;
  readonly candleStore = new CandleStore();

  constructor(
    private readonly config: EngineRunnerConfig,
    private readonly onUpdate: (output: EngineOutput) => void,
  ) {}

  /** Section 46: rebuild in-memory engine state from the one open Trade row, if any. */
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
    await this.flushPendingCloses();

    this.candleStore.applyTick({ time: currentTime, price: currentPrice });
    const result = step(this.state, { currentPrice, currentTime, candles: this.candleStore.getCandles(), paused: this.paused });

    for (const event of result.output.events) {
      if (event.type === 'SIGNAL_CONFIRMED') {
        try {
          const trade = await this.persistSignal(event, result.output);
          this.openTradeSignalId = trade.signalId;
        } catch (err) {
          // Section 46: Postgres is the source of truth — never hold a position it doesn't know about.
          // Drop this step entirely; the next tick re-evaluates the same closed candles and retries
          // (createTradeFromSignal is idempotent by signalId, so a half-applied attempt is safe).
          console.error('[troyka] Failed to persist confirmed signal, will retry on next tick:', err);
          return;
        }
      } else if (event.type === 'STOP_LOSS_HIT' && this.openTradeSignalId) {
        this.pendingCloses.push({
          kind: 'STOP_LOSS',
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
    await this.flushPendingCloses();
    this.onUpdate(result.output);
  }

  private persistSignal(event: Extract<EngineEvent, { type: 'SIGNAL_CONFIRMED' }>, output: EngineOutput) {
    const range = {
      rangeStart: output.rangeStart,
      rangeEnd: output.rangeEnd,
      highDemand: output.highDemand!,
      lowDemand: output.lowDemand!,
      rangePoints: output.rangePoints!,
      upperLevel: output.upperLevel!,
      lowerLevel: output.lowerLevel!,
    };

    return createTradingSession(this.config.symbol, this.config.strategy, range).then((session) =>
      createTradeFromSignal({
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
      }),
    );
  }

  /** The engine already exited the position; keep retrying the DB write until it lands, in order. */
  private async flushPendingCloses() {
    while (this.pendingCloses.length > 0) {
      const close = this.pendingCloses[0];
      try {
        if (close.kind === 'STOP_LOSS') {
          await closeTradeByStopLoss(close.signalId, close.exitPrice, close.exitTime, close.pnlPoints);
        } else {
          await closeTradeManually(close.signalId, close.exitPrice, close.exitTime, close.pnlPoints);
        }
      } catch (err) {
        console.error('[troyka] Failed to record trade exit, will retry on next tick:', err);
        return;
      }
      this.pendingCloses.shift();
    }
  }

  closePosition(currentPrice: number, currentTime: number) {
    return this.enqueue(async () => {
      const { state, event } = closeActivePosition(this.state, currentPrice, currentTime);
      this.state = state;
      if (event && event.type === 'MANUAL_CLOSE' && this.openTradeSignalId) {
        this.pendingCloses.push({
          kind: 'MANUAL_CLOSE',
          signalId: this.openTradeSignalId,
          exitPrice: event.exitPrice,
          exitTime: event.exitTime,
          pnlPoints: event.pnlPoints,
        });
        this.openTradeSignalId = null;
        await this.flushPendingCloses();
      }
      return event;
    });
  }

  /** Boot-time only, before the first tick: apply the paused flag already stored in Postgres. */
  restorePaused(paused: boolean) {
    this.paused = paused;
  }

  /**
   * Persists first, so a failed DB write leaves the analysis in its previous mode.
   * Then re-steps at the last tick's own price/time (so no candle closes and no stop loss is
   * re-evaluated at a new price) just to push the new phase to clients immediately.
   */
  setPaused(paused: boolean) {
    return this.enqueue(async () => {
      await setAnalysisPaused(this.config.userId, paused);
      this.paused = paused;
      if (!this.latest) return null;
      const result = step(this.state, {
        currentPrice: this.latest.currentPrice,
        currentTime: this.latest.rangeEnd,
        candles: this.candleStore.getCandles(),
        paused,
      });
      this.state = result.state;
      this.latest = result.output;
      this.onUpdate(result.output);
      return result.output;
    });
  }

  getLatest() {
    return this.latest;
  }
}
