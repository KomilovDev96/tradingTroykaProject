import { Card, Col, Row, Statistic, Table } from 'antd';
import type { ByDirectionStats, DayOfWeekStats, StopLossStats } from '../../entities/trade/model/types';
import { useT, type TranslationKey } from '../../shared/i18n';


/** Section 37 — BUY vs SELL breakdown. */
export function ByDirectionStatsCard({ stats, loading }: { stats: ByDirectionStats | undefined; loading?: boolean }) {
  const t = useT();
  return (
    <Card title={t('stats.byDirection')} loading={loading}>
      <Row gutter={[16, 16]}>
        {(['BUY', 'SELL'] as const).map((dir) => (
          <Col xs={24} md={12} key={dir}>
            <Card size="small" type="inner" title={dir}>
              <Row gutter={8}>
                <Col span={12}>
                  <Statistic title={t('stats.total')} value={stats?.[dir].total ?? 0} />
                </Col>
                <Col span={12}>
                  <Statistic title={t('stats.profit')} value={stats?.[dir].profit ?? 0} valueStyle={{ color: '#3fb950' }} />
                </Col>
                <Col span={12}>
                  <Statistic title="Stop Loss" value={stats?.[dir].stopLoss ?? 0} valueStyle={{ color: '#f85149' }} />
                </Col>
                <Col span={12}>
                  <Statistic title={t('stats.winRate')} value={stats?.[dir].winRate ?? 0} precision={1} suffix="%" />
                </Col>
                <Col span={24}>
                  <Statistic
                    title={t('stats.netPoints')}
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
  const t = useT();
  return (
    <Card title={t('stats.stopLossTitle')} loading={loading}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Statistic title={t('stats.stopLossTotal')} value={stats?.total ?? 0} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title={t('stats.stopLossBuy')} value={stats?.buy ?? 0} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title={t('stats.stopLossSell')} value={stats?.sell ?? 0} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title={t('stats.avgLoss')} value={stats?.avgLoss ?? 0} precision={2} valueStyle={{ color: '#f85149' }} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title={t('stats.maxLoss')} value={stats?.maxLoss ?? 0} precision={2} valueStyle={{ color: '#f85149' }} />
        </Col>
      </Row>
    </Card>
  );
}

/** Section 34 — per-weekday breakdown table. */
export function DayOfWeekTable({ data, loading }: { data: DayOfWeekStats[] | undefined; loading?: boolean }) {
  const t = useT();
  return (
    <Card title={t('stats.byDay')} loading={loading}>
      <Table<DayOfWeekStats>
        scroll={{ x: 'max-content' }}
        size="small"
        rowKey="day"
        pagination={false}
        dataSource={data ?? []}
        columns={[
          { title: t('stats.day'), dataIndex: 'day', render: (d: string) => t(`weekday.${d}` as TranslationKey) },
          { title: t('stats.trades'), dataIndex: 'trades' },
          { title: t('stats.profit'), dataIndex: 'profit' },
          { title: 'Stop Loss', dataIndex: 'stopLoss' },
          {
            title: t('stats.net'),
            dataIndex: 'net',
            render: (v: number) => <span style={{ color: v >= 0 ? '#3fb950' : '#f85149' }}>{v.toFixed(2)}</span>,
          },
        ]}
      />
    </Card>
  );
}
