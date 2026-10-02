import { Card, Col, Row, Statistic } from 'antd';
import type { AdminOverview } from '../../entities/admin/api/admin';
import { useT } from '../../shared/i18n';

const GREEN = '#3fb950';
const RED = '#f85149';

export function AdminOverviewCards({ overview, loading }: { overview: AdminOverview | undefined; loading: boolean }) {
  const t = useT();
  const net = overview?.totalNet ?? 0;
  const items = [
    { title: t('admin.users'), value: overview?.users ?? 0 },
    { title: t('admin.activeUsers'), value: overview?.activeUsers ?? 0 },
    { title: t('admin.pausedUsers'), value: overview?.pausedUsers ?? 0 },
    { title: t('admin.inProfit'), value: overview?.inProfit ?? 0, color: GREEN },
    { title: t('admin.inLoss'), value: overview?.inLoss ?? 0, color: RED },
    { title: t('admin.openPositions'), value: overview?.openPositions ?? 0 },
    { title: t('admin.totalTrades'), value: overview?.totalTrades ?? 0 },
    { title: t('admin.totalNet'), value: net, precision: 2, color: net > 0 ? GREEN : net < 0 ? RED : undefined },
    { title: t('admin.resetRequests'), value: overview?.openResetRequests ?? 0, color: overview?.openResetRequests ? '#e0a800' : undefined },
  ];

  return (
    <Card loading={loading}>
      <Row gutter={[16, 16]}>
        {items.map((item) => (
          <Col key={item.title} xs={12} sm={8} lg={6} xl={4}>
            <Statistic title={item.title} value={item.value} precision={item.precision} styles={{ content: item.color ? { color: item.color } : undefined }} />
          </Col>
        ))}
      </Row>
    </Card>
  );
}
