import { describe, expect, it } from 'vitest';
import {
  Candle,
  closeLongTermPosition,
  computeSpeedometer,
  createLongTermState,
  LONG_TERM_SL_BUFFER_POINTS,
  ONE_DAY_MS,
  ONE_HOUR_MS,
  stepLongTerm,
  type LongTermState,
  type Speedometer,
} from '../src';

const H = ONE_HOUR_MS;
const BASE = Date.UTC(2026, 0, 5, 8, 0, 0); // Monday 08:00 UTC
// Daily speed 30 → step 10, TP1/2/3 = 30/60/90 points from entry.
const SPEED: Speedometer = { lookbackDays: 8, dailySpeed: 30, hourlySpeed: 1.25, step: 10 };

function candle(i: number, open: number, close: number, wick = 1): Candle {
  return { time: BASE + i * H, open, high: Math.max(open, close) + wick, low: Math.min(open, close) - wick, close };
}

/** A closed candle before the sequence, so the first tick has history to start from (it never replays it). */
const WARMUP: Candle = { time: BASE - H, open: 100, high: 100, low: 100, close: 100 };

/** One tick right after each candle closes, priced at that candle's close; a warm-up tick first (no history replay). */
function run(candles: Candle[], speedometer: Speedometer | null = SPEED) {
  let state: LongTermState = createLongTermState();
  state = stepLongTerm(state, { currentPrice: candles[0].open, currentTime: candles[0].time, candles: [WARMUP], speedometer }).state;
  const events = [];
  let output;
  for (let i = 0; i < candles.length; i++) {
    const visible = candles.slice(0, i + 1);
    // The next candle starts printing at its own open: include it when it exists.
    const next = candles[i + 1];
    const input = next
      ? { currentPrice: next.open, currentTime: next.time, candles: [...visible, { ...next, high: next.open, low: next.open, close: next.open }] }
      : { currentPrice: candles[i].close, currentTime: candles[i].time + H, candles: visible };
    const r = stepLongTerm(state, { ...input, speedometer });
    state = r.state;
    output = r.output;
    events.push(...r.output.events);
  }
  return { state, output: output!, events };
}

describe('Speedometer (section 3, ADR method)', () => {
  const day = (i: number, range: number): Candle => ({ time: Date.UTC(2026, 0, 1) + i * ONE_DAY_MS, open: 100, high: 100 + range, low: 100, close: 100 });

  it('averages High−Low of the last 8 completed days; step = daily / 3', () => {
    const days = [day(0, 999), ...[10, 20, 30, 40, 50, 60, 70, 80].map((r, i) => day(i + 1, r)), day(9, 500)];
    const now = Date.UTC(2026, 0, 1) + 9 * ONE_DAY_MS + 5 * H; // day 9 still forming
    const s = computeSpeedometer(days, now)!;
    expect(s.dailySpeed).toBe(45);
    expect(s.hourlySpeed).toBeCloseTo(45 / 24);
    expect(s.step).toBe(15);
  });

  it('needs 8 completed days and ignores a truncated (unaligned) first bucket', () => {
    const days = [{ ...day(0, 999), time: Date.UTC(2026, 0, 1, 7) }, ...[1, 2, 3, 4, 5, 6, 7].map((i) => day(i, 10))];
    expect(computeSpeedometer(days, Date.UTC(2026, 0, 20))).toBeNull();
  });
});

describe('H1 troika entry (section 2)', () => {
  it('3 green H1 candles → BUY at the 4th candle open, SL = lowest low − buffer, TPs from speed', () => {
    const c = [candle(0, 100, 103), candle(1, 103, 106), candle(2, 106, 109), candle(3, 109.5, 110)];
    const { events } = run(c);
    const signal = events.find((e) => e.type === 'SIGNAL_CONFIRMED');
    expect(signal).toBeDefined();
    if (signal?.type !== 'SIGNAL_CONFIRMED') return;
    expect(signal.position).toMatchObject({
      direction: 'BUY',
      entryPrice: 109.5,
      stopLoss: 99 - LONG_TERM_SL_BUFFER_POINTS,
      step1Price: 119.5,
      step2Price: 129.5,
      takeProfit1: 139.5,
      takeProfit2: 169.5,
      takeProfit3: 199.5,
      confirmationTime: c[3].time,
    });
  });

  it('3 red H1 candles → SELL, SL = highest high + buffer', () => {
    const c = [candle(0, 110, 107), candle(1, 107, 104), candle(2, 104, 101), candle(3, 100.5, 100)];
    const { events } = run(c);
    const signal = events.find((e) => e.type === 'SIGNAL_CONFIRMED');
    if (signal?.type !== 'SIGNAL_CONFIRMED') throw new Error('no signal');
    expect(signal.position).toMatchObject({ direction: 'SELL', entryPrice: 100.5, stopLoss: 111 + LONG_TERM_SL_BUFFER_POINTS, takeProfit3: 10.5 });
  });

  it('2 candles only → still analysing, no signal', () => {
    const { output, events } = run([candle(0, 100, 103), candle(1, 103, 106)]);
    expect(events).toEqual([]);
    expect(output.phase).toBe('ANALYZING_H1');
    expect(output.movementCandles).toBe(2);
  });

  it('a doji or opposite candle breaks the run', () => {
    const { events } = run([candle(0, 100, 103), candle(1, 103, 103), candle(2, 103, 106), candle(3, 106, 104)]);
    expect(events.find((e) => e.type === 'SIGNAL_CONFIRMED')).toBeUndefined();
  });

  it('no speedometer yet → the troika is skipped', () => {
    const { events, output } = run([candle(0, 100, 103), candle(1, 103, 106), candle(2, 106, 109), candle(3, 109, 110)], null);
    expect(events).toEqual([]);
    expect(output.phase).toBe('NO_SPEED');
  });
});

describe('Only First Troika + Single Active Trade (sections 2, 6)', () => {
  it('4th and 5th green candles never signal again, even after the first trade stopped out', () => {
    // BUY at 109.5, SL 98. Candle 3 dives to 97 → stop; candles 4-5 green again: no new troika.
    const c = [
      candle(0, 100, 103),
      candle(1, 103, 106),
      candle(2, 106, 109),
      { time: BASE + 3 * H, open: 109.5, high: 110, low: 97, close: 109.6 },
      candle(4, 109.6, 112),
      candle(5, 112, 115),
      candle(6, 115, 118),
    ];
    let state = createLongTermState();
    state = stepLongTerm(state, { currentPrice: 100, currentTime: BASE, candles: [WARMUP], speedometer: SPEED }).state;
    const events = [];
    for (let i = 0; i < c.length; i++) {
      const r = stepLongTerm(state, { currentPrice: c[i].close, currentTime: c[i].time + H, candles: c.slice(0, i + 2), speedometer: SPEED });
      state = r.state;
      events.push(...r.output.events);
      if (i === 3) {
        // Mid-candle dip to 97 hits the stop.
        const dip = stepLongTerm(state, { currentPrice: 97, currentTime: c[3].time + H + 1, candles: c.slice(0, 5), speedometer: SPEED });
        state = dip.state;
        events.push(...dip.output.events);
      }
    }
    expect(events.filter((e) => e.type === 'SIGNAL_CONFIRMED')).toHaveLength(1);
  });

  it('after an opposite candle a fresh troika signals again', () => {
    const c = [
      candle(0, 100, 103),
      candle(1, 103, 106),
      candle(2, 106, 109),
      candle(3, 109.5, 108), // red: breaks the block
    ];
    const { state } = run(c);
    const closed = closeLongTermPosition(state, 108, c[3].time + H).state;
    const more = [candle(4, 108, 110), candle(5, 110, 112), candle(6, 112, 114), candle(7, 114.2, 115)];
    let s = closed;
    const events = [];
    const all = [...c, ...more];
    for (let i = 4; i < all.length; i++) {
      const r = stepLongTerm(s, { currentPrice: all[i].open, currentTime: all[i].time + H, candles: all.slice(0, i + 1), speedometer: SPEED });
      s = r.state;
      events.push(...r.output.events);
    }
    expect(events.filter((e) => e.type === 'SIGNAL_CONFIRMED')).toHaveLength(1);
  });
});

describe('Breakeven steps and take profit (section 4)', () => {
  const c = [candle(0, 100, 103), candle(1, 103, 106), candle(2, 106, 109), candle(3, 109.5, 110)];
  const t = (n: number) => c[3].time + H + n * 1000;

  function opened() {
    return run(c).state;
  }

  it('Step 1 → SL to entry (breakeven); Step 2 → SL to the Step 1 price; TP1/TP2 marked', () => {
    let state = opened();
    let r = stepLongTerm(state, { currentPrice: 119.5, currentTime: t(1), candles: c, speedometer: SPEED });
    expect(r.output.position?.stopLoss).toBe(109.5);
    expect(r.output.events[0]).toMatchObject({ type: 'STOP_LOSS_MOVED', stage: 1, stopLoss: 109.5 });
    state = r.state;

    r = stepLongTerm(state, { currentPrice: 140, currentTime: t(2), candles: c, speedometer: SPEED });
    expect(r.output.position?.stopLoss).toBe(119.5);
    expect(r.output.position?.stage).toBe(2);
    expect(r.output.events.map((e) => e.type)).toEqual(['STOP_LOSS_MOVED', 'TARGET_REACHED']);
    state = r.state;

    r = stepLongTerm(state, { currentPrice: 119.5, currentTime: t(3), candles: c, speedometer: SPEED });
    expect(r.output.phase).toBe('STOP_LOSS_HIT');
    expect(r.output.events[0]).toMatchObject({ type: 'POSITION_CLOSED', reason: 'STOP_LOSS', pnlPoints: 10 });
  });

  it('TP3 (3x daily speed) closes the whole position', () => {
    const r = stepLongTerm(opened(), { currentPrice: 200, currentTime: t(1), candles: c, speedometer: SPEED });
    expect(r.output.phase).toBe('TAKE_PROFIT_HIT');
    expect(r.output.events.at(-1)).toMatchObject({ type: 'POSITION_CLOSED', reason: 'TAKE_PROFIT', pnlPoints: 90.5 });
    expect(r.output.position).toBeNull();
  });

  it('the initial stop closes at a loss', () => {
    const r = stepLongTerm(opened(), { currentPrice: 98, currentTime: t(1), candles: c, speedometer: SPEED });
    expect(r.output.events[0]).toMatchObject({ type: 'POSITION_CLOSED', reason: 'STOP_LOSS', pnlPoints: -11.5 });
  });

  it('reports R:R to TP3 from the initial stop', () => {
    const r = stepLongTerm(opened(), { currentPrice: 110, currentTime: t(1), candles: c, speedometer: SPEED });
    expect(r.output.riskReward).toBeCloseTo(90 / 11.5);
  });
});
