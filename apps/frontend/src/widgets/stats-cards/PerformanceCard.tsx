import { Card, Col, Row, Statistic } from 'antd';
import type { SummaryStats } from '../../entities/trade/model/types';
import { useT } from '../../shared/i18n';

/** Section 35 — compact dashboard cards: Today's Performance / Weekly Performance. */
export function PerformanceCard({ title, stats, loading }: { title: string; stats: SummaryStats | undefined; loading?: boolean }) {
  const t = useT();
  return (
    <Card title={title} loading={loading}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Statistic title={t('stats.trades')} value={stats?.trades ?? 0} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title={t('stats.profitable')} value={stats?.profit ?? 0} valueStyle={{ color: '#3fb950' }} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title={t('stats.losing')} value={stats?.stopLoss ?? 0} valueStyle={{ color: '#f85149' }} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic
            title={t('stats.net')}
            value={stats?.net ?? 0}
            precision={2}
            suffix={` ${t('stats.pt')}`}
            valueStyle={{ color: (stats?.net ?? 0) >= 0 ? '#3fb950' : '#f85149' }}
          />
        </Col>
      </Row>
    </Card>
  );
}
