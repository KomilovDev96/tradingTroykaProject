import { Button, Card, Typography } from 'antd';
import type { ReactNode } from 'react';
import { LanguageSelect } from '../../features/switch-language/ui/LanguageSelect';
import { useT } from '../../shared/i18n';
import { useThemeStore } from '../../shared/theme';

/** Centered card shared by the login and registration pages; language can be picked before signing in. */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  const t = useT();
  const themeMode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
      <Card style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 8 }}>
          <img
            src="/brand/bkx-signals-logo.png"
            alt={t('app.name')}
            style={{ display: 'block', width: 190, maxWidth: '70%', height: 48, objectFit: 'contain', objectPosition: 'left center' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Button
              type="text"
              size="small"
              aria-label={themeMode === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
              onClick={toggleTheme}
              style={{ fontSize: 18, lineHeight: 1 }}
            >
              {themeMode === 'dark' ? '☀' : '☾'}
            </Button>
            <LanguageSelect />
          </div>
        </div>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          {title}
        </Typography.Title>
        {children}
      </Card>
    </div>
  );
}
