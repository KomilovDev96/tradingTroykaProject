import { useQuery } from '@tanstack/react-query';
import { getJson } from '../../../shared/api/httpClient';
import type {
  ByDirectionStats,
  DayOfWeekStats,
  PnlCurvePoint,
  StopLossStats,
  SummaryStats,
  TradeDTO,
  TradeFilters,
} from '../model/types';
import type { StrategyId } from '../../strategy/model/types';

/** Without a strategy: open positions of both strategies (the trade journal). */
export function useOpenTradesQuery(strategy?: StrategyId) {
  return useQuery({
    queryKey: ['open-trades', strategy],
    queryFn: () => getJson<TradeDTO[]>('/api/trades/open', { strategy }),
    refetchInterval: 5000,
  });
}

export function useTradesQuery(filters: TradeFilters) {
  return useQuery({
    queryKey: ['trades', filters],
    queryFn: () =>
      getJson<TradeDTO[]>('/api/trades', {
        from: filters.from,
        to: filters.to,
        symbol: filters.symbol,
        direction: filters.direction,
        result: filters.result,
        status: filters.status,
        strategy: filters.strategy,
      }),
  });
}

export function useSummaryStatsQuery(from: number, to: number, strategy?: StrategyId) {
  return useQuery({
    queryKey: ['stats', 'summary', from, to, strategy],
    queryFn: () => getJson<SummaryStats>('/api/stats/summary', { from, to, strategy }),
  });
}

export function useByDirectionStatsQuery(from: number, to: number, strategy?: StrategyId) {
  return useQuery({
    queryKey: ['stats', 'by-direction', from, to, strategy],
    queryFn: () => getJson<ByDirectionStats>('/api/stats/by-direction', { from, to, strategy }),
  });
}

export function useStopLossStatsQuery(from: number, to: number, strategy?: StrategyId) {
  return useQuery({
    queryKey: ['stats', 'stoploss', from, to, strategy],
    queryFn: () => getJson<StopLossStats>('/api/stats/stoploss', { from, to, strategy }),
  });
}

export function useByDayStatsQuery(from: number, to: number, timezone: string, strategy?: StrategyId) {
  return useQuery({
    queryKey: ['stats', 'by-day', from, to, timezone, strategy],
    queryFn: () => getJson<DayOfWeekStats[]>('/api/stats/by-day', { from, to, timezone, strategy }),
  });
}

export function usePnlCurveQuery(strategy?: StrategyId) {
  return useQuery({
    queryKey: ['stats', 'pnl-curve', strategy],
    queryFn: () => getJson<PnlCurvePoint[]>('/api/stats/pnl-curve', { strategy }),
  });
}
