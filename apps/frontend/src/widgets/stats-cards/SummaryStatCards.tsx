import { Card, Col, Row, Statistic } from 'antd';
import type { SummaryStats } from '../../entities/trade/model/types';

/** Sections 32/33 — full Daily/Weekly Statistics breakdown. */
export function SummaryStatCards({ title, stats, loading }: { title: string; stats: SummaryStats | undefined; loading?: boolean }) {
  return (
    <Card title={title} loading={loading}>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Statistic title="Сделки" value={stats?.trades ?? 0} />
        </Col>
        <Col span={6}>
          <Statistic title="Прибыль" value={stats?.profit ?? 0} valueStyle={{ color: '#3fb950' }} />
        </Col>
        <Col span={6}>
          <Statistic title="Stop Loss" value={stats?.stopLoss ?? 0} valueStyle={{ color: '#f85149' }} />
        </Col>
        <Col span={6}>
          <Statistic title="Закрыто вручную" value={stats?.manualClose ?? 0} />
        </Col>
        <Col span={6}>
          <Statistic title="Процент побед" value={stats?.winRate ?? 0} precision={1} suffix="%" />
        </Col>
        <Col span={6}>
          <Statistic title="Пункты прибыли" value={stats?.profitPoints ?? 0} precision={2} valueStyle={{ color: '#3fb950' }} />
        </Col>
        <Col span={6}>
          <Statistic title="Пункты убытка" value={stats?.lossPoints ?? 0} precision={2} valueStyle={{ color: '#f85149' }} />
        </Col>
        <Col span={6}>
          <Statistic
            title="Итог"
            value={stats?.net ?? 0}
            precision={2}
            suffix="пунктов"
            valueStyle={{ color: (stats?.net ?? 0) >= 0 ? '#3fb950' : '#f85149' }}
          />
        </Col>
      </Row>
    </Card>
  );
}
