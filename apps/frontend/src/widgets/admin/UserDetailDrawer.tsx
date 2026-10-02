import { Card, Col, Descriptions, Drawer, Grid, Row, Statistic, Table, Tag } from 'antd';
import { useAdminUser } from '../../entities/admin/api/admin';
import { useMarketStore } from '../../entities/market/model/store';
import { useT } from '../../shared/i18n';
import { formatDateTime } from '../../shared/lib/time';
import { useTradeHistoryColumns } from '../trade-history-table/useTradeHistoryColumns';
import { ByDirectionStatsCard } from '../stats-cards/BreakdownStats';

export function UserDetailDrawer({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const t = useT();
  const screens = Grid.useBreakpoint();
  const timezone = useMarketStore((s) => s.timezone);
  const { data, isLoading } = useAdminUser(userId);
  const columns = useTradeHistoryColumns();
  const summary = data?.summary;
  const net = summary?.net ?? 0;

  return (
    <Drawer open={userId !== null} onClose={onClose} size={screens.lg ? 900 : '100%'} title={data?.account.name ?? '…'} loading={isLoading}>
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Descriptions column={{ xs: 1, md: 2 }} size="small" bordered>
            <Descriptions.Item label={t('admin.colEmail')}>{data.account.email}</Descriptions.Item>
            <Descriptions.Item label={t('admin.colPhone')}>{data.account.phone ?? '—'}</Descriptions.Item>
            <Descriptions.Item label={t('admin.colStatus')}>
              {data.account.analysisPaused ? <Tag color="warning">{t('admin.statusPaused')}</Tag> : <Tag color="success">{t('admin.statusActive')}</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.colRegistered')}>{formatDateTime(data.account.createdAt, timezone)}</Descriptions.Item>
            <Descriptions.Item label={t('admin.colLastLogin')}>
              {data.account.lastLoginAt ? formatDateTime(data.account.lastLoginAt, timezone) : t('admin.never')}
            </Descriptions.Item>
          </Descriptions>

          <Card size="small">
            <Row gutter={[16, 16]}>
              <Col xs={12} md={6}>
                <Statistic title={t('stats.trades')} value={summary?.trades ?? 0} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title={t('stats.winRate')} value={summary?.winRate ?? 0} precision={1} suffix="%" />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title={t('stats.stopLossTotal')} value={summary?.stopLoss ?? 0} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title={t('stats.netPoints')}
                  value={net}
                  precision={2}
                  styles={{ content: { color: net > 0 ? '#3fb950' : net < 0 ? '#f85149' : undefined } }}
                />
              </Col>
            </Row>
          </Card>

          <ByDirectionStatsCard stats={data.byDirection} />

          <Card size="small" title={t('admin.userTrades')}>
            <Table
              scroll={{ x: 'max-content' }}
              size="small"
              rowKey="id"
              dataSource={data.trades}
              columns={columns}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: t('trades.noData') }}
            />
          </Card>
        </div>
      )}
    </Drawer>
  );
}
