import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { env } from './env';
import type { EngineRunner } from './engine/runner';
import { getAllClosedTrades, getClosedTradesInRange, getOpenTrades, listTrades, type TradeFilters } from './db/tradeRepository';
import { computeByDayOfWeek, computeByDirection, computePnlCurve, computeStopLossStats, computeSummary } from './stats/computeStats';
import { Hub } from './ws/hub';
import { hashPassword, verifyPassword } from './auth/password';
import { AttemptLimiter } from './auth/rateLimit';
import { authenticate, clearSessionCookie, readCookie, requireAuth, SESSION_COOKIE, setSessionCookie } from './auth/session';
import { checkPassword, normalizeEmail, normalizePhone, validateRegistration } from './auth/validation';
import {
  createAccount,
  createResetRequest,
  changeOwnPassword,
  createSession,
  deleteSession,
  findAccountByEmail,
  findAccountWithPasswordById,
  setAccountPaused,
  touchLastLogin,
  type AccountDTO,
} from './db/accountRepository';
import { createAdminRouter } from './admin/routes';

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
  // Behind Caddy in production: trust the private-network proxy so req.ip is the real client.
  app.set('trust proxy', 'loopback, uniquelocal');
  // Local-only dev tool: accept the configured origin plus any localhost port, since Vite's
  // default 5173 is frequently taken by other projects and falls back to a random port.
  const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || origin === env.frontendOrigin || LOCALHOST_ORIGIN.test(origin)) callback(null, true);
        else callback(new Error(`Origin ${origin} not allowed`));
      },
      // The session cookie must travel with cross-port requests in local dev (5173 -> 4000).
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, instrument: env.instrument, source: 'deriv-public' });
  });

  const loginLimiter = new AttemptLimiter(10, 15 * 60 * 1000);
  const registerLimiter = new AttemptLimiter(20, 60 * 60 * 1000);
  const forgotLimiter = new AttemptLimiter(5, 60 * 60 * 1000);

  app.post('/api/auth/register', route(async (req, res) => {
    if (registerLimiter.isBlocked(req.ip ?? '')) {
      res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
      return;
    }
    const input = validateRegistration(req.body ?? {});
    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }
    registerLimiter.recordFailure(req.ip ?? ''); // counts every sign-up attempt per IP, not just failures
    const { password, ...rest } = input.value;
    const created = await createAccount({ ...rest, passwordHash: await hashPassword(password) });
    if (!created.ok) {
      res.status(409).json({ error: created.error });
      return;
    }
    const session = await createSession(created.account.id);
    await touchLastLogin(created.account.id);
    setSessionCookie(res, session.token, session.expiresAt);
    res.status(201).json({ account: created.account });
  }));

  app.post('/api/auth/login', route(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const key = `${req.ip}|${email}`;
    if (loginLimiter.isBlocked(key)) {
      res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
      return;
    }
    const account = email ? await findAccountByEmail(email) : null;
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      loginLimiter.recordFailure(key);
      res.status(401).json({ error: 'INVALID_CREDENTIALS' });
      return;
    }
    loginLimiter.reset(key);
    const session = await createSession(account.id);
    await touchLastLogin(account.id);
    setSessionCookie(res, session.token, session.expiresAt);
    const { passwordHash: _hash, lastLoginAt: _last, createdAt: _created, ...dto } = account;
    res.json({ account: dto });
  }));

  app.post('/api/auth/logout', route(async (req, res) => {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) await deleteSession(token);
    clearSessionCookie(res);
    res.json({ ok: true });
  }));

  app.get('/api/auth/me', route(async (req, res) => {
    const account = await authenticate(req);
    if (!account) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    res.json({ account });
  }));

  /** «Забыли пароль»: leaves the phone number for the super admin. Same answer whether or not it matches an account. */
  app.post('/api/auth/forgot', route(async (req, res) => {
    if (forgotLimiter.isBlocked(req.ip ?? '')) {
      res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
      return;
    }
    const phone = normalizePhone(req.body?.phone);
    if (!phone) {
      res.status(400).json({ error: 'PHONE_INVALID' });
      return;
    }
    forgotLimiter.recordFailure(req.ip ?? '');
    await createResetRequest(phone);
    res.json({ ok: true });
  }));

  // Everything below needs a signed-in account.
  app.use('/api', requireAuth);
  app.use('/api/admin', createAdminRouter());

  const accountOf = (res: Response) => res.locals.account as AccountDTO;

  app.get('/api/snapshot', (_req, res) => {
    res.json({ instrument: env.instrument, output: runner.getLatest(), candles: runner.candleStore.getCandles() });
  });

  /** «Закрыть позицию»: closes only the caller's own position. */
  app.post('/api/close-position', route(async (_req, res) => {
    const latest = runner.getLatest();
    if (!latest) {
      res.status(409).json({ error: 'NO_DATA' });
      return;
    }
    const closed = await runner.closePositionFor(accountOf(res).id, latest.currentPrice, Date.now());
    if (!closed) {
      res.status(409).json({ error: 'NO_POSITION' });
      return;
    }
    res.json(closed);
  }));

  /** «Остановить / Продолжить анализ» — per account: a paused account gets no new positions. */
  app.post('/api/me/pause', route(async (_req, res) => {
    res.json({ account: await setAccountPaused(accountOf(res).id, true) });
  }));

  app.post('/api/me/resume', route(async (_req, res) => {
    res.json({ account: await setAccountPaused(accountOf(res).id, false) });
  }));

  /** Change your own password: requires the current one; other browsers are signed out, this one stays. */
  app.post('/api/me/password', route(async (req, res) => {
    const account = accountOf(res);
    const key = `password|${account.id}`;
    if (loginLimiter.isBlocked(key)) {
      res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
      return;
    }
    const next = checkPassword(req.body?.newPassword);
    if (!next.ok) {
      res.status(400).json({ error: next.error });
      return;
    }
    const stored = await findAccountWithPasswordById(account.id);
    const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    if (!stored || !(await verifyPassword(current, stored.passwordHash))) {
      loginLimiter.recordFailure(key);
      res.status(400).json({ error: 'WRONG_CURRENT_PASSWORD' });
      return;
    }
    loginLimiter.reset(key);
    await changeOwnPassword(account.id, await hashPassword(next.value), readCookie(req, SESSION_COOKIE));
    res.json({ ok: true });
  }));

  app.get('/api/trades/open', route(async (_req, res) => {
    res.json(await getOpenTrades(env.instrument, accountOf(res).id));
  }));

  app.get('/api/trades', route(async (req, res) => {
    res.json(await listTrades({ ...parseTradeFilters(req.query as Record<string, unknown>), accountId: accountOf(res).id }));
  }));

  app.get('/api/trades/export.csv', route(async (req, res) => {
    const trades = await listTrades({ ...parseTradeFilters(req.query as Record<string, unknown>), accountId: accountOf(res).id });
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

  const closedInRange = (req: Request, res: Response) =>
    getClosedTradesInRange(Number(req.query.from), Number(req.query.to), env.instrument, accountOf(res).id);

  app.get('/api/stats/summary', route(async (req, res) => {
    res.json(computeSummary(await closedInRange(req, res)));
  }));

  app.get('/api/stats/by-direction', route(async (req, res) => {
    res.json(computeByDirection(await closedInRange(req, res)));
  }));

  app.get('/api/stats/by-day', route(async (req, res) => {
    const { timezone } = req.query;
    res.json(computeByDayOfWeek(await closedInRange(req, res), typeof timezone === 'string' ? timezone : 'UTC'));
  }));

  app.get('/api/stats/stoploss', route(async (req, res) => {
    res.json(computeStopLossStats(await closedInRange(req, res)));
  }));

  app.get('/api/stats/pnl-curve', route(async (_req, res) => {
    res.json(computePnlCurve(await getAllClosedTrades(env.instrument, accountOf(res).id)));
  }));

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    console.error(`[troyka] ${req.method} ${req.path} failed:`, err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Internal server error' });
  });

  const httpServer = createServer(app);
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    // Live market data is for signed-in accounts only: the browser sends the session cookie on the upgrade.
    verifyClient: (info, done) => {
      authenticate(info.req)
        .then((account) => done(account !== null, 401, 'Unauthorized'))
        .catch(() => done(false, 500, 'Internal server error'));
    },
  });
  const hub = new Hub();
  hub.attach(wss);

  wss.on('connection', (socket) => {
    const snapshot = { type: 'snapshot', instrument: env.instrument, output: runner.getLatest(), candles: runner.candleStore.getCandles() };
    socket.send(JSON.stringify(snapshot));
  });

  return { httpServer, hub };
}
