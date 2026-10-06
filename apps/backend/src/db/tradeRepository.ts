import type { Direction, Trade } from '@prisma/client';
import { prisma } from './prisma';

export function buildSignalId(strategy: string, symbol: string, movementStartTime: number, direction: Direction) {
  return `${strategy}|${symbol}|${movementStartTime}|${direction}`;
}

export interface TradeDTO {
  id: string;
  accountId: string | null;
  symbol: string;
  direction: 'BUY' | 'SELL';
  status: 'OPEN' | 'CLOSED' | 'STOP_LOSS';
  strategy: string;
  timeframe: string;
  sessionId: string;
  rangeStart: number;
  rangeEnd: number;
  highDemand: number;
  lowDemand: number;
  rangePoints: number;
  upperLevel: number;
  lowerLevel: number;
  movementStartTime: number;
  movementStartPrice: number;
  confirmationTime: number;
  entryPrice: number;
  stopLoss: number;
  /** Long-term (TROYKA_H1) only, null for scalping. */
  dailySpeed: number | null;
  breakevenStep: number | null;
  initialStopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfit3: number | null;
  stage: number;
  targetsHit: number;
  exitPrice: number | null;
  exitTime: number | null;
  pnlPoints: number | null;
  result: 'PROFIT' | 'STOP_LOSS' | 'MANUAL_CLOSE' | null;
  signalId: string;
  createdAt: number;
  updatedAt: number;
}

function toDTO(trade: Trade): TradeDTO {
  return {
    id: trade.id,
    accountId: trade.accountId,
    symbol: trade.symbol,
    direction: trade.direction,
    status: trade.status,
    strategy: trade.strategy,
    timeframe: trade.timeframe,
    sessionId: trade.sessionId,
    rangeStart: trade.rangeStart.getTime(),
    rangeEnd: trade.rangeEnd.getTime(),
    highDemand: Number(trade.highDemand),
    lowDemand: Number(trade.lowDemand),
    rangePoints: Number(trade.rangePoints),
    upperLevel: Number(trade.upperLevel),
    lowerLevel: Number(trade.lowerLevel),
    movementStartTime: trade.movementStartTime.getTime(),
    movementStartPrice: Number(trade.movementStartPrice),
    confirmationTime: trade.confirmationTime.getTime(),
    entryPrice: Number(trade.entryPrice),
    stopLoss: Number(trade.stopLoss),
    dailySpeed: trade.dailySpeed !== null ? Number(trade.dailySpeed) : null,
    breakevenStep: trade.breakevenStep !== null ? Number(trade.breakevenStep) : null,
    initialStopLoss: trade.initialStopLoss !== null ? Number(trade.initialStopLoss) : null,
    takeProfit1: trade.takeProfit1 !== null ? Number(trade.takeProfit1) : null,
    takeProfit2: trade.takeProfit2 !== null ? Number(trade.takeProfit2) : null,
    takeProfit3: trade.takeProfit3 !== null ? Number(trade.takeProfit3) : null,
    stage: trade.stage,
    targetsHit: trade.targetsHit,
    exitPrice: trade.exitPrice !== null ? Number(trade.exitPrice) : null,
    exitTime: trade.exitTime?.getTime() ?? null,
    pnlPoints: trade.pnlPoints !== null ? Number(trade.pnlPoints) : null,
    result: trade.result,
    signalId: trade.signalId,
    createdAt: trade.createdAt.getTime(),
    updatedAt: trade.updatedAt.getTime(),
  };
}

export interface CreateTradeParams {
  userId: string;
  symbol: string;
  strategy: string;
  timeframe: string;
  sessionId: string;
  direction: 'BUY' | 'SELL';
  rangeStart: number;
  rangeEnd: number;
  highDemand: number;
  lowDemand: number;
  rangePoints: number;
  upperLevel: number;
  lowerLevel: number;
  movementStartTime: number;
  movementStartPrice: number;
  confirmationTime: number;
  entryPrice: number;
  stopLoss: number;
  /** Long-term strategy: the speedometer targets frozen at entry. */
  longTerm?: {
    dailySpeed: number;
    breakevenStep: number;
    takeProfit1: number;
    takeProfit2: number;
    takeProfit3: number;
    stage: number;
    targetsHit: number;
  };
}

/**
 * Opens this signal's position for every given account in one statement. Section 47: idempotent
 * per (signalId, account) — a retry or duplicate tick never creates a second row for anyone.
 */
export async function createTradesForSignal(params: CreateTradeParams, accountIds: string[]): Promise<number> {
  const signalId = buildSignalId(params.strategy, params.symbol, params.movementStartTime, params.direction);
  const { count } = await prisma.trade.createMany({
    skipDuplicates: true,
    data: accountIds.map((accountId) => ({
      accountId,
      userId: params.userId,
      symbol: params.symbol,
      direction: params.direction,
      strategy: params.strategy,
      timeframe: params.timeframe,
      sessionId: params.sessionId,
      rangeStart: new Date(params.rangeStart),
      rangeEnd: new Date(params.rangeEnd),
      highDemand: params.highDemand,
      lowDemand: params.lowDemand,
      rangePoints: params.rangePoints,
      upperLevel: params.upperLevel,
      lowerLevel: params.lowerLevel,
      movementStartTime: new Date(params.movementStartTime),
      movementStartPrice: params.movementStartPrice,
      confirmationTime: new Date(params.confirmationTime),
      entryPrice: params.entryPrice,
      stopLoss: params.stopLoss,
      ...(params.longTerm ? { ...params.longTerm, initialStopLoss: params.stopLoss } : {}),
      signalId,
    })),
  });
  return count;
}

/**
 * A stop loss ends the movement for everyone still holding it. After the trailing stop pulled it
 * into profit, the exit is booked as PROFIT.
 */
export async function closeTradeByStopLoss(signalId: string, exitPrice: number, exitTime: number, pnlPoints: number) {
  const result = pnlPoints > 0 ? 'PROFIT' : 'STOP_LOSS';
  const trade = await prisma.trade.updateMany({
    where: { signalId, status: 'OPEN' },
    data: { status: 'STOP_LOSS', result, exitPrice, exitTime: new Date(exitTime), pnlPoints },
  });
  return trade.count > 0;
}

/** Trailing stop / breakeven step: moves the Stop Loss of everyone still holding this signal's position. */
export async function moveStopLoss(signalId: string, stopLoss: number, stage?: number) {
  await prisma.trade.updateMany({ where: { signalId, status: 'OPEN' }, data: { stopLoss, ...(stage !== undefined ? { stage } : {}) } });
}

/** Long-term: TP1/TP2 reached while the position stays open. */
export async function markTargetsHit(signalId: string, targetsHit: number) {
  await prisma.trade.updateMany({ where: { signalId, status: 'OPEN' }, data: { targetsHit } });
}

/** Long-term: TP3 closes the movement for everyone still holding it. */
export async function closeTradeByTakeProfit(signalId: string, exitPrice: number, exitTime: number, pnlPoints: number) {
  const trade = await prisma.trade.updateMany({
    where: { signalId, status: 'OPEN' },
    data: { status: 'CLOSED', result: 'PROFIT', exitPrice, exitTime: new Date(exitTime), pnlPoints },
  });
  return trade.count > 0;
}

/**
 * Section 30/31: closes only this account's position, booked as PROFIT if it closed in the green,
 * otherwise MANUAL_CLOSE. Everyone else keeps theirs.
 */
export async function closeTradeManually(signalId: string, accountId: string, exitPrice: number, exitTime: number, pnlPoints: number) {
  const result = pnlPoints > 0 ? 'PROFIT' : 'MANUAL_CLOSE';
  const trade = await prisma.trade.updateMany({
    where: { signalId, accountId, status: 'OPEN' },
    data: { status: 'CLOSED', result, exitPrice, exitTime: new Date(exitTime), pnlPoints },
  });
  return trade.count > 0;
}

export async function countOpenTradesForSignal(signalId: string): Promise<number> {
  return prisma.trade.count({ where: { signalId, status: 'OPEN' } });
}

/** Without `accountId`: every open row (used to restore the engine's position on boot). */
export async function getOpenTrades(symbol?: string, accountId?: string, strategy?: string): Promise<TradeDTO[]> {
  const trades = await prisma.trade.findMany({
    where: { status: 'OPEN', ...(symbol ? { symbol } : {}), ...(accountId ? { accountId } : {}), ...(strategy ? { strategy } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return trades.map(toDTO);
}

export interface TradeFilters {
  from?: number;
  to?: number;
  symbol?: string;
  direction?: 'BUY' | 'SELL';
  result?: 'PROFIT' | 'STOP_LOSS' | 'MANUAL_CLOSE';
  status?: 'OPEN' | 'CLOSED' | 'STOP_LOSS';
  strategy?: string;
  accountId?: string;
}

export async function listTrades(filters: TradeFilters): Promise<TradeDTO[]> {
  const trades = await prisma.trade.findMany({
    where: {
      ...(filters.symbol ? { symbol: filters.symbol } : {}),
      ...(filters.direction ? { direction: filters.direction } : {}),
      ...(filters.result ? { result: filters.result } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.strategy ? { strategy: filters.strategy } : {}),
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return trades.map(toDTO);
}

/** Trades whose lifecycle (open or closed) touches the given window — used for statistics. */
export async function getClosedTradesInRange(from: number, to: number, symbol?: string, accountId?: string, strategy?: string): Promise<TradeDTO[]> {
  const trades = await prisma.trade.findMany({
    where: {
      status: { not: 'OPEN' },
      ...(accountId ? { accountId } : {}),
      ...(strategy ? { strategy } : {}),
      exitTime: { gte: new Date(from), lte: new Date(to) },
      ...(symbol ? { symbol } : {}),
    },
    orderBy: { exitTime: 'asc' },
  });
  return trades.map(toDTO);
}

export async function getAllClosedTrades(symbol?: string, accountId?: string, strategy?: string): Promise<TradeDTO[]> {
  const trades = await prisma.trade.findMany({
    where: { status: { not: 'OPEN' }, ...(symbol ? { symbol } : {}), ...(accountId ? { accountId } : {}), ...(strategy ? { strategy } : {}) },
    orderBy: { exitTime: 'asc' },
  });
  return trades.map(toDTO);
}

/** accountId → number of positions it currently holds open. */
export async function countOpenTradesByAccount(): Promise<Map<string, number>> {
  const rows = await prisma.trade.groupBy({ by: ['accountId'], where: { status: 'OPEN', accountId: { not: null } }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.accountId as string, r._count._all]));
}
