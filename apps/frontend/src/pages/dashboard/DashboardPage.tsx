import { Col, Row, Space } from 'antd';
import { useMarketStore } from '../../entities/market/model/store';
import { useSummaryStatsQuery, usePnlCurveQuery } from '../../entities/trade/api/queries';
import { resolvePeriod } from '../../shared/lib/period';
import { MarketHeader } from '../../widgets/market-header/MarketHeader';
import { TradingChart } from '../../widgets/trading-chart/TradingChart';
import { StrategyPanel } from '../../widgets/strategy-panel/StrategyPanel';
import { SignalPanel } from '../../widgets/signal-panel/SignalPanel';
import { OpenTrades } from '../../widgets/open-trades/OpenTrades';
import { PerformanceCard } from '../../widgets/stats-cards/PerformanceCard';
import { PnlChart } from '../../widgets/pnl-chart/PnlChart';

export function DashboardPage() {
  const candles = useMarketStore((s) => s.candles);
  const output = useMarketStore((s) => s.output);
  const timezone = useMarketStore((s) => s.timezone);

  const today = resolvePeriod('today', timezone);
  const thisWeek = resolvePeriod('this_week', timezone);
  const todayStats = useSummaryStatsQuery(today.from, today.to);
  const weekStats = useSummaryStatsQuery(thisWeek.from, thisWeek.to);
  const pnlCurve = usePnlCurveQuery();

  return (
    <Space orientation="vertical" size="large" className="page">
      <MarketHeader />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={17}>
          <TradingChart
            candles={candles}
            highDemand={output?.highDemand ?? null}
            lowDemand={output?.lowDemand ?? null}
            upperLevel={output?.upperLevel ?? null}
            lowerLevel={output?.lowerLevel ?? null}
            entryPrice={output?.entryPrice ?? null}
            stopLoss={output?.stopLoss ?? null}
            currentPrice={output?.currentPrice ?? null}
          />
        </Col>
        <Col xs={24} xl={7}>
          <SignalPanel />
        </Col>
      </Row>

      <StrategyPanel />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <PerformanceCard title="Показатели за сегодня" stats={todayStats.data} loading={todayStats.isLoading} />
        </Col>
        <Col xs={24} lg={12}>
          <PerformanceCard title="Показатели за неделю" stats={weekStats.data} loading={weekStats.isLoading} />
        </Col>
      </Row>

      <OpenTrades />
      <PnlChart data={pnlCurve.data} loading={pnlCurve.isLoading} />
    </Space>
  );
}
