import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { env } from './env';
import type { EngineRunner } from './engine/runner';
import { getAllClosedTrades, getClosedTradesInRange, getOpenTrades, listTrades, type TradeFilters } from './db/tradeRepository';
import { computeByDayOfWeek, computeByDirection, computePnlCurve, computeStopLossStats, computeSummary } from './stats/computeStats';
import { Hub } from './ws/hub';

function parseTradeFilters(query: Record<string, unknown>): TradeFilters {
  return {
    from: query.from ? Number(query.from) : undefined,
    to: query.to ? Number(query.to) : undefined,
    symbol: typeof query.symbol === 'string' ? query.symbol : undefined,
    direction: query.direction === 'BUY' || query.direction === 'SELL' ? query.direction : undefined,
    result:
      query.result === 'PROFIT' || query.result === 'STOP_LOSS' || query.result === 'MANUAL_CLOSE' ? query.result : undefined,
    status: query.status === 'OPEN' || query.status === 'CLOSED' || query.status === 'STOP_LOSS' ? query.status : undefined,
    strategy: typeof query.strategy === 'string' ? query.strategy : undefined,
  };
}

function toCsv(rows: Array<Record<string, string | number | null>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number | null) => {
    const str = value === null ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n');
}

/** Express 4 doesn't catch rejected promises — forward them to the error middleware instead of crashing. */
function route(handler: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

export function createApp(runner: EngineRunner) {
  const app = express();
  // Local-only dev tool: accept the configured origin plus any localhost port, since Vite's
  // default 5173 is frequently taken by other projects and falls back to a random port.
  const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || origin === env.frontendOrigin || LOCALHOST_ORIGIN.test(origin)) callback(null, true);
        else callback(new Error(`Origin ${origin} not allowed`));
      },
    }),
  );
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, instrument: env.instrument, source: 'deriv-public' });
  });

  app.get('/api/snapshot', (_req, res) => {
    res.json({ instrument: env.instrument, output: runner.getLatest(), candles: runner.candleStore.getCandles() });
  });

  app.post('/api/close-position', route(async (_req, res) => {
    const latest = runner.getLatest();
    if (!latest) {
      res.status(409).json({ error: 'Engine has no data yet' });
      return;
    }
    const event = await runner.closePosition(latest.currentPrice, Date.now());
    if (!event) {
      res.status(409).json({ error: 'No active position to close' });
      return;
    }
    res.json({ event });
  }));

  app.get('/api/trades/open', route(async (_req, res) => {
    res.json(await getOpenTrades(env.instrument));
  }));

  app.get('/api/trades', route(async (req, res) => {
    res.json(await listTrades(parseTradeFilters(req.query as Record<string, unknown>)));
  }));

  app.get('/api/trades/export.csv', route(async (req, res) => {
    const trades = await listTrades(parseTradeFilters(req.query as Record<string, unknown>));
    const csv = toCsv(
      trades.map((t) => ({
        Date: new Date(t.createdAt).toISOString().slice(0, 10),
        Time: new Date(t.createdAt).toISOString().slice(11, 19),
        Symbol: t.symbol,
        Direction: t.direction,
        Entry: t.entryPrice,
        Exit: t.exitPrice,
        StopLoss: t.stopLoss,
        PnL: t.pnlPoints,
        Result: t.result,
        Strategy: t.strategy,
        RangeStart: new Date(t.rangeStart).toISOString(),
        RangeEnd: new Date(t.rangeEnd).toISOString(),
      })),
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="trade-history.csv"');
    res.send(csv);
  }));

  app.get('/api/stats/summary', route(async (req, res) => {
    const { from, to } = req.query;
    const trades = await getClosedTradesInRange(Number(from), Number(to), env.instrument);
    res.json(computeSummary(trades));
  }));

  app.get('/api/stats/by-direction', route(async (req, res) => {
    const { from, to } = req.query;
    const trades = await getClosedTradesInRange(Number(from), Number(to), env.instrument);
    res.json(computeByDirection(trades));
  }));

  app.get('/api/stats/by-day', route(async (req, res) => {
    const { from, to, timezone } = req.query;
    const trades = await getClosedTradesInRange(Number(from), Number(to), env.instrument);
    res.json(computeByDayOfWeek(trades, typeof timezone === 'string' ? timezone : 'UTC'));
  }));

  app.get('/api/stats/stoploss', route(async (req, res) => {
    const { from, to } = req.query;
    const trades = await getClosedTradesInRange(Number(from), Number(to), env.instrument);
    res.json(computeStopLossStats(trades));
  }));

  app.get('/api/stats/pnl-curve', route(async (_req, res) => {
    const trades = await getAllClosedTrades(env.instrument);
    res.json(computePnlCurve(trades));
  }));

  app.post('/api/analysis/pause', route(async (_req, res) => {
    await runner.setPaused(true);
    res.json({ paused: true });
  }));

  app.post('/api/analysis/resume', route(async (_req, res) => {
    await runner.setPaused(false);
    res.json({ paused: false });
  }));

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    console.error(`[troyka] ${req.method} ${req.path} failed:`, err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Internal server error' });
  });

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const hub = new Hub();
  hub.attach(wss);

  wss.on('connection', (socket) => {
    const snapshot = { type: 'snapshot', instrument: env.instrument, output: runner.getLatest(), candles: runner.candleStore.getCandles() };
    socket.send(JSON.stringify(snapshot));
  });

  return { httpServer, hub };
}
