import { Layout as AntLayout, Menu } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useMarketSocket } from '../features/market-data/model/useMarketSocket';

const NAV_ITEMS = [
  { key: '/', label: <Link to="/">Дашборд</Link> },
  { key: '/trades', label: <Link to="/trades">Сделки</Link> },
  { key: '/analytics', label: <Link to="/analytics">Аналитика</Link> },
  { key: '/settings', label: <Link to="/settings">Настройки</Link> },
];

export function Layout() {
  const location = useLocation();
  useMarketSocket();

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <AntLayout.Header style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>Тройка</span>
        <Menu theme="dark" mode="horizontal" selectedKeys={[location.pathname]} items={NAV_ITEMS} style={{ flex: 1, minWidth: 0 }} />
      </AntLayout.Header>
      <AntLayout.Content>
        <Outlet />
      </AntLayout.Content>
    </AntLayout>
  );
}
