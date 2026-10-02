import { Button, Card, Space, Table, Tag } from 'antd';
import { useResetRequests, useResolveResetRequest, type ResetRequest } from '../../entities/admin/api/admin';
import { useMarketStore } from '../../entities/market/model/store';
import { useT } from '../../shared/i18n';
import { formatDateTime } from '../../shared/lib/time';

/** «Забыли пароль» requests: the admin sets a new password for the matched account, then marks it resolved. */
export function ResetRequestsCard({ onSetPassword }: { onSetPassword: (accountId: string) => void }) {
  const t = useT();
  const timezone = useMarketStore((s) => s.timezone);
  const { data = [], isLoading } = useResetRequests();
  const resolve = useResolveResetRequest();

  return (
    <Card title={t('admin.resetTitle')}>
      <Table<ResetRequest>
        scroll={{ x: 'max-content' }}
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: t('admin.noResets') }}
        columns={[
          { title: t('admin.resetDate'), dataIndex: 'createdAt', render: (v: number) => formatDateTime(v, timezone) },
          { title: t('admin.colPhone'), dataIndex: 'phone' },
          {
            title: t('admin.resetUser'),
            render: (_, r) => (r.account ? `${r.account.name} · ${r.account.email}` : <Tag>{t('admin.resetUnknown')}</Tag>),
          },
          {
            title: t('admin.colStatus'),
            dataIndex: 'status',
            render: (s: ResetRequest['status']) =>
              s === 'OPEN' ? <Tag color="warning">{t('admin.resetOpen')}</Tag> : <Tag color="success">{t('admin.resetResolved')}</Tag>,
          },
          {
            title: t('admin.colActions'),
            render: (_, r) =>
              r.status === 'OPEN' ? (
                <Space size={4} wrap>
                  {r.account && (
                    <Button size="small" type="primary" onClick={() => onSetPassword(r.account!.id)}>
                      {t('admin.setPassword')}
                    </Button>
                  )}
                  <Button size="small" loading={resolve.isPending && resolve.variables === r.id} onClick={() => resolve.mutate(r.id)}>
                    {t('admin.markResolved')}
                  </Button>
                </Space>
              ) : null,
          },
        ]}
      />
    </Card>
  );
}
