import { Layout as AntLayout, Button, Space, Typography } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdminDashboard, type AdminUser } from '../../entities/admin/api/admin';
import { useLogout, useMeQuery } from '../../entities/session/api/session';
import { LanguageSelect } from '../../features/switch-language/ui/LanguageSelect';
import { useT } from '../../shared/i18n';
import { AdminOverviewCards } from '../../widgets/admin/AdminOverviewCards';
import { ResetRequestsCard } from '../../widgets/admin/ResetRequestsCard';
import { UserDetailDrawer } from '../../widgets/admin/UserDetailDrawer';
import { UserFormModal } from '../../widgets/admin/UserFormModal';
import { UsersTable } from '../../widgets/admin/UsersTable';

/** The super admin's own window: every account's results, user management and password-reset requests. */
export function AdminPage() {
  const t = useT();
  const navigate = useNavigate();
  const me = useMeQuery().data;
  const logout = useLogout();
  const { data, isLoading } = useAdminDashboard();
  const users = data?.users ?? [];

  const [viewing, setViewing] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });

  const openEditById = (accountId: string) => {
    const user = users.find((u) => u.id === accountId);
    if (user) setForm({ open: true, user });
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <AntLayout.Header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', height: 'auto', minHeight: 64, lineHeight: 'normal', paddingBlock: 12 }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, flex: 1, minWidth: 140 }}>
          {t('app.name')} · {t('admin.title')}
        </span>
        <Space wrap size={8}>
          <Typography.Text style={{ color: '#c9d1d9' }}>{me?.name}</Typography.Text>
          <Link to="/">
            <Button size="small">{t('nav.dashboard')}</Button>
          </Link>
          <LanguageSelect />
          <Button size="small" loading={logout.isPending} onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })}>
            {t('auth.logout')}
          </Button>
        </Space>
      </AntLayout.Header>
      <AntLayout.Content>
        <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <AdminOverviewCards overview={data?.overview} loading={isLoading} />
          <UsersTable
            users={users}
            loading={isLoading}
            onView={(u) => setViewing(u.id)}
            onEdit={(u) => setForm({ open: true, user: u })}
            onCreate={() => setForm({ open: true, user: null })}
          />
          <ResetRequestsCard onSetPassword={openEditById} />
        </div>
      </AntLayout.Content>
      <UserDetailDrawer userId={viewing} onClose={() => setViewing(null)} />
      <UserFormModal open={form.open} user={form.user} onClose={() => setForm({ open: false, user: null })} />
    </AntLayout>
  );
}
