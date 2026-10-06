import { env } from './env';
import { getOrCreateDefaultUser } from './db/userRepository';
import { ensureSuperAdmin, listActiveSuperAdminIds } from './db/accountRepository';
import { hashPassword } from './auth/password';
import { createTradesForSignal, getOpenTrades, type TradeDTO } from './db/tradeRepository';
import { EngineRunner } from './engine/runner';
import { LongTermRunner } from './engine/longTermRunner';
import { LONG_TERM_STRATEGY, SCALPING_STRATEGY } from './strategies';
import { fetchCandles, streamPrices } from './marketdata/derivClient';
import { createApp } from './server';

const GRANULARITY_SECONDS = 300; // 5 minutes
const HISTORY_COUNT = 200;
const RECONCILE_INTERVAL_MS = 4 * 60 * 1000;
const TIMEFRAME = '5m';
const H1_SECONDS = 3600;
const DAY_SECONDS = 86400;
/** Deriv counts calendar days/hours (weekends included): ~11 trading days of H1, 16 days → ≥8 completed daily bars. */
const H1_HISTORY_COUNT = 400;
const DAILY_HISTORY_COUNT = 16;
const H1_RECONCILE_INTERVAL_MS = 10 * 60 * 1000;
const DAILY_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

async function main() {
  const userId = await getOrCreateDefaultUser();

  console.log(`[troyka] Fetching ${HISTORY_COUNT} historical 5m candles for ${env.instrument} from Deriv...`);
  const history = await fetchCandles(env.instrument, GRANULARITY_SECONDS, HISTORY_COUNT);
  console.log(`[troyka] Loaded ${history.length} candles.`);

  let hub: { broadcast: (msg: unknown) => void } | null = null;

  console.log(`[troyka] Fetching H1 and daily candles for the long-term strategy...`);
  const [h1History, dailyHistory] = await Promise.all([
    fetchCandles(env.instrument, H1_SECONDS, H1_HISTORY_COUNT),
    fetchCandles(env.instrument, DAY_SECONDS, DAILY_HISTORY_COUNT),
  ]);
  console.log(`[troyka] Loaded ${h1History.length} H1 and ${dailyHistory.length} daily candles.`);

  const runner = new EngineRunner({ userId, symbol: env.instrument, strategy: SCALPING_STRATEGY, timeframe: TIMEFRAME }, (output) => {
    hub?.broadcast({ type: 'update', output, candles: runner.candleStore.getCandles() });
    if (output.events.length > 0) hub?.broadcast({ type: 'trades-changed' });
  });
  runner.candleStore.seedFromHistory(history);

  const longTermRunner = new LongTermRunner({ userId, symbol: env.instrument, strategy: LONG_TERM_STRATEGY, timeframe: '1h' }, (output) => {
    hub?.broadcast({ type: 'update-long-term', output, candles: longTermRunner.candleStore.getCandles() });
    if (output.events.length > 0) hub?.broadcast({ type: 'trades-changed' });
  });
  longTermRunner.candleStore.seedFromHistory(h1History);
  longTermRunner.setDailyCandles(dailyHistory);

  // Section 46: restore an open position across backend restarts from Postgres, not memory.
  // Only positions someone actually holds (legacy rows without an account are closed by migration).
  const [openTrade] = (await getOpenTrades(env.instrument, undefined, SCALPING_STRATEGY)).filter((t) => t.accountId !== null);
  if (openTrade) {
    console.log(`[troyka] Restoring open ${openTrade.direction} trade from ${new Date(openTrade.confirmationTime).toISOString()}`);
    runner.hydrateFromOpenTrade(openTrade);
  }
  const [openLongTerm] = (await getOpenTrades(env.instrument, undefined, LONG_TERM_STRATEGY)).filter((t) => t.accountId !== null);
  if (openLongTerm) {
    console.log(`[troyka] Restoring open long-term ${openLongTerm.direction} trade from ${new Date(openLongTerm.confirmationTime).toISOString()}`);
    longTermRunner.hydrateFromOpenTrade(openLongTerm);
  }

  if (env.superAdminEmail) {
    const password = env.superAdminPassword;
    const outcome = await ensureSuperAdmin(env.superAdminEmail, async () => {
      if (!password) throw new Error('SUPERADMIN_PASSWORD is required to create the super admin account');
      return hashPassword(password);
    });
    console.log(`[troyka] Super admin ${env.superAdminEmail}: ${outcome}`);
  }

  // The super admin used to only observe, so it holds no row for a position that opened before it could trade:
  // give it one for the restored position (idempotent per signal and account, a closed one is never reopened).
  const joinSuperAdmins = async (trade: TradeDTO | undefined) => {
    if (!trade) return;
    const accountIds = await listActiveSuperAdminIds();
    if (accountIds.length === 0) return;
    await createTradesForSignal(
      {
        userId,
        symbol: trade.symbol,
        strategy: trade.strategy,
        timeframe: trade.timeframe,
        sessionId: trade.sessionId,
        direction: trade.direction,
        rangeStart: trade.rangeStart,
        rangeEnd: trade.rangeEnd,
        highDemand: trade.highDemand,
        lowDemand: trade.lowDemand,
        rangePoints: trade.rangePoints,
        upperLevel: trade.upperLevel,
        lowerLevel: trade.lowerLevel,
        movementStartTime: trade.movementStartTime,
        movementStartPrice: trade.movementStartPrice,
        confirmationTime: trade.confirmationTime,
        entryPrice: trade.entryPrice,
        stopLoss: trade.stopLoss,
        signalId: trade.signalId,
        longTerm:
          trade.takeProfit1 !== null && trade.takeProfit2 !== null && trade.takeProfit3 !== null && trade.dailySpeed !== null && trade.breakevenStep !== null
            ? {
                dailySpeed: trade.dailySpeed,
                breakevenStep: trade.breakevenStep,
                initialStopLoss: trade.initialStopLoss ?? trade.stopLoss,
                takeProfit1: trade.takeProfit1,
                takeProfit2: trade.takeProfit2,
                takeProfit3: trade.takeProfit3,
                stage: trade.stage,
                targetsHit: trade.targetsHit,
              }
            : undefined,
      },
      accountIds,
    );
  };
  await joinSuperAdmins(openTrade);
  await joinSuperAdmins(openLongTerm);

  const app = createApp(runner, longTermRunner);
  hub = app.hub;

  app.httpServer.listen(env.port, () => {
    console.log(`[troyka] Backend listening on http://localhost:${env.port}`);
  });

  setInterval(async () => {
    try {
      const fresh = await fetchCandles(env.instrument, GRANULARITY_SECONDS, 10);
      runner.candleStore.reconcile(fresh);
    } catch (err) {
      console.error('[troyka] Candle reconciliation failed:', err);
    }
  }, RECONCILE_INTERVAL_MS);

  setInterval(async () => {
    try {
      longTermRunner.candleStore.reconcile(await fetchCandles(env.instrument, H1_SECONDS, 6));
    } catch (err) {
      console.error('[troyka] H1 candle reconciliation failed:', err);
    }
  }, H1_RECONCILE_INTERVAL_MS);

  setInterval(async () => {
    try {
      longTermRunner.setDailyCandles(await fetchCandles(env.instrument, DAY_SECONDS, DAILY_HISTORY_COUNT));
    } catch (err) {
      console.error('[troyka] Daily candle refresh failed:', err);
    }
  }, DAILY_REFRESH_INTERVAL_MS);

  streamPrices(
    env.instrument,
    (tick) => {
      void runner.tick(tick.price, tick.time);
      void longTermRunner.tick(tick.price, tick.time);
    },
    (err) => console.error('[troyka] Price stream error (will retry):', err.message),
  );
}

// Last-resort net: a stray rejection is logged, it must not take the live engine down with it.
process.on('unhandledRejection', (reason) => {
  console.error('[troyka] Unhandled promise rejection:', reason);
});

main().catch((err) => {
  console.error('[troyka] Fatal startup error:', err);
  process.exit(1);
});
