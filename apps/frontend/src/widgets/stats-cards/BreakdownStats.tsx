import { Card, Col, Row, Statistic, Table } from 'antd';
import type { ByDirectionStats, DayOfWeekStats, StopLossStats } from '../../entities/trade/model/types';

const WEEKDAY_LABEL: Record<string, string> = {
  Monday: 'Понедельник',
  Tuesday: 'Вторник',
  Wednesday: 'Среда',
  Thursday: 'Четверг',
  Friday: 'Пятница',
  Saturday: 'Суббота',
  Sunday: 'Воскресенье',
};

/** Section 37 — BUY vs SELL breakdown. */
export function ByDirectionStatsCard({ stats, loading }: { stats: ByDirectionStats | undefined; loading?: boolean }) {
  return (
    <Card title="Разбивка по BUY / SELL" loading={loading}>
      <Row gutter={[16, 16]}>
        {(['BUY', 'SELL'] as const).map((dir) => (
          <Col span={12} key={dir}>
            <Card size="small" type="inner" title={dir}>
              <Row gutter={8}>
                <Col span={12}>
                  <Statistic title="Всего" value={stats?.[dir].total ?? 0} />
                </Col>
                <Col span={12}>
                  <Statistic title="Прибыль" value={stats?.[dir].profit ?? 0} valueStyle={{ color: '#3fb950' }} />
                </Col>
                <Col span={12}>
                  <Statistic title="Stop Loss" value={stats?.[dir].stopLoss ?? 0} valueStyle={{ color: '#f85149' }} />
                </Col>
                <Col span={12}>
                  <Statistic title="Процент побед" value={stats?.[dir].winRate ?? 0} precision={1} suffix="%" />
                </Col>
                <Col span={24}>
                  <Statistic
                    title="Итог, пунктов"
                    value={stats?.[dir].netPoints ?? 0}
                    precision={2}
                    valueStyle={{ color: (stats?.[dir].netPoints ?? 0) >= 0 ? '#3fb950' : '#f85149' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
}

/** Section 38 — Stop Loss statistics. */
export function StopLossStatsCard({ stats, loading }: { stats: StopLossStats | undefined; loading?: boolean }) {
  return (
    <Card title="Статистика Stop Loss" loading={loading}>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Statistic title="Всего Stop Loss" value={stats?.total ?? 0} />
        </Col>
        <Col span={6}>
          <Statistic title="Stop Loss по BUY" value={stats?.buy ?? 0} />
        </Col>
        <Col span={6}>
          <Statistic title="Stop Loss по SELL" value={stats?.sell ?? 0} />
        </Col>
        <Col span={6}>
          <Statistic title="Средний убыток" value={stats?.avgLoss ?? 0} precision={2} valueStyle={{ color: '#f85149' }} />
        </Col>
        <Col span={6}>
          <Statistic title="Максимальный убыток" value={stats?.maxLoss ?? 0} precision={2} valueStyle={{ color: '#f85149' }} />
        </Col>
      </Row>
    </Card>
  );
}

/** Section 34 — per-weekday breakdown table. */
export function DayOfWeekTable({ data, loading }: { data: DayOfWeekStats[] | undefined; loading?: boolean }) {
  return (
    <Card title="Статистика по дням" loading={loading}>
      <Table<DayOfWeekStats>
        size="small"
        rowKey="day"
        pagination={false}
        dataSource={data ?? []}
        columns={[
          { title: 'День', dataIndex: 'day', render: (d: string) => WEEKDAY_LABEL[d] ?? d },
          { title: 'Сделки', dataIndex: 'trades' },
          { title: 'Прибыль', dataIndex: 'profit' },
          { title: 'Stop Loss', dataIndex: 'stopLoss' },
          {
            title: 'Итог',
            dataIndex: 'net',
            render: (v: number) => <span style={{ color: v >= 0 ? '#3fb950' : '#f85149' }}>{v.toFixed(2)}</span>,
          },
        ]}
      />
    </Card>
  );
}
