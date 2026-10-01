import { Card, Col, Row, Statistic } from 'antd';
import type { SummaryStats } from '../../entities/trade/model/types';

/** Section 35 — compact dashboard cards: Today's Performance / Weekly Performance. */
export function PerformanceCard({ title, stats, loading }: { title: string; stats: SummaryStats | undefined; loading?: boolean }) {
  return (
    <Card title={title} loading={loading}>
      <Row gutter={16}>
        <Col span={6}>
          <Statistic title="Сделки" value={stats?.trades ?? 0} />
        </Col>
        <Col span={6}>
          <Statistic title="Прибыльных" value={stats?.profit ?? 0} valueStyle={{ color: '#3fb950' }} />
        </Col>
        <Col span={6}>
          <Statistic title="Убыточных" value={stats?.stopLoss ?? 0} valueStyle={{ color: '#f85149' }} />
        </Col>
        <Col span={6}>
          <Statistic
            title="Итог"
            value={stats?.net ?? 0}
            precision={2}
            suffix="пт"
            valueStyle={{ color: (stats?.net ?? 0) >= 0 ? '#3fb950' : '#f85149' }}
          />
        </Col>
      </Row>
    </Card>
  );
}
