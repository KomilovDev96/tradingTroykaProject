import { WebSocket } from 'ws';

const WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';
const REQUEST_TIMEOUT_MS = 15000;
const PING_INTERVAL_MS = 20000;

export interface RemoteCandle {
  time: number; // ms epoch UTC, candle open time
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  complete: boolean;
}

export interface PriceTick {
  time: number; // ms epoch UTC
  price: number;
}

interface DerivMessage {
  req_id?: number;
  error?: { message: string };
  tick?: { epoch: number; quote: number; symbol: string };
  candles?: Array<{ epoch: number; open: number; high: number; low: number; close: number }>;
  time?: number;
}

/**
 * Deriv's public market-data WebSocket (https://developers.deriv.com/docs/options/ws-public/):
 * no auth, no API key, no account — verified live during development (see README). Used for
 * BOTH one-off REST-style requests (candle history) and the persistent tick subscription.
 */
class DerivConnection {
  private ws: WebSocket;
  private sequence = 0;
  private pending = new Map<number, { resolve: (msg: DerivMessage) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private ready: Promise<void>;
  onTick: ((tick: PriceTick, symbol: string) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor() {
    this.ws = new WebSocket(WS_URL);
    this.ready = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out connecting to Deriv')), REQUEST_TIMEOUT_MS);
      this.ws.once('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      this.ws.once('error', (err) => {
        clearTimeout(timeout);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });

    this.ws.on('message', (raw) => {
      let msg: DerivMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.req_id && this.pending.has(msg.req_id)) {
        const p = this.pending.get(msg.req_id)!;
        clearTimeout(p.timer);
        this.pending.delete(msg.req_id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg);
      }

      if (msg.tick && Number.isFinite(msg.tick.quote) && msg.tick.quote > 0 && Number.isFinite(msg.tick.epoch)) {
        this.onTick?.({ time: msg.tick.epoch * 1000, price: msg.tick.quote }, msg.tick.symbol);
      }
    });

    this.ws.once('close', () => this.onClose?.());
  }

  async connect() {
    await this.ready;
  }

  request(payload: Record<string, unknown>): Promise<DerivMessage> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState !== this.ws.OPEN) {
        reject(new Error('Deriv WebSocket is not open'));
        return;
      }
      const req_id = ++this.sequence;
      const timer = setTimeout(() => {
        this.pending.delete(req_id);
        reject(new Error('Deriv did not respond in time'));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(req_id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ ...payload, req_id }));
    });
  }

  close() {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error('Connection closed'));
    }
    this.pending.clear();
    this.ws.close();
  }
}

/** One-off historical candle fetch — opens a connection, requests, closes. */
export async function fetchCandles(symbol: string, granularitySeconds: number, count: number): Promise<RemoteCandle[]> {
  const conn = new DerivConnection();
  try {
    await conn.connect();
    const timeMsg = await conn.request({ time: 1 });
    if (!timeMsg.time) throw new Error('Deriv did not return server time');

    const historyMsg = await conn.request({
      ticks_history: symbol,
      end: timeMsg.time,
      count,
      style: 'candles',
      granularity: granularitySeconds,
    });
    if (!historyMsg.candles?.length) throw new Error(`Deriv returned no candle history for ${symbol}`);

    return historyMsg.candles.map((c) => ({
      time: c.epoch * 1000,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: 0,
      complete: true,
    }));
  } finally {
    conn.close();
  }
}

/**
 * Persistent tick subscription with reconnect + a 20s ping (Deriv closes idle sockets).
 * Returns an abort function. This is the "real-time" feed — a genuine wss:// push stream.
 */
export function streamPrices(symbol: string, onTick: (tick: PriceTick) => void, onError: (err: Error) => void): () => void {
  let aborted = false;
  let conn: DerivConnection | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const start = async () => {
    if (aborted) return;
    try {
      conn = new DerivConnection();
      conn.onTick = (tick, tickSymbol) => {
        if (tickSymbol === symbol) onTick(tick);
      };
      await conn.connect();
      await conn.request({ ticks: symbol, subscribe: 1 });

      pingTimer = setInterval(() => {
        conn?.request({ ping: 1 }).catch(() => {
          conn?.close();
        });
      }, PING_INTERVAL_MS);

      conn.onClose = () => {
        if (pingTimer) clearInterval(pingTimer);
        if (!aborted) {
          onError(new Error('Deriv stream disconnected — reconnecting'));
          reconnectTimer = setTimeout(start, 2000);
        }
      };
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
      if (!aborted) reconnectTimer = setTimeout(start, 3000);
    }
  };

  start();

  return () => {
    aborted = true;
    if (pingTimer) clearInterval(pingTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    conn?.close();
  };
}
