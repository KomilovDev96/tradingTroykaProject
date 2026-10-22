import { useState } from 'react';
import { Layout as AntLayout, Button, Drawer, Grid, Menu, Typography } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLogout, useMeQuery } from '../entities/session/api/session';
import { useMarketSocket } from '../features/market-data/model/useMarketSocket';
import { LanguageSelect } from '../features/switch-language/ui/LanguageSelect';
import { useT } from '../shared/i18n';
import { useThemeStore } from '../shared/theme';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = useT();
  const me = useMeQuery();
  const logout = useLogout();
  const themeMode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  useMarketSocket();

  const navItems = [
    { key: '/', label: <Link to="/">{t('nav.scalping')}</Link> },
    { key: '/long-term', label: <Link to="/long-term">{t('nav.longTerm')}</Link> },
    { key: '/trades', label: <Link to="/trades">{t('nav.trades')}</Link> },
    { key: '/analytics', label: <Link to="/analytics">{t('nav.analytics')}</Link> },
    { key: '/settings', label: <Link to="/settings">{t('nav.settings')}</Link> },
    ...(me.data?.role === 'SUPERADMIN' ? [{ key: '/ai', label: <Link to="/ai">{t('nav.ai')}</Link> }] : []),
    ...(me.data?.role === 'SUPERADMIN' ? [{ key: '/admin', label: <Link to="/admin">{t('nav.admin')}</Link> }] : []),
  ];

  const handleLogout = () => {
    setMenuOpen(false);
    logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });
  };

  const isPhone = !screens.sm;
  const accountInline = Boolean(screens.lg);

  const accountControls = (
    <>
      <Button
        type="text"
        size="small"
        aria-label={themeMode === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
        onClick={toggleTheme}
        style={{ color: themeMode === 'dark' ? '#fff' : '#1f2937', fontSize: 18, lineHeight: 1 }}
      >
        {themeMode === 'dark' ? '☀' : '☾'}
      </Button>
      <LanguageSelect />
      <Button size="small" onClick={handleLogout} loading={logout.isPending}>
        {t('auth.logout')}
      </Button>
    </>
  );

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <AntLayout.Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isPhone ? 12 : 24,
          paddingInline: isPhone ? 16 : 24,
        }}
      >
        <Link
          to="/"
          aria-label={t('app.name')}
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            maxWidth: isPhone ? 150 : 205,
            height: 42,
          }}
        >
          <img
            src="/brand/bkx-signals-logo.png"
            alt={t('app.name')}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'left center' }}
          />
        </Link>
        {!isPhone && (
          <Menu theme="dark" mode="horizontal" selectedKeys={[location.pathname]} items={navItems} style={{ flex: 1, minWidth: 0 }} />
        )}
        {accountInline ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Typography.Text style={{ color: '#c9d1d9', whiteSpace: 'nowrap' }}>{me.data?.name}</Typography.Text>
            {accountControls}
          </div>
        ) : (
          <Button type="text" aria-label={t('nav.menu')} onClick={() => setMenuOpen(true)} style={{ color: '#fff', fontSize: 22 }}>
            ☰
          </Button>
        )}
      </AntLayout.Header>
      <Drawer
        title={me.data?.name ?? t('app.name')}
        placement="right"
        size={260}
        open={!accountInline && menuOpen}
        onClose={() => setMenuOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        {isPhone && (
          <Menu mode="vertical" selectedKeys={[location.pathname]} items={navItems} onClick={() => setMenuOpen(false)} style={{ borderInlineEnd: 'none' }} />
        )}
        <div style={{ display: 'flex', gap: 12, padding: 16, alignItems: 'center', flexWrap: 'wrap' }}>{accountControls}</div>
      </Drawer>
      <AntLayout.Content>
        <Outlet />
      </AntLayout.Content>
    </AntLayout>
  );
}
