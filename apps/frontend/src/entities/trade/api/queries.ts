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

export function useOpenTradesQuery() {
  return useQuery({
    queryKey: ['open-trades'],
    queryFn: () => getJson<TradeDTO[]>('/api/trades/open'),
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

export function useSummaryStatsQuery(from: number, to: number) {
  return useQuery({
    queryKey: ['stats', 'summary', from, to],
    queryFn: () => getJson<SummaryStats>('/api/stats/summary', { from, to }),
  });
}

export function useByDirectionStatsQuery(from: number, to: number) {
  return useQuery({
    queryKey: ['stats', 'by-direction', from, to],
    queryFn: () => getJson<ByDirectionStats>('/api/stats/by-direction', { from, to }),
  });
}

export function useStopLossStatsQuery(from: number, to: number) {
  return useQuery({
    queryKey: ['stats', 'stoploss', from, to],
    queryFn: () => getJson<StopLossStats>('/api/stats/stoploss', { from, to }),
  });
}

export function useByDayStatsQuery(from: number, to: number, timezone: string) {
  return useQuery({
    queryKey: ['stats', 'by-day', from, to, timezone],
    queryFn: () => getJson<DayOfWeekStats[]>('/api/stats/by-day', { from, to, timezone }),
  });
}

export function usePnlCurveQuery() {
  return useQuery({
    queryKey: ['stats', 'pnl-curve'],
    queryFn: () => getJson<PnlCurvePoint[]>('/api/stats/pnl-curve'),
  });
}
