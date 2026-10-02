import { App, Button, Card, Grid, Input, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { useDeleteUser, type AdminUser } from '../../entities/admin/api/admin';
import { useMarketStore } from '../../entities/market/model/store';
import { ApiError } from '../../shared/api/httpClient';
import { translateError, useT } from '../../shared/i18n';
import { formatDateTime } from '../../shared/lib/time';

type ResultFilter = 'all' | 'profit' | 'loss' | 'zero';
type StatusFilter = 'all' | 'active' | 'paused';

function matchesResult(user: AdminUser, filter: ResultFilter) {
  const net = user.stats.net;
  if (filter === 'profit') return net > 0;
  if (filter === 'loss') return net < 0;
  if (filter === 'zero') return net === 0;
  return true;
}

export function UsersTable({
  users,
  loading,
  onView,
  onEdit,
  onCreate,
}: {
  users: AdminUser[];
  loading: boolean;
  onView: (user: AdminUser) => void;
  onEdit: (user: AdminUser) => void;
  onCreate: () => void;
}) {
  const t = useT();
  const { message } = App.useApp();
  const timezone = useMarketStore((s) => s.timezone);
  const remove = useDeleteUser();
  // A pinned actions column would cover most of the table on a phone.
  const pinActions = Boolean(Grid.useBreakpoint().md);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<ResultFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return users.filter(
      (u) =>
        (!q || u.name.toLowerCase().includes(q) || u.email.includes(q) || (digits.length > 0 && (u.phone ?? '').includes(digits))) &&
        matchesResult(u, result) &&
        (status === 'all' || (status === 'paused') === u.analysisPaused),
    );
  }, [users, search, result, status]);

  const handleDelete = async (user: AdminUser) => {
    try {
      await remove.mutateAsync(user.id);
      message.success(t('admin.deleted'));
    } catch (err) {
      message.error(err instanceof ApiError ? translateError(t, err.code, err.status) : String(err));
    }
  };

  return (
    <Card
      title={`${t('admin.users')} (${filtered.length})`}
      extra={
        <Button type="primary" onClick={onCreate}>
          {t('admin.create')}
        </Button>
      }
    >
      <Space wrap style={{ marginBottom: 16, width: '100%' }}>
        <Input.Search allowClear placeholder={t('admin.search')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 280, maxWidth: '100%' }} />
        <Select<ResultFilter>
          value={result}
          onChange={setResult}
          style={{ width: 180 }}
          options={[
            { value: 'all', label: t('admin.filterAll') },
            { value: 'profit', label: t('admin.filterProfit') },
            { value: 'loss', label: t('admin.filterLoss') },
            { value: 'zero', label: t('admin.filterZero') },
          ]}
        />
        <Select<StatusFilter>
          value={status}
          onChange={setStatus}
          style={{ width: 160 }}
          options={[
            { value: 'all', label: t('admin.filterAll') },
            { value: 'active', label: t('admin.filterActive') },
            { value: 'paused', label: t('admin.filterPaused') },
          ]}
        />
      </Space>

      <Table<AdminUser>
        scroll={{ x: 'max-content' }}
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: t('trades.noData') }}
        onRow={(user) => ({ onDoubleClick: () => onView(user) })}
        columns={[
          { title: t('admin.colName'), dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
          { title: t('admin.colEmail'), dataIndex: 'email' },
          { title: t('admin.colPhone'), dataIndex: 'phone', render: (p: string | null) => p ?? '—' },
          { title: t('admin.colTrades'), render: (_, u) => u.stats.trades, sorter: (a, b) => a.stats.trades - b.stats.trades },
          {
            title: t('admin.colWinRate'),
            render: (_, u) => `${u.stats.winRate.toFixed(1)}%`,
            sorter: (a, b) => a.stats.winRate - b.stats.winRate,
          },
          {
            title: t('admin.colNet'),
            render: (_, u) => (
              <span style={{ color: u.stats.net > 0 ? '#3fb950' : u.stats.net < 0 ? '#f85149' : undefined, fontWeight: 600 }}>
                {u.stats.net > 0 ? '+' : ''}
                {u.stats.net.toFixed(2)}
              </span>
            ),
            sorter: (a, b) => a.stats.net - b.stats.net,
            defaultSortOrder: 'descend',
          },
          { title: t('admin.colOpen'), dataIndex: 'openPositions', sorter: (a, b) => a.openPositions - b.openPositions },
          {
            title: t('admin.colStatus'),
            render: (_, u) => (u.analysisPaused ? <Tag color="warning">{t('admin.statusPaused')}</Tag> : <Tag color="success">{t('admin.statusActive')}</Tag>),
          },
          {
            title: t('admin.colRegistered'),
            dataIndex: 'createdAt',
            render: (v: number) => formatDateTime(v, timezone),
            sorter: (a, b) => a.createdAt - b.createdAt,
          },
          {
            title: t('admin.colLastLogin'),
            dataIndex: 'lastLoginAt',
            render: (v: number | null) => (v ? formatDateTime(v, timezone) : t('admin.never')),
          },
          {
            title: t('admin.colActions'),
            fixed: pinActions ? 'right' : undefined,
            render: (_, u) => (
              <Space size={4} wrap>
                <Button size="small" onClick={() => onView(u)}>
                  {t('admin.view')}
                </Button>
                <Button size="small" onClick={() => onEdit(u)}>
                  {t('admin.edit')}
                </Button>
                <Popconfirm
                  title={t('admin.deleteConfirm', { name: u.name })}
                  okText={t('admin.delete')}
                  cancelText={t('admin.cancel')}
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleDelete(u)}
                >
                  <Button size="small" danger>
                    {t('admin.delete')}
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
}
