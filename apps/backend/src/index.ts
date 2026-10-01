import { env } from './env';
import { getAnalysisPaused, getOrCreateDefaultUser } from './db/userRepository';
import { getOpenTrades } from './db/tradeRepository';
import { EngineRunner } from './engine/runner';
import { fetchCandles, streamPrices } from './marketdata/derivClient';
import { createApp } from './server';

const GRANULARITY_SECONDS = 300; // 5 minutes
const HISTORY_COUNT = 200;
const RECONCILE_INTERVAL_MS = 4 * 60 * 1000;
const STRATEGY = 'TROYKA';
const TIMEFRAME = '5m';

async function main() {
  const userId = await getOrCreateDefaultUser();

  console.log(`[troyka] Fetching ${HISTORY_COUNT} historical 5m candles for ${env.instrument} from Deriv...`);
  const history = await fetchCandles(env.instrument, GRANULARITY_SECONDS, HISTORY_COUNT);
  console.log(`[troyka] Loaded ${history.length} candles.`);

  let hub: { broadcast: (msg: unknown) => void } | null = null;

  const runner = new EngineRunner({ userId, symbol: env.instrument, strategy: STRATEGY, timeframe: TIMEFRAME }, (output) => {
    hub?.broadcast({ type: 'update', output, candles: runner.candleStore.getCandles() });
    if (output.events.length > 0) hub?.broadcast({ type: 'trades-changed' });
  });
  runner.candleStore.seedFromHistory(history);

  // Section 46: restore an open position across backend restarts from Postgres, not memory.
  const [openTrade] = await getOpenTrades(env.instrument);
  if (openTrade) {
    console.log(`[troyka] Restoring open ${openTrade.direction} trade from ${new Date(openTrade.confirmationTime).toISOString()}`);
    runner.hydrateFromOpenTrade(openTrade);
  }

  if (await getAnalysisPaused(userId)) {
    console.log('[troyka] Analysis is paused (restored from Postgres) — no new signals until resumed.');
    runner.restorePaused(true);
  }

  const app = createApp(runner);
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

  streamPrices(
    env.instrument,
    (tick) => {
      void runner.tick(tick.price, tick.time);
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
