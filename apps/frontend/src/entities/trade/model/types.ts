export type TradeDirection = 'BUY' | 'SELL';
export type TradeStatus = 'OPEN' | 'CLOSED' | 'STOP_LOSS';
export type TradeResult = 'PROFIT' | 'STOP_LOSS' | 'MANUAL_CLOSE';

export interface TradeDTO {
  id: string;
  symbol: string;
  direction: TradeDirection;
  status: TradeStatus;
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
  /** Long-term (TROYKA_H1) only: speedometer targets frozen at entry. */
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
  result: TradeResult | null;
  signalId: string;
  createdAt: number;
  updatedAt: number;
}

export interface TradeFilters {
  from?: number;
  to?: number;
  symbol?: string;
  direction?: TradeDirection;
  result?: TradeResult;
  status?: TradeStatus;
  strategy?: string;
}

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

export interface StopLossStats {
  total: number;
  buy: number;
  sell: number;
  avgLoss: number;
  maxLoss: number;
}

export interface DayOfWeekStats {
  day: string;
  trades: number;
  profit: number;
  stopLoss: number;
  net: number;
}

export interface PnlCurvePoint {
  tradeIndex: number;
  time: number;
  pnlPoints: number;
  cumulative: number;
}
