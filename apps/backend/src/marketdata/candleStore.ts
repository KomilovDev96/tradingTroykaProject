import type { Candle } from '@troyka/strategy-engine';
import type { PriceTick, RemoteCandle } from './derivClient';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Trailing window kept in memory: comfortably more than the 3H analysis window (36 candles)
 * plus chart history, without letting the array (and the WS payload / per-tick range scan
 * over it) grow forever across days of continuous uptime.
 */
const MAX_CANDLES = 500;

function bucketStart(time: number): number {
  return Math.floor(time / FIVE_MINUTES_MS) * FIVE_MINUTES_MS;
}

/**
 * Keeps a rolling window of 5-minute OHLCV candles: closed candles come straight from
 * Deriv's own candle history (authoritative), and the currently-forming candle is built
 * live from streamed ticks so the chart updates between history refreshes.
 */
export class CandleStore {
  private candles: Candle[] = [];

  private trim() {
    if (this.candles.length > MAX_CANDLES) {
      this.candles = this.candles.slice(this.candles.length - MAX_CANDLES);
    }
  }

  seedFromHistory(history: RemoteCandle[]) {
    this.candles = history.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
    this.trim();
  }

  /** Replace all candles whose bucket is fully in the past with Deriv's authoritative values. */
  reconcile(history: RemoteCandle[]) {
    const byTime = new Map(this.candles.map((c) => [c.time, c]));
    for (const c of history) {
      if (c.complete) {
        byTime.set(c.time, { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
      }
    }
    this.candles = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
    this.trim();
  }

  applyTick(tick: PriceTick) {
    const bucket = bucketStart(tick.time);
    const last = this.candles[this.candles.length - 1];

    if (!last || bucket > last.time) {
      this.candles.push({ time: bucket, open: tick.price, high: tick.price, low: tick.price, close: tick.price, volume: 0 });
      this.trim();
    } else if (bucket === last.time) {
      last.high = Math.max(last.high, tick.price);
      last.low = Math.min(last.low, tick.price);
      last.close = tick.price;
      last.volume = (last.volume ?? 0) + 1;
    }
    // Ticks for a bucket older than the last stored candle are ignored (out-of-order network delivery).
  }

  getCandles(): Candle[] {
    return this.candles;
  }
}
