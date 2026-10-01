import { useState } from 'react';
import { Space } from 'antd';
import {
  useByDayStatsQuery,
  useByDirectionStatsQuery,
  usePnlCurveQuery,
  useStopLossStatsQuery,
  useSummaryStatsQuery,
} from '../../entities/trade/api/queries';
import { useMarketStore } from '../../entities/market/model/store';
import { PeriodSelector } from '../../shared/ui/PeriodSelector';
import { resolvePeriod, type PeriodKey, type PeriodRange } from '../../shared/lib/period';
import { SummaryStatCards } from '../../widgets/stats-cards/SummaryStatCards';
import { ByDirectionStatsCard, DayOfWeekTable, StopLossStatsCard } from '../../widgets/stats-cards/BreakdownStats';
import { PnlChart } from '../../widgets/pnl-chart/PnlChart';

export function AnalyticsPage() {
  const timezone = useMarketStore((s) => s.timezone);
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [customRange, setCustomRange] = useState<PeriodRange>();

  const { from, to } = resolvePeriod(period, timezone, customRange);

  const summary = useSummaryStatsQuery(from, to);
  const byDirection = useByDirectionStatsQuery(from, to);
  const stopLoss = useStopLossStatsQuery(from, to);
  const byDay = useByDayStatsQuery(from, to, timezone);
  const pnlCurve = usePnlCurveQuery();

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', padding: 24 }}>
      <PeriodSelector period={period} onPeriodChange={setPeriod} customRange={customRange} onCustomRangeChange={setCustomRange} />

      <SummaryStatCards title="Статистика" stats={summary.data} loading={summary.isLoading} />
      <ByDirectionStatsCard stats={byDirection.data} loading={byDirection.isLoading} />
      <StopLossStatsCard stats={stopLoss.data} loading={stopLoss.isLoading} />
      <DayOfWeekTable data={byDay.data} loading={byDay.isLoading} />
      <PnlChart data={pnlCurve.data} loading={pnlCurve.isLoading} height={300} />
    </Space>
  );
}
