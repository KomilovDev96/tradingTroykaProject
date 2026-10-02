import { useState } from 'react';
import { Layout as AntLayout, Button, Drawer, Grid, Menu } from 'antd';
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
  const screens = Grid.useBreakpoint();
  const [menuOpen, setMenuOpen] = useState(false);
  useMarketSocket();

  // Phones get a hamburger + drawer; a horizontal menu would collapse all items into "…".
  const isPhone = !screens.sm;

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <AntLayout.Header style={{ display: 'flex', alignItems: 'center', gap: isPhone ? 12 : 24 }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, flex: isPhone ? 1 : undefined }}>Тройка</span>
        {isPhone ? (
          <Button type="text" aria-label="Меню" onClick={() => setMenuOpen(true)} style={{ color: '#fff', fontSize: 22 }}>
            ☰
          </Button>
        ) : (
          <Menu theme="dark" mode="horizontal" selectedKeys={[location.pathname]} items={NAV_ITEMS} style={{ flex: 1, minWidth: 0 }} />
        )}
      </AntLayout.Header>
      <Drawer title="Тройка" placement="right" size={260} open={isPhone && menuOpen} onClose={() => setMenuOpen(false)} styles={{ body: { padding: 0 } }}>
        <Menu mode="vertical" selectedKeys={[location.pathname]} items={NAV_ITEMS} onClick={() => setMenuOpen(false)} style={{ borderInlineEnd: 'none' }} />
      </Drawer>
      <AntLayout.Content>
        <Outlet />
      </AntLayout.Content>
    </AntLayout>
  );
}
