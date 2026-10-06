import { useState } from 'react';
import { Segmented, Space } from 'antd';
import {
  useByDayStatsQuery,
  useByDirectionStatsQuery,
  usePnlCurveQuery,
  useStopLossStatsQuery,
  useSummaryStatsQuery,
} from '../../entities/trade/api/queries';
import { useMarketStore } from '../../entities/market/model/store';
import { LONG_TERM, SCALPING, type StrategyId } from '../../entities/strategy/model/types';
import { PeriodSelector } from '../../shared/ui/PeriodSelector';
import { resolvePeriod, type PeriodKey, type PeriodRange } from '../../shared/lib/period';
import { SummaryStatCards } from '../../widgets/stats-cards/SummaryStatCards';
import { ByDirectionStatsCard, DayOfWeekTable, StopLossStatsCard } from '../../widgets/stats-cards/BreakdownStats';
import { PnlChart } from '../../widgets/pnl-chart/PnlChart';
import { useT } from '../../shared/i18n';

export function AnalyticsPage() {
  const t = useT();
  const timezone = useMarketStore((s) => s.timezone);
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [customRange, setCustomRange] = useState<PeriodRange>();
  const [strategy, setStrategy] = useState<StrategyId | 'ALL'>('ALL');
  const selected = strategy === 'ALL' ? undefined : strategy;

  const { from, to } = resolvePeriod(period, timezone, customRange);

  const summary = useSummaryStatsQuery(from, to, selected);
  const byDirection = useByDirectionStatsQuery(from, to, selected);
  const stopLoss = useStopLossStatsQuery(from, to, selected);
  const byDay = useByDayStatsQuery(from, to, timezone, selected);
  const pnlCurve = usePnlCurveQuery(selected);

  return (
    <Space orientation="vertical" size="large" className="page">
      <Segmented
        value={strategy}
        onChange={(v) => setStrategy(v as StrategyId | 'ALL')}
        options={[
          { value: 'ALL', label: t('trades.allStrategies') },
          { value: SCALPING, label: t('strategyName.scalping') },
          { value: LONG_TERM, label: t('strategyName.longTerm') },
        ]}
      />
      <PeriodSelector period={period} onPeriodChange={setPeriod} customRange={customRange} onCustomRangeChange={setCustomRange} />

      <SummaryStatCards title={t('stats.title')} stats={summary.data} loading={summary.isLoading} />
      <ByDirectionStatsCard stats={byDirection.data} loading={byDirection.isLoading} />
      <StopLossStatsCard stats={stopLoss.data} loading={stopLoss.isLoading} />
      <DayOfWeekTable data={byDay.data} loading={byDay.isLoading} />
      <PnlChart data={pnlCurve.data} loading={pnlCurve.isLoading} height={300} />
    </Space>
  );
}
