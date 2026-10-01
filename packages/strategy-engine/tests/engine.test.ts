import { describe, expect, it } from 'vitest';
import { Candle, closeActivePosition, createInitialState, step } from '../src';

const MIN = 60_000;
const FIVE_MIN = 5 * MIN;
const BASE = Date.UTC(2026, 0, 1, 16, 0, 0); // 2026-01-01 16:00:00 UTC

function candle(time: number, open: number, close: number): Candle {
  return { time, open, high: Math.max(open, close), low: Math.min(open, close), close };
}

/**
 * Drives the engine through a series of 5-minute candles, calling step() exactly once per
 * candle at the instant it closes (candle.time + 5min). A throwaway warm-up candle is
 * prepended so the engine's "don't replay pre-existing history on the very first tick"
 * guard (mirroring a real backend boot with seeded history) doesn't swallow the candle
 * under test — this matches how the engine actually behaves in production, it just means
 * tests need one extra candle of runway before the sequence they're asserting on.
 */
function runCandles(realCandles: Candle[]) {
  const warmup = candle(realCandles[0].time - FIVE_MIN, realCandles[0].open, realCandles[0].open);
  const all = [warmup, ...realCandles];

  let state = createInitialState();
  let lastOutput;
  const events = [];
  for (const c of all) {
    const currentTime = c.time + FIVE_MIN;
    const result = step(state, { currentPrice: c.close, currentTime, candles: all });
    state = result.state;
    lastOutput = result.output;
    events.push(...result.output.events);
  }
  return { state, output: lastOutput!, events };
}

describe('3H range and demand levels (sections 2-4)', () => {
  const rangeCandles: Candle[] = [
    { time: BASE - 170 * MIN, open: 4640, high: 4674, low: 4638, close: 4650 },
    { time: BASE - 60 * MIN, open: 4650, high: 4660, low: 4645, close: 4655 },
    { time: BASE - 1 * MIN, open: 4655, high: 4665, low: 4650, close: 4669 },
  ];

  it('computes rangeStart/rangeEnd as CURRENT_TIME-3h -> CURRENT_TIME', () => {
    const state = createInitialState();
    const { output } = step(state, { currentPrice: 4669, currentTime: BASE, candles: rangeCandles });
    expect(output.rangeEnd).toBe(BASE);
    expect(output.rangeStart).toBe(BASE - 3 * 60 * MIN);
  });

  it('finds HIGH demand as the max high in range', () => {
    const state = createInitialState();
    const { output } = step(state, { currentPrice: 4669, currentTime: BASE, candles: rangeCandles });
    expect(output.highDemand).toBe(4674);
  });

  it('finds LOW demand as the min low in range', () => {
    const state = createInitialState();
    const { output } = step(state, { currentPrice: 4669, currentTime: BASE, candles: rangeCandles });
    expect(output.lowDemand).toBe(4638);
  });

  it('matches the exact spec example: 4669 / 4674 / 4638 -> 36 -> 4705 / 4633 -> 72', () => {
    const state = createInitialState();
    const { output } = step(state, { currentPrice: 4669, currentTime: BASE, candles: rangeCandles });

    expect(output.highDemand).toBe(4674);
    expect(output.lowDemand).toBe(4638);
    expect(output.rangePoints).toBe(36);
    expect(output.upperLevel).toBe(4705);
    expect(output.lowerLevel).toBe(4633);
    expect(output.upperLevel! - output.lowerLevel!).toBe(72);
  });

  it('rolls forward to a new 3H window as time passes, dropping stale candles', () => {
    const state = createInitialState();
    const first = step(state, { currentPrice: 4669, currentTime: BASE, candles: rangeCandles });
    expect(first.output.highDemand).toBe(4674);

    const second = step(state, { currentPrice: 4669, currentTime: BASE + 11 * MIN, candles: rangeCandles });
    expect(second.output.rangeStart).toBe(BASE + 11 * MIN - 3 * 60 * MIN);
    expect(second.output.highDemand).toBe(4665);
  });

  it('returns nulls when no candles fall in the current range', () => {
    const state = createInitialState();
    const { output } = step(state, { currentPrice: 4669, currentTime: BASE, candles: [] });
    expect(output.highDemand).toBeNull();
    expect(output.lowDemand).toBeNull();
    expect(output.rangePoints).toBeNull();
    expect(output.upperLevel).toBeNull();
    expect(output.lowerLevel).toBeNull();
  });
});

describe('3 consecutive 5M candles — the exact Тройка entry rule', () => {
  it('does not signal after a single up candle — only starts analyzing', () => {
    const c1 = candle(BASE, 4669, 4672);
    const { output } = runCandles([c1]);
    expect(output.phase).toBe('ANALYZING_15M');
    expect(output.movementDirection).toBe('UP');
    expect(output.movementStartPrice).toBe(4669);
    expect(output.movementDuration).toBe(5);
    expect(output.signal).toBe('WAIT');
  });

  it('does not signal after two up candles — moves to BUY_READY, no entry/stopLoss yet', () => {
    const c1 = candle(BASE, 4669, 4672);
    const c2 = candle(BASE + FIVE_MIN, 4672, 4678);
    const { output } = runCandles([c1, c2]);
    expect(output.phase).toBe('BUY_READY');
    expect(output.movementDuration).toBe(10);
    expect(output.signal).toBe('WAIT');
    expect(output.entryPrice).toBeNull();
    expect(output.stopLoss).toBeNull();
  });

  it('confirms BUY on the 3rd consecutive up candle: entry=current price, SL=1st candle open', () => {
    const c1 = candle(BASE, 4669, 4672);
    const c2 = candle(BASE + FIVE_MIN, 4672, 4678);
    const c3 = candle(BASE + 2 * FIVE_MIN, 4678, 4685);
    const { output, events } = runCandles([c1, c2, c3]);

    expect(output.phase).toBe('BUY_ACTIVE');
    expect(output.signal).toBe('BUY');
    expect(output.entryPrice).toBe(4685); // current price at confirmation = c3.close
    expect(output.stopLoss).toBe(4669); // c1.open

    const confirmed = events.find((e) => e.type === 'SIGNAL_CONFIRMED');
    expect(confirmed).toMatchObject({ direction: 'BUY', entryPrice: 4685, stopLoss: 4669, movementDurationMinutes: 15 });
  });

  it('does not signal after two down candles — moves to SELL_READY', () => {
    const c1 = candle(BASE, 4669, 4666);
    const c2 = candle(BASE + FIVE_MIN, 4666, 4660);
    const { output } = runCandles([c1, c2]);
    expect(output.phase).toBe('SELL_READY');
    expect(output.signal).toBe('WAIT');
  });

  it('confirms SELL on the 3rd consecutive down candle: entry=current price, SL=1st candle open', () => {
    const c1 = candle(BASE, 4669, 4666);
    const c2 = candle(BASE + FIVE_MIN, 4666, 4660);
    const c3 = candle(BASE + 2 * FIVE_MIN, 4660, 4653);
    const { output, events } = runCandles([c1, c2, c3]);

    expect(output.phase).toBe('SELL_ACTIVE');
    expect(output.signal).toBe('SELL');
    expect(output.entryPrice).toBe(4653);
    expect(output.stopLoss).toBe(4669);

    const confirmed = events.find((e) => e.type === 'SIGNAL_CONFIRMED');
    expect(confirmed).toMatchObject({ direction: 'SELL', entryPrice: 4653, stopLoss: 4669, movementDurationMinutes: 15 });
  });

  it('a reversal on the 3rd candle breaks the streak instead of confirming', () => {
    const c1 = candle(BASE, 4669, 4672);
    const c2 = candle(BASE + FIVE_MIN, 4672, 4678);
    const c3 = candle(BASE + 2 * FIVE_MIN, 4678, 4674); // down candle
    const { output, events } = runCandles([c1, c2, c3]);

    expect(events.find((e) => e.type === 'SIGNAL_CONFIRMED')).toBeUndefined();
    expect(output.phase).toBe('ANALYZING_15M'); // fresh 1-candle DOWN streak starts from c3
    expect(output.movementDirection).toBe('DOWN');
    expect(output.movementStartPrice).toBe(4678); // c3.open
  });

  it('a flat (doji) candle breaks the streak without starting a new one', () => {
    const c1 = candle(BASE, 4669, 4672);
    const c2 = candle(BASE + FIVE_MIN, 4672, 4678);
    const c3 = candle(BASE + 2 * FIVE_MIN, 4678, 4678); // flat: close === open
    const { output } = runCandles([c1, c2, c3]);

    expect(output.phase).toBe('WAITING');
    expect(output.movementDirection).toBeNull();
  });

  it('four consecutive up candles still confirm on exactly the 3rd, not later', () => {
    const c1 = candle(BASE, 4669, 4672);
    const c2 = candle(BASE + FIVE_MIN, 4672, 4678);
    const c3 = candle(BASE + 2 * FIVE_MIN, 4678, 4685);
    const c4 = candle(BASE + 3 * FIVE_MIN, 4685, 4690);
    const { events } = runCandles([c1, c2, c3, c4]);
    const confirmations = events.filter((e) => e.type === 'SIGNAL_CONFIRMED');
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0]).toMatchObject({ entryPrice: 4685 });
  });
});

describe('Stop Loss (sections 7, 9, 29)', () => {
  it('closes a BUY position when price falls to/below the 1st candle open', () => {
    const c1 = candle(BASE, 4669, 4672);
    const c2 = candle(BASE + FIVE_MIN, 4672, 4678);
    const c3 = candle(BASE + 2 * FIVE_MIN, 4678, 4685);
    const { state } = runCandles([c1, c2, c3]);
    expect(state.activePosition?.stopLoss).toBe(4669);

    const hit = step(state, { currentPrice: 4669, currentTime: BASE + 3 * FIVE_MIN, candles: [c1, c2, c3] });
    expect(hit.output.phase).toBe('STOP_LOSS_HIT');
    expect(hit.output.events[0]).toMatchObject({ type: 'STOP_LOSS_HIT', stopLoss: 4669, exitPrice: 4669, pnlPoints: 4669 - 4685 });
    expect(hit.state.activePosition).toBeNull();
  });

  it('closes a SELL position when price rises to/above the 1st candle open', () => {
    const c1 = candle(BASE, 4669, 4666);
    const c2 = candle(BASE + FIVE_MIN, 4666, 4660);
    const c3 = candle(BASE + 2 * FIVE_MIN, 4660, 4653);
    const { state } = runCandles([c1, c2, c3]);
    expect(state.activePosition?.stopLoss).toBe(4669);

    const hit = step(state, { currentPrice: 4669, currentTime: BASE + 3 * FIVE_MIN, candles: [c1, c2, c3] });
    expect(hit.output.phase).toBe('STOP_LOSS_HIT');
    expect(hit.output.events[0]).toMatchObject({ type: 'STOP_LOSS_HIT', exitPrice: 4669, pnlPoints: 4653 - 4669 });
  });
});

describe('Duplicate signal protection (sections 21, 47)', () => {
  it('does not re-confirm while a position from the same streak is still active', () => {
    const c1 = candle(BASE, 4669, 4672);
    const c2 = candle(BASE + FIVE_MIN, 4672, 4678);
    const c3 = candle(BASE + 2 * FIVE_MIN, 4678, 4685);
    const c4 = candle(BASE + 3 * FIVE_MIN, 4685, 4690); // still up, position already active
    const c5 = candle(BASE + 4 * FIVE_MIN, 4690, 4695);
    const { events } = runCandles([c1, c2, c3, c4, c5]);
    expect(events.filter((e) => e.type === 'SIGNAL_CONFIRMED')).toHaveLength(1);
  });

  it('allows a brand-new signal only after the previous position is resolved', () => {
    const c1 = candle(BASE, 4669, 4672);
    const c2 = candle(BASE + FIVE_MIN, 4672, 4678);
    const c3 = candle(BASE + 2 * FIVE_MIN, 4678, 4685);
    let { state } = runCandles([c1, c2, c3]);
    expect(state.activePosition).not.toBeNull();

    const allSoFar = [
      candle(c1.time - FIVE_MIN, c1.open, c1.open), // the harness's own warm-up candle
      c1,
      c2,
      c3,
    ];

    const stopTick = step(state, { currentPrice: 4669, currentTime: BASE + 3 * FIVE_MIN, candles: allSoFar });
    state = stopTick.state;
    expect(state.activePosition).toBeNull();

    const c4 = candle(BASE + 3 * FIVE_MIN, 4700, 4705);
    const c5 = candle(BASE + 4 * FIVE_MIN, 4705, 4710);
    const c6 = candle(BASE + 5 * FIVE_MIN, 4710, 4715);

    const secondEvents = [];
    for (const c of [c4, c5, c6]) {
      const r = step(state, { currentPrice: c.close, currentTime: c.time + FIVE_MIN, candles: [...allSoFar, c4, c5, c6] });
      state = r.state;
      secondEvents.push(...r.output.events);
    }

    const confirmed = secondEvents.find((e) => e.type === 'SIGNAL_CONFIRMED');
    expect(confirmed).toBeDefined();
    expect(state.signalHistory).toHaveLength(2);
    expect(state.signalHistory[0].signalId).not.toBe(state.signalHistory[1].signalId);
  });
});

describe('Manual close (section 10)', () => {
  it('closes the active position on demand and computes pnlPoints', () => {
    const c1 = candle(BASE, 4669, 4672);
    const c2 = candle(BASE + FIVE_MIN, 4672, 4678);
    const c3 = candle(BASE + 2 * FIVE_MIN, 4678, 4685);
    const { state } = runCandles([c1, c2, c3]);

    const { state: closedState, event } = closeActivePosition(state, 4700, BASE + 3 * FIVE_MIN);
    expect(event).toMatchObject({ type: 'MANUAL_CLOSE', exitPrice: 4700, pnlPoints: 4700 - 4685 });
    expect(closedState.phase).toBe('CLOSED');
    expect(closedState.activePosition).toBeNull();
  });
});

describe('Pause / resume analysis', () => {
  /** Steps once per candle at its close; `pausedFor(c)` decides whether that tick runs paused. */
  function runWithPause(realCandles: Candle[], pausedFor: (c: Candle) => boolean, initial = createInitialState()) {
    const warmup = candle(realCandles[0].time - FIVE_MIN, realCandles[0].open, realCandles[0].open);
    const all = [warmup, ...realCandles];
    let state = initial;
    const outputs = [];
    for (const c of all) {
      const r = step(state, { currentPrice: c.close, currentTime: c.time + FIVE_MIN, candles: all, paused: pausedFor(c) });
      state = r.state;
      outputs.push(r.output);
    }
    return { state, outputs, events: outputs.flatMap((o) => o.events) };
  }

  it('tracks no movement while paused and reports the PAUSED phase', () => {
    const ups = [0, 1, 2, 3].map((i) => candle(BASE + i * FIVE_MIN, 4669 + i * 5, 4674 + i * 5));
    const { outputs, events } = runWithPause(ups, () => true);
    expect(events).toHaveLength(0);
    expect(outputs.at(-1)).toMatchObject({ phase: 'PAUSED', paused: true, signal: 'WAIT', movementDuration: 0 });
  });

  it('candles that closed during the pause never count after resuming', () => {
    const ups = [0, 1, 2, 3, 4].map((i) => candle(BASE + i * FIVE_MIN, 4669 + i * 5, 4674 + i * 5));
    // First 3 up candles close while paused, then 2 more after resume: only 2 count -> no signal yet.
    const { outputs, events } = runWithPause(ups, (c) => c.time < BASE + 3 * FIVE_MIN);
    expect(events).toHaveLength(0);
    expect(outputs.at(-1)).toMatchObject({ phase: 'BUY_READY', paused: false, movementDuration: 10 });
  });

  it('a half-built streak is dropped by a pause', () => {
    const c1 = candle(BASE, 4669, 4672);
    const c2 = candle(BASE + FIVE_MIN, 4672, 4678);
    let { state } = runWithPause([c1, c2], () => false);
    expect(state.phase).toBe('BUY_READY');

    state = step(state, { currentPrice: 4678, currentTime: BASE + 2 * FIVE_MIN + 1000, candles: [c1, c2], paused: true }).state;
    expect(state.streak).toBeNull();

    const c3 = candle(BASE + 2 * FIVE_MIN, 4678, 4685);
    const resumed = step(state, { currentPrice: 4685, currentTime: BASE + 3 * FIVE_MIN, candles: [c1, c2, c3] });
    expect(resumed.output.events).toHaveLength(0);
    expect(resumed.output.phase).toBe('ANALYZING_15M');
  });

  it('keeps monitoring the Stop Loss of an open position while paused', () => {
    const c1 = candle(BASE, 4669, 4672);
    const c2 = candle(BASE + FIVE_MIN, 4672, 4678);
    const c3 = candle(BASE + 2 * FIVE_MIN, 4678, 4685);
    const { state } = runWithPause([c1, c2, c3], () => false);
    expect(state.activePosition).not.toBeNull();

    const held = step(state, { currentPrice: 4680, currentTime: BASE + 3 * FIVE_MIN + 1000, candles: [c1, c2, c3], paused: true });
    expect(held.output).toMatchObject({ phase: 'BUY_ACTIVE', signal: 'BUY', paused: true });

    const hit = step(held.state, { currentPrice: 4668, currentTime: BASE + 3 * FIVE_MIN + 2000, candles: [c1, c2, c3], paused: true });
    expect(hit.output.events[0]).toMatchObject({ type: 'STOP_LOSS_HIT', exitPrice: 4668 });
    expect(hit.output.phase).toBe('STOP_LOSS_HIT');

    const after = step(hit.state, { currentPrice: 4668, currentTime: BASE + 3 * FIVE_MIN + 3000, candles: [c1, c2, c3], paused: true });
    expect(after.output.phase).toBe('PAUSED');
  });
});
