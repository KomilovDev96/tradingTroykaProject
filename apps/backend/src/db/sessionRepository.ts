import { prisma } from './prisma';

export interface RangeSnapshot {
  rangeStart: number;
  rangeEnd: number;
  highDemand: number;
  lowDemand: number;
  rangePoints: number;
  upperLevel: number;
  lowerLevel: number;
}

/**
 * Section 42: every confirmed signal freezes the (continuously-rolling) 3H range that was
 * in effect at confirmation time into its own TradingSession row, so a trade's levels stay
 * legible in history even as the live rolling window moves on.
 */
export async function createTradingSession(symbol: string, strategy: string, snapshot: RangeSnapshot) {
  return prisma.tradingSession.create({
    data: {
      symbol,
      strategy,
      startTime: new Date(snapshot.rangeStart),
      endTime: new Date(snapshot.rangeEnd),
      highDemand: snapshot.highDemand,
      lowDemand: snapshot.lowDemand,
      rangePoints: snapshot.rangePoints,
      upperLevel: snapshot.upperLevel,
      lowerLevel: snapshot.lowerLevel,
    },
  });
}
