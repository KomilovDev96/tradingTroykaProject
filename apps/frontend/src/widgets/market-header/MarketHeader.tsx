import { Badge, Card, Select, Space, Statistic, Typography } from 'antd';
import { useMarketStore } from '../../entities/market/model/store';
import { BROWSER_TIMEZONE } from '../../shared/lib/time';

const TIMEZONE_OPTIONS = Array.from(
  new Set([BROWSER_TIMEZONE, 'UTC', 'Europe/Moscow', 'Europe/London', 'America/New_York', 'Asia/Dubai']),
).map((tz) => ({ value: tz, label: tz }));

const PHASE_LABEL: Record<string, string> = {
  WAITING: 'ОЖИДАНИЕ',
  ANALYZING_15M: 'АНАЛИЗ 15М',
  BUY_READY: 'ГОТОВ К BUY',
  SELL_READY: 'ГОТОВ К SELL',
  BUY_ACTIVE: 'BUY',
  SELL_ACTIVE: 'SELL',
  STOP_LOSS_HIT: 'СТОП-ЛОСС',
  CLOSED: 'ЗАКРЫТО',
  PAUSED: 'ПАУЗА',
};

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
};

const CONNECTION_LABEL: Record<string, string> = {
  open: 'подключено',
  connecting: 'подключение...',
  closed: 'нет связи',
};

export function MarketHeader() {
  const instrument = useMarketStore((s) => s.instrument);
  const output = useMarketStore((s) => s.output);
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const timezone = useMarketStore((s) => s.timezone);
  const setTimezone = useMarketStore((s) => s.setTimezone);

  const phase = output?.phase ?? 'WAITING';

  return (
    <Card>
      <Space size="large" align="center" wrap>
        <div>
          <Typography.Text type="secondary">РЫНОК</Typography.Text>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {instrument ?? '—'}
          </Typography.Title>
        </div>

        <Statistic title="Текущая цена" value={output?.currentPrice ?? undefined} precision={2} />

        <div>
          <Typography.Text type="secondary">Статус</Typography.Text>
          <div>
            <Badge status={PHASE_COLOR[phase] as any} text={<Typography.Text strong>{PHASE_LABEL[phase] ?? phase}</Typography.Text>} />
          </div>
        </div>

        <div>
          <Typography.Text type="secondary">Соединение</Typography.Text>
          <div>
            <Badge
              status={connectionStatus === 'open' ? 'success' : connectionStatus === 'connecting' ? 'processing' : 'error'}
              text={CONNECTION_LABEL[connectionStatus] ?? connectionStatus}
            />
          </div>
        </div>

        <div>
          <Typography.Text type="secondary">Часовой пояс</Typography.Text>
          <div>
            <Select size="small" style={{ width: 200, maxWidth: '100%' }} value={timezone} onChange={setTimezone} options={TIMEZONE_OPTIONS} />
          </div>
        </div>
      </Space>
    </Card>
  );
}
