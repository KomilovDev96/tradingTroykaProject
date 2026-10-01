import { buildUrl } from '../../../shared/api/httpClient';
import type { TradeFilters } from '../../../entities/trade/model/types';

/** Section 44 — CSV export honors whatever filters Trade History currently has applied. */
export function exportTradesCsv(filters: TradeFilters) {
  const url = buildUrl('/api/trades/export.csv', {
    from: filters.from,
    to: filters.to,
    symbol: filters.symbol,
    direction: filters.direction,
    result: filters.result,
    status: filters.status,
    strategy: filters.strategy,
  });
  const link = document.createElement('a');
  link.href = url;
  link.download = 'trade-history.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
