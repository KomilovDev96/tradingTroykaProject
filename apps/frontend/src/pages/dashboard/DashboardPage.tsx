import { Col, Row, Space } from 'antd';
import { useMarketStore } from '../../entities/market/model/store';
import { SCALPING } from '../../entities/strategy/model/types';
import { useOpenTradesQuery, useSummaryStatsQuery, usePnlCurveQuery } from '../../entities/trade/api/queries';
import { resolvePeriod } from '../../shared/lib/period';
import { MarketHeader } from '../../widgets/market-header/MarketHeader';
import { TradingChart } from '../../widgets/trading-chart/TradingChart';
import { ChartPositionOverlay } from '../../widgets/trading-chart/ChartPositionOverlay';
import { StrategyPanel } from '../../widgets/strategy-panel/StrategyPanel';
import { SignalPanel } from '../../widgets/signal-panel/SignalPanel';
import { OpenTrades } from '../../widgets/open-trades/OpenTrades';
import { PerformanceCard } from '../../widgets/stats-cards/PerformanceCard';
import { PnlChart } from '../../widgets/pnl-chart/PnlChart';
import { useT } from '../../shared/i18n';

export function DashboardPage() {
  const candles = useMarketStore((s) => s.candles);
  const output = useMarketStore((s) => s.output);
  const timezone = useMarketStore((s) => s.timezone);
  // The chart's entry/stop are this account's own position (the shared signal may outlive it).
  const myPosition = useOpenTradesQuery(SCALPING).data?.[0] ?? null;
  const t = useT();

  const today = resolvePeriod('today', timezone);
  const thisWeek = resolvePeriod('this_week', timezone);
  const todayStats = useSummaryStatsQuery(today.from, today.to, SCALPING);
  const weekStats = useSummaryStatsQuery(thisWeek.from, thisWeek.to, SCALPING);
  const pnlCurve = usePnlCurveQuery(SCALPING);

  return (
    <Space orientation="vertical" size="large" className="page">
      <MarketHeader />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={17}>
          <TradingChart
            candles={candles}
            levels={[
              { price: output?.highDemand ?? null, color: '#e0a800', title: t('chart.highDemand') },
              { price: output?.lowDemand ?? null, color: '#e0a800', title: t('chart.lowDemand') },
              { price: output?.upperLevel ?? null, color: '#58a6ff', title: t('chart.upperLevel') },
              { price: output?.lowerLevel ?? null, color: '#58a6ff', title: t('chart.lowerLevel') },
              { price: myPosition?.entryPrice ?? null, color: '#3fb950', title: t('chart.entry') },
              { price: myPosition?.stopLoss ?? null, color: '#f85149', title: 'STOP LOSS' },
            ]}
            overlay={<ChartPositionOverlay strategy={SCALPING} />}
          />
        </Col>
        <Col xs={24} xl={7}>
          <SignalPanel />
        </Col>
      </Row>

      <StrategyPanel />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <PerformanceCard title={t('dashboard.today')} stats={todayStats.data} loading={todayStats.isLoading} />
        </Col>
        <Col xs={24} lg={12}>
          <PerformanceCard title={t('dashboard.week')} stats={weekStats.data} loading={weekStats.isLoading} />
        </Col>
      </Row>

      <OpenTrades strategy={SCALPING} />
      <PnlChart data={pnlCurve.data} loading={pnlCurve.isLoading} />
    </Space>
  );
}
