import { Card, Col, Row, Statistic } from 'antd';
import type { SummaryStats } from '../../entities/trade/model/types';
import { useT } from '../../shared/i18n';

/** Sections 32/33 — full Daily/Weekly Statistics breakdown. */
export function SummaryStatCards({ title, stats, loading }: { title: string; stats: SummaryStats | undefined; loading?: boolean }) {
  const t = useT();
  return (
    <Card title={title} loading={loading}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Statistic title={t('stats.trades')} value={stats?.trades ?? 0} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title={t('stats.profit')} value={stats?.profit ?? 0} valueStyle={{ color: '#3fb950' }} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Stop Loss" value={stats?.stopLoss ?? 0} valueStyle={{ color: '#f85149' }} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title={t('stats.manualClose')} value={stats?.manualClose ?? 0} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title={t('stats.winRate')} value={stats?.winRate ?? 0} precision={1} suffix="%" />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title={t('stats.profitPoints')} value={stats?.profitPoints ?? 0} precision={2} valueStyle={{ color: '#3fb950' }} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title={t('stats.lossPoints')} value={stats?.lossPoints ?? 0} precision={2} valueStyle={{ color: '#f85149' }} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic
            title={t('stats.net')}
            value={stats?.net ?? 0}
            precision={2}
            suffix={` ${t('stats.points')}`}
            valueStyle={{ color: (stats?.net ?? 0) >= 0 ? '#3fb950' : '#f85149' }}
          />
        </Col>
      </Row>
    </Card>
  );
}
