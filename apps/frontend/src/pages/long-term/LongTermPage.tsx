import { Col, Row, Space } from 'antd';
import { useMarketStore } from '../../entities/market/model/store';
import { LONG_TERM } from '../../entities/strategy/model/types';
import { useOpenTradesQuery, usePnlCurveQuery, useSummaryStatsQuery } from '../../entities/trade/api/queries';
import { resolvePeriod } from '../../shared/lib/period';
import { useT } from '../../shared/i18n';
import { MarketHeader } from '../../widgets/market-header/MarketHeader';
import { TradingChart, type ChartLevel } from '../../widgets/trading-chart/TradingChart';
import { ChartPositionOverlay } from '../../widgets/trading-chart/ChartPositionOverlay';
import { LongTermSignalPanel } from '../../widgets/long-term-signal/LongTermSignalPanel';
import { SpeedometerCard } from '../../widgets/speedometer/SpeedometerCard';
import { OpenTrades } from '../../widgets/open-trades/OpenTrades';
import { PerformanceCard } from '../../widgets/stats-cards/PerformanceCard';
import { PnlChart } from '../../widgets/pnl-chart/PnlChart';

/** «Долгосрочная»: the H1 Troika with the market speedometer (PDF guide). */
export function LongTermPage() {
  const t = useT();
  const candles = useMarketStore((s) => s.longTermCandles);
  const output = useMarketStore((s) => s.longTermOutput);
  const timezone = useMarketStore((s) => s.timezone);
  // Levels of this account's own position only (the shared one may still run for others after it closed).
  const mine = useOpenTradesQuery(LONG_TERM).data?.[0] ?? null;

  const today = resolvePeriod('today', timezone);
  const thisWeek = resolvePeriod('this_week', timezone);
  const todayStats = useSummaryStatsQuery(today.from, today.to, LONG_TERM);
  const weekStats = useSummaryStatsQuery(thisWeek.from, thisWeek.to, LONG_TERM);
  const pnlCurve = usePnlCurveQuery(LONG_TERM);

  const sign = mine?.direction === 'SELL' ? -1 : 1;
  const entry = mine?.entryPrice ?? null;
  const step = mine?.breakevenStep ?? null;
  const stage = mine?.stage ?? 0;
  const levels: ChartLevel[] =
    entry !== null
      ? [
          { price: entry, color: '#3fb950', title: t('chart.entry'), lineStyle: 0 },
          { price: mine?.stopLoss ?? null, color: '#f85149', title: 'STOP LOSS', lineStyle: 0 },
          // Steps already passed are where the stop now sits: no separate line.
          { price: step !== null && stage < 1 ? entry + sign * step : null, color: '#39c5cf', title: t('chart.step1') },
          { price: step !== null && stage < 2 ? entry + sign * 2 * step : null, color: '#39c5cf', title: t('chart.step2') },
          { price: mine?.takeProfit1 ?? null, color: '#2ea043', title: 'TP1' },
          { price: mine?.takeProfit2 ?? null, color: '#2ea043', title: 'TP2' },
          { price: mine?.takeProfit3 ?? null, color: '#00e676', title: 'TP3', lineStyle: 0 },
        ]
      : [{ price: output?.potentialStopLoss ?? null, color: '#f85149', title: t('chart.potentialStopLoss') }];

  return (
    <Space orientation="vertical" size="large" className="page">
      <MarketHeader strategy={LONG_TERM} />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={17}>
          <TradingChart candles={candles} levels={levels} overlay={<ChartPositionOverlay strategy={LONG_TERM} />} />
        </Col>
        <Col xs={24} xl={7}>
          <LongTermSignalPanel />
        </Col>
      </Row>

      <SpeedometerCard />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <PerformanceCard title={t('dashboard.today')} stats={todayStats.data} loading={todayStats.isLoading} />
        </Col>
        <Col xs={24} lg={12}>
          <PerformanceCard title={t('dashboard.week')} stats={weekStats.data} loading={weekStats.isLoading} />
        </Col>
      </Row>

      <OpenTrades strategy={LONG_TERM} />
      <PnlChart data={pnlCurve.data} loading={pnlCurve.isLoading} />
    </Space>
  );
}
