import {
  closeLongTermPosition,
  computeSpeedometer,
  createLongTermState,
  ONE_DAY_MS,
  ONE_HOUR_MS,
  SPEEDOMETER_LOOKBACK_DAYS,
  stepLongTerm,
  type Candle,
  type LongTermOutput,
  type LongTermPosition,
  type LongTermState,
} from '@troyka/strategy-engine';
import { listAccountIdsForNewPositions } from '../db/accountRepository';
import { createTradingSession } from '../db/sessionRepository';
import {
  buildSignalId,
  closeTradeByStopLoss,
  closeTradeByTakeProfit,
  closeTradeManually,
  countOpenTradesForSignal,
  createTradesForSignal,
  markTargetsHit,
  moveStopLoss,
  type TradeDTO,
} from '../db/tradeRepository';
import { CandleStore } from '../marketdata/candleStore';
import type { EngineRunnerConfig } from './runner';

interface PendingClose {
  signalId: string;
  reason: 'STOP_LOSS' | 'TAKE_PROFIT';
  exitPrice: number;
  exitTime: number;
  pnlPoints: number;
}

/**
 * The long-term «Troika» (H1 candles, speedometer targets) — same lifecycle as EngineRunner:
 * one shared signal, one Trade row per non-paused account, SL/TP3 close everyone, a manual close
 * only the caller. Postgres is the source of truth; ticks and closes run strictly one at a time.
 */
export class LongTermRunner {
  private state: LongTermState = createLongTermState();
  private latest: LongTermOutput | null = null;
  private openTradeSignalId: string | null = null;
  private pendingCloses: PendingClose[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private dailyCandles: Candle[] = [];
  readonly candleStore = new CandleStore(ONE_HOUR_MS);

  constructor(
    private readonly config: EngineRunnerConfig,
    private readonly onUpdate: (output: LongTermOutput) => void,
  ) {}

  /** Daily candles for the speedometer (ADR of the last 8 completed days). */
  setDailyCandles(candles: Candle[]) {
    this.dailyCandles = candles;
  }

  hydrateFromOpenTrade(trade: TradeDTO) {
    if (trade.dailySpeed === null || trade.breakevenStep === null || trade.takeProfit1 === null || trade.takeProfit2 === null || trade.takeProfit3 === null) {
      console.error(`[troyka-h1] Open trade ${trade.id} has no speedometer targets — not restored`);
      return;
    }
    this.openTradeSignalId = trade.signalId;
    const sign = trade.direction === 'BUY' ? 1 : -1;
    const position: LongTermPosition = {
      signalId: `${trade.movementStartTime}-${trade.direction === 'BUY' ? 'UP' : 'DOWN'}`,
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      initialStopLoss: trade.initialStopLoss ?? trade.stopLoss,
      stopLoss: trade.stopLoss,
      stage: Math.min(2, trade.stage) as LongTermPosition['stage'],
      targetsHit: Math.min(2, trade.targetsHit) as LongTermPosition['targetsHit'],
      step: trade.breakevenStep,
      dailySpeed: trade.dailySpeed,
      step1Price: trade.entryPrice + sign * trade.breakevenStep,
      step2Price: trade.entryPrice + sign * 2 * trade.breakevenStep,
      takeProfit1: trade.takeProfit1,
      takeProfit2: trade.takeProfit2,
      takeProfit3: trade.takeProfit3,
      movementStartTime: trade.movementStartTime,
      movementStartPrice: trade.movementStartPrice,
      confirmationTime: trade.confirmationTime,
      troikaHigh: trade.highDemand,
      troikaLow: trade.lowDemand,
    };
    this.state = { ...createLongTermState(), phase: trade.direction === 'BUY' ? 'BUY_ACTIVE' : 'SELL_ACTIVE', activePosition: position };
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  tick(currentPrice: number, currentTime: number): Promise<void> {
    return this.enqueue(() => this.processTick(currentPrice, currentTime)).catch((err) => {
      console.error('[troyka-h1] Tick processing failed:', err);
    });
  }

  private async processTick(currentPrice: number, currentTime: number) {
    await this.flushPendingCloses();

    this.candleStore.applyTick({ time: currentTime, price: currentPrice });
    const speedometer = computeSpeedometer(this.dailyCandles, currentTime);
    const result = stepLongTerm(this.state, { currentPrice, currentTime, candles: this.candleStore.getCandles(), speedometer });

    // Any failed write drops the whole step: the next tick recomputes the same events and retries.
    try {
      for (const event of result.output.events) {
        if (event.type === 'SIGNAL_CONFIRMED') {
          await this.persistSignal(event.position, currentTime);
          this.openTradeSignalId = buildSignalId(this.config.strategy, this.config.symbol, event.position.movementStartTime, event.position.direction);
          if ((await countOpenTradesForSignal(this.openTradeSignalId)) === 0) {
            // Nobody received it (everyone paused): don't let an unowned position block the next troika.
            result.state = closeLongTermPosition(result.state, currentPrice, currentTime).state;
            result.output = { ...result.output, phase: result.state.phase, signal: 'WAIT', position: null, pnlPoints: null, riskReward: null, state: result.state };
            this.openTradeSignalId = null;
            break;
          }
        } else if (event.type === 'STOP_LOSS_MOVED' && this.openTradeSignalId) {
          await moveStopLoss(this.openTradeSignalId, event.stopLoss, event.stage);
        } else if (event.type === 'TARGET_REACHED' && this.openTradeSignalId) {
          await markTargetsHit(this.openTradeSignalId, event.target);
        } else if (event.type === 'POSITION_CLOSED' && event.reason !== 'MANUAL' && this.openTradeSignalId) {
          this.pendingCloses.push({
            signalId: this.openTradeSignalId,
            reason: event.reason,
            exitPrice: event.exitPrice,
            exitTime: event.exitTime,
            pnlPoints: event.pnlPoints,
          });
          this.openTradeSignalId = null;
        }
      }
    } catch (err) {
      console.error('[troyka-h1] Failed to persist engine events, will retry on next tick:', err);
      return;
    }

    this.state = result.state;
    this.latest = result.output;
    await this.flushPendingCloses();
    this.onUpdate(result.output);
  }

  private async persistSignal(position: LongTermPosition, currentTime: number) {
    // TradingSession/Trade carry the scalping range columns; for H1 they hold the speedometer snapshot:
    // range = the 8-day lookback, high/low = the troika's extremes, rangePoints = daily speed,
    // upper/lower = the TP3 distance on either side of entry.
    const range = {
      rangeStart: currentTime - SPEEDOMETER_LOOKBACK_DAYS * ONE_DAY_MS,
      rangeEnd: currentTime,
      highDemand: position.troikaHigh,
      lowDemand: position.troikaLow,
      rangePoints: position.dailySpeed,
      upperLevel: position.entryPrice + 3 * position.dailySpeed,
      lowerLevel: position.entryPrice - 3 * position.dailySpeed,
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
        direction: position.direction,
        ...range,
        movementStartTime: position.movementStartTime,
        movementStartPrice: position.movementStartPrice,
        confirmationTime: position.confirmationTime,
        entryPrice: position.entryPrice,
        stopLoss: position.stopLoss,
        longTerm: {
          dailySpeed: position.dailySpeed,
          breakevenStep: position.step,
          takeProfit1: position.takeProfit1,
          takeProfit2: position.takeProfit2,
          takeProfit3: position.takeProfit3,
          stage: position.stage,
          targetsHit: position.targetsHit,
        },
      },
      accountIds,
    );
  }

  private async flushPendingCloses() {
    while (this.pendingCloses.length > 0) {
      const close = this.pendingCloses[0];
      try {
        if (close.reason === 'TAKE_PROFIT') await closeTradeByTakeProfit(close.signalId, close.exitPrice, close.exitTime, close.pnlPoints);
        else await closeTradeByStopLoss(close.signalId, close.exitPrice, close.exitTime, close.pnlPoints);
      } catch (err) {
        console.error('[troyka-h1] Failed to record position close, will retry on next tick:', err);
        return;
      }
      this.pendingCloses.shift();
    }
  }

  /** «Закрыть позицию» for one account; the engine is released once nobody holds the position. */
  closePositionFor(accountId: string, currentPrice: number, currentTime: number) {
    return this.enqueue(async () => {
      const position = this.state.activePosition;
      const signalId = this.openTradeSignalId;
      if (!position || !signalId) return null;

      const pnlPoints = position.direction === 'BUY' ? currentPrice - position.entryPrice : position.entryPrice - currentPrice;
      const closed = await closeTradeManually(signalId, accountId, currentPrice, currentTime, pnlPoints);
      if (!closed) return null;

      if ((await countOpenTradesForSignal(signalId)) === 0) {
        this.state = closeLongTermPosition(this.state, currentPrice, currentTime).state;
        this.openTradeSignalId = null;
        if (this.latest) {
          this.latest = { ...this.latest, phase: this.state.phase, signal: 'WAIT', position: null, pnlPoints: null, riskReward: null, events: [], state: this.state };
          this.onUpdate(this.latest);
        }
      }
      return { exitPrice: currentPrice, exitTime: currentTime, pnlPoints };
    });
  }

  getLatest() {
    return this.latest;
  }
}
