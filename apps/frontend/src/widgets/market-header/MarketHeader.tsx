import { Badge, Card, Select, Space, Statistic, Typography } from 'antd';
import { useMarketStore } from '../../entities/market/model/store';
import { BROWSER_TIMEZONE } from '../../shared/lib/time';
import { useMeQuery } from '../../entities/session/api/session';
import { useT, type TranslationKey } from '../../shared/i18n';

const TIMEZONE_OPTIONS = Array.from(
  new Set([BROWSER_TIMEZONE, 'UTC', 'Europe/Moscow', 'Europe/London', 'America/New_York', 'Asia/Dubai']),
).map((tz) => ({ value: tz, label: tz }));

const PHASE_COLOR: Record<string, string> = {
  WAITING: 'default',
  ANALYZING_15M: 'processing',
  BUY_READY: 'warning',
  SELL_READY: 'warning',
  BUY_ACTIVE: 'success',
  SELL_ACTIVE: 'error',
  STOP_LOSS_HIT: 'error',
  CLOSED: 'default',
  PAUSED: 'warning',
  ANALYZING_H1: 'processing',
  TAKE_PROFIT_HIT: 'success',
  NO_SPEED: 'warning',
};

/** `phase`: the long-term page shows its own engine's phase instead of the scalping one. */
export function MarketHeader({ phase: phaseOverride }: { phase?: string } = {}) {
  const instrument = useMarketStore((s) => s.instrument);
  const output = useMarketStore((s) => s.output);
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const timezone = useMarketStore((s) => s.timezone);
  const setTimezone = useMarketStore((s) => s.setTimezone);

  const t = useT();
  const paused = useMeQuery().data?.analysisPaused ?? false;
  // The engine's phase is shared; a paused account sees PAUSED instead of the shared signal hunt.
  const enginePhase = phaseOverride ?? output?.phase ?? 'WAITING';
  const phase = paused && !enginePhase.endsWith('_ACTIVE') ? 'PAUSED' : enginePhase;

  return (
    <Card>
      <Space size="large" align="center" wrap>
        <div>
          <Typography.Text type="secondary">{t('market.market')}</Typography.Text>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {instrument ?? '—'}
          </Typography.Title>
        </div>

        <Statistic title={t('market.currentPrice')} value={output?.currentPrice ?? undefined} precision={2} />

        <div>
          <Typography.Text type="secondary">{t('market.status')}</Typography.Text>
          <div>
            <Badge status={PHASE_COLOR[phase] as any} text={<Typography.Text strong>{t(`phase.${phase}` as TranslationKey)}</Typography.Text>} />
          </div>
        </div>

        <div>
          <Typography.Text type="secondary">{t('market.connection')}</Typography.Text>
          <div>
            <Badge
              status={connectionStatus === 'open' ? 'success' : connectionStatus === 'connecting' ? 'processing' : 'error'}
              text={t(`connection.${connectionStatus}` as TranslationKey)}
            />
          </div>
        </div>

        <div>
          <Typography.Text type="secondary">{t('market.timezone')}</Typography.Text>
          <div>
            <Select size="small" style={{ width: 200, maxWidth: '100%' }} value={timezone} onChange={setTimezone} options={TIMEZONE_OPTIONS} />
          </div>
        </div>
      </Space>
    </Card>
  );
}
