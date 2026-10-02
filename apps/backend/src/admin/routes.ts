import { Router, type NextFunction, type Request, type Response } from 'express';
import { hashPassword } from '../auth/password';
import { validateAccountUpdate, validateRegistration } from '../auth/validation';
import type { AccountDTO } from '../db/accountRepository';
import {
  createAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  listResetRequests,
  resolveResetRequest,
  updateAccount,
} from '../db/accountRepository';
import { countOpenTradesByAccount, getAllClosedTrades, listTrades, type TradeDTO } from '../db/tradeRepository';
import { env } from '../env';
import { computeByDirection, computeSummary } from '../stats/computeStats';

type Handler = (req: Request, res: Response) => Promise<unknown>;
const route = (handler: Handler) => (req: Request, res: Response, next: NextFunction) => {
  handler(req, res).catch(next);
};

/** Mounted after requireAuth, so res.locals.account is always set here. */
function requireSuperAdmin(_req: Request, res: Response, next: NextFunction) {
  if ((res.locals.account as AccountDTO).role !== 'SUPERADMIN') {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }
  next();
}

function groupByAccount(trades: TradeDTO[]): Map<string, TradeDTO[]> {
  const map = new Map<string, TradeDTO[]>();
  for (const t of trades) {
    if (!t.accountId) continue;
    const list = map.get(t.accountId);
    if (list) list.push(t);
    else map.set(t.accountId, [t]);
  }
  return map;
}

/** Super admin panel API: every account with its own results, plus CRUD and password-reset requests. */
export function createAdminRouter(): Router {
  const router = Router();
  router.use(requireSuperAdmin);

  router.get('/dashboard', route(async (_req, res) => {
    const [accounts, closed, openByAccount, resetRequests] = await Promise.all([
      listAccounts(),
      getAllClosedTrades(env.instrument),
      countOpenTradesByAccount(),
      listResetRequests(),
    ]);
    const closedByAccount = groupByAccount(closed);

    const users = accounts
      .filter((a) => a.role === 'USER')
      .map((a) => ({ ...a, stats: computeSummary(closedByAccount.get(a.id) ?? []), openPositions: openByAccount.get(a.id) ?? 0 }));

    res.json({
      overview: {
        users: users.length,
        activeUsers: users.filter((u) => !u.analysisPaused).length,
        pausedUsers: users.filter((u) => u.analysisPaused).length,
        inProfit: users.filter((u) => u.stats.net > 0).length,
        inLoss: users.filter((u) => u.stats.net < 0).length,
        openPositions: users.reduce((sum, u) => sum + u.openPositions, 0),
        totalTrades: users.reduce((sum, u) => sum + u.stats.trades, 0),
        totalNet: users.reduce((sum, u) => sum + u.stats.net, 0),
        openResetRequests: resetRequests.filter((r) => r.status === 'OPEN').length,
      },
      users,
    });
  }));

  router.get('/users/:id', route(async (req, res) => {
    const account = await getAccount(req.params.id);
    if (!account) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    const trades = await listTrades({ accountId: account.id, symbol: env.instrument });
    const closed = trades.filter((t) => t.status !== 'OPEN');
    res.json({ account, trades, summary: computeSummary(closed), byDirection: computeByDirection(closed) });
  }));

  router.post('/users', route(async (req, res) => {
    const input = validateRegistration(req.body ?? {});
    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }
    const { password, ...rest } = input.value;
    const created = await createAccount({ ...rest, passwordHash: await hashPassword(password) });
    if (!created.ok) {
      res.status(409).json({ error: created.error });
      return;
    }
    res.status(201).json({ account: created.account });
  }));

  router.patch('/users/:id', route(async (req, res) => {
    const input = validateAccountUpdate(req.body ?? {});
    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }
    const { password, ...rest } = input.value;
    const updated = await updateAccount(req.params.id, { ...rest, ...(password ? { passwordHash: await hashPassword(password) } : {}) });
    if (!updated.ok) {
      res.status(updated.error === 'NOT_FOUND' ? 404 : 409).json({ error: updated.error });
      return;
    }
    res.json({ account: updated.account });
  }));

  router.delete('/users/:id', route(async (req, res) => {
    // Only regular users can be deleted — the super admin can't remove itself by accident.
    if (!(await deleteAccount(req.params.id))) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    res.json({ ok: true });
  }));

  router.get('/reset-requests', route(async (_req, res) => {
    res.json(await listResetRequests());
  }));

  router.post('/reset-requests/:id/resolve', route(async (req, res) => {
    if (!(await resolveResetRequest(req.params.id))) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    res.json({ ok: true });
  }));

  return router;
}
