import { Card, Typography } from 'antd';
import type { ReactNode } from 'react';
import { LanguageSelect } from '../../features/switch-language/ui/LanguageSelect';
import { useT } from '../../shared/i18n';

/** Centered card shared by the login and registration pages; language can be picked before signing in. */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  const t = useT();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
      <Card style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 8 }}>
          <img
            src="/brand/bkx-signals-logo.png"
            alt={t('app.name')}
            style={{ display: 'block', width: 190, maxWidth: '70%', height: 48, objectFit: 'contain', objectPosition: 'left center' }}
          />
          <LanguageSelect />
        </div>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          {title}
        </Typography.Title>
        {children}
      </Card>
    </div>
  );
}
