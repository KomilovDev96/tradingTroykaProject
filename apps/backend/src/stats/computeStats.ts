import type { TradeDTO } from '../db/tradeRepository';

/** Pure aggregation over already-fetched closed trades — no I/O, easy to unit test. */

export interface SummaryStats {
  trades: number;
  profit: number;
  stopLoss: number;
  manualClose: number;
  winRate: number;
  profitPoints: number;
  lossPoints: number;
  net: number;
}

export function computeSummary(trades: TradeDTO[]): SummaryStats {
  const profit = trades.filter((t) => t.result === 'PROFIT').length;
  const stopLoss = trades.filter((t) => t.result === 'STOP_LOSS').length;
  const manualClose = trades.filter((t) => t.result === 'MANUAL_CLOSE').length;

  const profitPoints = trades.reduce((sum, t) => sum + (t.pnlPoints && t.pnlPoints > 0 ? t.pnlPoints : 0), 0);
  const lossPoints = trades.reduce((sum, t) => sum + (t.pnlPoints && t.pnlPoints < 0 ? t.pnlPoints : 0), 0);

  return {
    trades: trades.length,
    profit,
    stopLoss,
    manualClose,
    winRate: trades.length > 0 ? (profit / trades.length) * 100 : 0,
    profitPoints,
    lossPoints,
    net: profitPoints + lossPoints,
  };
}

export interface DirectionStats {
  total: number;
  profit: number;
  stopLoss: number;
  winRate: number;
  netPoints: number;
}

export interface ByDirectionStats {
  BUY: DirectionStats;
  SELL: DirectionStats;
}

function directionStats(trades: TradeDTO[]): DirectionStats {
  const profit = trades.filter((t) => t.result === 'PROFIT').length;
  const stopLoss = trades.filter((t) => t.result === 'STOP_LOSS').length;
  const netPoints = trades.reduce((sum, t) => sum + (t.pnlPoints ?? 0), 0);
  return { total: trades.length, profit, stopLoss, winRate: trades.length > 0 ? (profit / trades.length) * 100 : 0, netPoints };
}

export function computeByDirection(trades: TradeDTO[]): ByDirectionStats {
  return {
    BUY: directionStats(trades.filter((t) => t.direction === 'BUY')),
    SELL: directionStats(trades.filter((t) => t.direction === 'SELL')),
  };
}

export interface StopLossStats {
  total: number;
  buy: number;
  sell: number;
  avgLoss: number;
  maxLoss: number;
}

export function computeStopLossStats(trades: TradeDTO[]): StopLossStats {
  const stopLossTrades = trades.filter((t) => t.result === 'STOP_LOSS');
  const losses = stopLossTrades.map((t) => t.pnlPoints ?? 0);
  return {
    total: stopLossTrades.length,
    buy: stopLossTrades.filter((t) => t.direction === 'BUY').length,
    sell: stopLossTrades.filter((t) => t.direction === 'SELL').length,
    avgLoss: losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0,
    maxLoss: losses.length > 0 ? Math.min(...losses) : 0,
  };
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface DayOfWeekStats {
  day: string;
  trades: number;
  profit: number;
  stopLoss: number;
  net: number;
}

function weekdayInTimezone(ms: number, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' }).format(new Date(ms));
}

/** Section 34 — grouped by the display timezone so "Monday" matches what the user sees elsewhere. */
export function computeByDayOfWeek(trades: TradeDTO[], timezone: string): DayOfWeekStats[] {
  return WEEKDAYS.map((day) => {
    const dayTrades = trades.filter((t) => t.exitTime !== null && weekdayInTimezone(t.exitTime, timezone) === day);
    const profit = dayTrades.filter((t) => t.result === 'PROFIT').length;
    const stopLoss = dayTrades.filter((t) => t.result === 'STOP_LOSS').length;
    const net = dayTrades.reduce((sum, t) => sum + (t.pnlPoints ?? 0), 0);
    return { day, trades: dayTrades.length, profit, stopLoss, net };
  });
}

export interface PnlCurvePoint {
  tradeIndex: number;
  time: number;
  pnlPoints: number;
  cumulative: number;
}

/** Section 36 — cumulative P&L over time, built strictly from real closed trades in order. */
export function computePnlCurve(trades: TradeDTO[]): PnlCurvePoint[] {
  const sorted = [...trades].filter((t) => t.exitTime !== null).sort((a, b) => a.exitTime! - b.exitTime!);
  let cumulative = 0;
  return sorted.map((t, index) => {
    cumulative += t.pnlPoints ?? 0;
    return { tradeIndex: index + 1, time: t.exitTime!, pnlPoints: t.pnlPoints ?? 0, cumulative };
  });
}
