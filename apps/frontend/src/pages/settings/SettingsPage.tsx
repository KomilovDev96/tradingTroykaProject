import { Card, Descriptions, Grid, Select, Space } from 'antd';
import { useMarketStore } from '../../entities/market/model/store';
import { BACKEND_HTTP_URL, BACKEND_WS_URL } from '../../shared/api/config';
import { BROWSER_TIMEZONE } from '../../shared/lib/time';
import { useMeQuery } from '../../entities/session/api/session';
import { useT, type TranslationKey } from '../../shared/i18n';

const TIMEZONE_OPTIONS = Array.from(
  new Set([BROWSER_TIMEZONE, 'UTC', 'Europe/Moscow', 'Europe/London', 'America/New_York', 'Asia/Dubai']),
).map((tz) => ({ value: tz, label: tz }));

export function SettingsPage() {
  const instrument = useMarketStore((s) => s.instrument);
  const timezone = useMarketStore((s) => s.timezone);
  const setTimezone = useMarketStore((s) => s.setTimezone);
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const screens = Grid.useBreakpoint();
  const t = useT();
  const me = useMeQuery().data;

  return (
    <Space orientation="vertical" size="large" className="page">
      <Card title={t('settings.title')}>
        <Descriptions column={1} bordered size="small" layout={screens.sm ? 'horizontal' : 'vertical'}>
          <Descriptions.Item label={t('settings.account')}>
            {me ? `${me.name} · ${me.email}${me.phone ? ` · ${me.phone}` : ''}` : '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('settings.instrument')}>{instrument ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('settings.strategy')}>TROYKA</Descriptions.Item>
          <Descriptions.Item label={t('settings.timeframe')}>{t('settings.timeframeValue')}</Descriptions.Item>
          <Descriptions.Item label="Backend HTTP">
            <span style={{ wordBreak: 'break-all' }}>{BACKEND_HTTP_URL}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Backend WebSocket">
            <span style={{ wordBreak: 'break-all' }}>{BACKEND_WS_URL}</span>
          </Descriptions.Item>
          <Descriptions.Item label={t('settings.connectionStatus')}>{t(`connection.${connectionStatus}` as TranslationKey)}</Descriptions.Item>
          <Descriptions.Item label={t('settings.displayTimezone')}>
            <Select size="small" style={{ width: 240, maxWidth: '100%' }} value={timezone} onChange={setTimezone} options={TIMEZONE_OPTIONS} />
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );
}
