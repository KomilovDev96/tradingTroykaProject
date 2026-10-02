import { Spin } from 'antd';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { homePathFor, useMeQuery } from '../entities/session/api/session';

/**
 * - default: any signed-in account
 * - `superAdmin`: the super admin only (others go to their dashboard)
 * - `guestOnly`: /login and /register (signed-in accounts go to their home page)
 */
export function RequireAuth({ children, guestOnly = false, superAdmin = false }: { children: ReactNode; guestOnly?: boolean; superAdmin?: boolean }) {
  const me = useMeQuery();
  const location = useLocation();

  if (me.isPending) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const account = me.data ?? null;
  if (guestOnly) return account ? <Navigate to={homePathFor(account)} replace /> : <>{children}</>;
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (superAdmin && account.role !== 'SUPERADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}
